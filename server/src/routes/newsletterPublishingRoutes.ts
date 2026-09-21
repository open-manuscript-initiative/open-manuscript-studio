import { createHash } from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { decryptSecret, type EncryptedSecret } from '../integrations/secretCrypto.js';
import { assertTrustedIntegrationUrl } from '../integrations/security/trustedRemoteUrl.js';

export const newsletterPublishingRouter = Router();

const publishSchema = z.object({
  connectionId: z.string().uuid(),
  manuscriptId: z.string().trim().min(1).max(128),
  title: z.string().trim().min(1).max(500),
  html: z.string().min(1).max(10 * 1024 * 1024),
  status: z.enum(['draft', 'publish']).default('draft'),
  approved: z.literal(true),
});

type ConfigRecord = Record<string, unknown>;

function configRecord(value: unknown): ConfigRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as ConfigRecord
    : {};
}

function stringConfig(config: ConfigRecord, key: string): string {
  const value = config[key];
  return typeof value === 'string' ? value.trim() : '';
}

function parseEncryptedSecret(value: string | null): string | null {
  if (!value) return null;
  const parsed = JSON.parse(value) as Partial<EncryptedSecret>;
  if (!parsed.ciphertext || !parsed.iv || !parsed.authTag) {
    throw new Error('Stored integration secret is invalid.');
  }
  return decryptSecret(parsed as EncryptedSecret);
}

function digestHtml(html: string): string {
  return createHash('sha256').update(html, 'utf8').digest('hex');
}

function appendTrustedPath(baseUrl: string, path: string): string {
  const base = new URL(baseUrl);
  const root = base.pathname.replace(/\/+$/, '');
  base.pathname = `${root}/${path.replace(/^\/+/, '')}`;
  base.search = '';
  base.hash = '';
  return base.toString();
}

async function wordpressRequest(
  baseUrl: string,
  path: string,
  username: string,
  applicationPassword: string,
  init: RequestInit,
): Promise<Response> {
  const rawUrl = appendTrustedPath(baseUrl, path);
  const trustedUrl = await assertTrustedIntegrationUrl(rawUrl, baseUrl);
  const headers = new Headers(init.headers);
  headers.set(
    'Authorization',
    `Basic ${Buffer.from(`${username}:${applicationPassword}`, 'utf8').toString('base64')}`,
  );
  headers.set('Accept', 'application/json');
  return fetch(trustedUrl, {
    ...init,
    headers,
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  });
}

async function responseMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as
    | { message?: string; code?: string }
    | null;
  return body?.message || body?.code || `HTTP ${response.status}`;
}

async function uploadWordPressImages(
  html: string,
  baseUrl: string,
  username: string,
  applicationPassword: string,
): Promise<string> {
  let output = html;
  const matches = Array.from(
    html.matchAll(/src=["'](data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/=]+))["']/gi),
  );

  if (matches.length > 64) {
    throw new Error('A WordPress publication may contain at most 64 embedded images.');
  }

  let index = 0;
  for (const match of matches) {
    const source = match[1];
    const subtype = match[2]?.toLowerCase();
    const payload = match[3];
    if (!source || !subtype || !payload) continue;

    const mediaType = subtype === 'jpeg' ? 'image/jpeg' : `image/${subtype}`;
    const extension = subtype === 'jpeg' ? 'jpg' : subtype;
    const bytes = Buffer.from(payload, 'base64');
    if (bytes.length > 12 * 1024 * 1024) {
      throw new Error('An embedded image exceeds the 12 MiB WordPress upload limit.');
    }

    index += 1;
    const upload = await wordpressRequest(
      baseUrl,
      'wp-json/wp/v2/media',
      username,
      applicationPassword,
      {
        method: 'POST',
        headers: {
          'Content-Type': mediaType,
          'Content-Disposition': `attachment; filename="omi-newsletter-${index}.${extension}"`,
        },
        body: bytes,
      },
    );

    if (!upload.ok) {
      throw new Error(`WordPress media upload failed: ${await responseMessage(upload)}`);
    }

    const media = await upload.json() as { source_url?: string };
    if (!media.source_url) {
      throw new Error('WordPress media upload did not return a source URL.');
    }
    output = output.replaceAll(source, media.source_url);
  }

  return output;
}

function wordpressArticleHtml(html: string): string {
  const article = html.match(/<article\b[\s\S]*?<\/article>/i)?.[0];
  return article ?? html;
}

function genericHeaders(
  authenticationMode: string,
  config: ConfigRecord,
  secret: string | null,
): Headers {
  const headers = new Headers({
    Accept: 'application/json',
    'Content-Type': 'application/json',
  });
  if (authenticationMode === 'none') return headers;
  if (!secret) throw new Error('The selected web publishing target has no stored credential.');

  const scheme = stringConfig(config, 'authScheme') || 'bearer';
  if (scheme === 'bearer') {
    headers.set('Authorization', `Bearer ${secret}`);
  } else if (scheme === 'x-api-key') {
    headers.set('X-API-Key', secret);
  } else if (scheme === 'basic') {
    const username = stringConfig(config, 'username');
    if (!username) throw new Error('Basic authentication requires a username.');
    headers.set(
      'Authorization',
      `Basic ${Buffer.from(`${username}:${secret}`, 'utf8').toString('base64')}`,
    );
  } else {
    throw new Error('Unsupported web publishing authentication scheme.');
  }
  return headers;
}

newsletterPublishingRouter.post(
  '/newsletter/publish',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const input = publishSchema.safeParse(request.body);
    if (!input.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_NEWSLETTER_PUBLICATION',
          message: 'The newsletter publication request is invalid or has not been explicitly approved.',
          fields: input.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const userId = request.authUserId!;
    const connection = await prisma.userIntegration.findFirst({
      where: {
        id: input.data.connectionId,
        userId,
        enabled: true,
        providerId: { in: ['wordpress', 'web-publishing'] },
      },
    });
    if (!connection) {
      response.status(404).json({
        error: {
          code: 'WEB_PUBLISHING_TARGET_NOT_FOUND',
          message: 'The selected personal web publishing target was not found.',
        },
      });
      return;
    }

    const config = configRecord(connection.config);
    const secret = parseEncryptedSecret(connection.encryptedSecret);
    const contentDigest = digestHtml(input.data.html);
    const previous = await prisma.webPublication.findUnique({
      where: {
        userId_connectionId_manuscriptId: {
          userId,
          connectionId: connection.id,
          manuscriptId: input.data.manuscriptId,
        },
      },
    });

    try {
      let externalId = previous?.externalId ?? null;
      let externalUrl = previous?.externalUrl ?? null;

      if (connection.providerId === 'wordpress') {
        const baseUrl = stringConfig(config, 'baseUrl');
        const username = stringConfig(config, 'username');
        if (!baseUrl || !username || !secret) {
          throw new Error('WordPress publishing requires a site URL, username, and application password.');
        }

        await assertTrustedIntegrationUrl(baseUrl, baseUrl);
        let content = wordpressArticleHtml(input.data.html);
        content = await uploadWordPressImages(content, baseUrl, username, secret);

        const path = externalId
          ? `wp-json/wp/v2/posts/${encodeURIComponent(externalId)}`
          : 'wp-json/wp/v2/posts';
        const postResponse = await wordpressRequest(
          baseUrl,
          path,
          username,
          secret,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: input.data.title,
              content,
              status: input.data.status,
            }),
          },
        );
        if (!postResponse.ok) {
          throw new Error(`WordPress publication failed: ${await responseMessage(postResponse)}`);
        }
        const post = await postResponse.json() as { id?: number; link?: string };
        if (post.id === undefined) {
          throw new Error('WordPress did not return a post identifier.');
        }
        externalId = String(post.id);
        externalUrl = typeof post.link === 'string' ? post.link : externalUrl;
      } else {
        const endpoint = stringConfig(config, 'endpoint');
        if (!endpoint) throw new Error('The generic web publishing endpoint is missing.');
        const trustedEndpoint = await assertTrustedIntegrationUrl(endpoint, endpoint);
        const publishResponse = await fetch(trustedEndpoint, {
          method: 'POST',
          headers: genericHeaders(connection.authenticationMode, config, secret),
          body: JSON.stringify({
            protocol: 'omi-newsletter-publish/1',
            manuscript: {
              id: input.data.manuscriptId,
              title: input.data.title,
            },
            publication: {
              html: input.data.html,
              status: input.data.status,
              sha256: contentDigest,
            },
            previous: previous
              ? {
                  externalId: previous.externalId,
                  externalUrl: previous.externalUrl,
                }
              : null,
          }),
          redirect: 'error',
          signal: AbortSignal.timeout(20000),
        });
        if (!publishResponse.ok) {
          throw new Error(`Web publication failed: ${await responseMessage(publishResponse)}`);
        }
        const receipt = await publishResponse.json().catch(() => ({})) as {
          id?: string | number;
          externalId?: string | number;
          url?: string;
          externalUrl?: string;
        };
        const receiptId = receipt.externalId ?? receipt.id;
        externalId = receiptId === undefined ? externalId : String(receiptId);
        externalUrl = receipt.externalUrl ?? receipt.url ?? externalUrl;
      }

      const publication = await prisma.webPublication.upsert({
        where: {
          userId_connectionId_manuscriptId: {
            userId,
            connectionId: connection.id,
            manuscriptId: input.data.manuscriptId,
          },
        },
        update: {
          externalId,
          externalUrl,
          contentDigest,
          status: input.data.status.toUpperCase(),
        },
        create: {
          userId,
          connectionId: connection.id,
          manuscriptId: input.data.manuscriptId,
          externalId,
          externalUrl,
          contentDigest,
          status: input.data.status.toUpperCase(),
        },
      });

      response.status(200).json({
        publication: {
          connectionId: connection.id,
          providerId: connection.providerId,
          manuscriptId: publication.manuscriptId,
          externalId: publication.externalId,
          externalUrl: publication.externalUrl,
          contentDigest: publication.contentDigest,
          status: publication.status.toLowerCase(),
          updatedAt: publication.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      response.status(502).json({
        error: {
          code: 'WEB_PUBLICATION_FAILED',
          message: error instanceof Error ? error.message : 'External web publication failed.',
        },
      });
    }
  },
);
