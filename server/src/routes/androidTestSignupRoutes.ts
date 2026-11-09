import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

// Central OMI programme only. Self-hosted Studio instances must explicitly opt in.
export const androidTestSignupRouter = Router();
const PACKAGE = 'org.openmanuscript.studio';
const PLAY_LINK = 'https://play.google.com/apps/testing/' + PACKAGE;
const SITE_LINK = 'https://openmanuscript.org/android-test/';
const signupSchema = z.object({
  email: z.email().trim().max(320),
  consent: z.literal(true),
  language: z.enum(['hu', 'en', 'de']).default('en'),
  website: z.string().max(250).optional(), // honeypot
}).strict();
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const formSchema = z.object({ token: tokenSchema }).strict();
const signupRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Try again later.' } },
});
const digest = (token: string): string => createHash('sha256').update(token).digest('hex');
const newToken = (): string => randomBytes(32).toString('base64url');
const locale = (value: unknown): 'hu' | 'de' | 'en' =>
  value === 'hu' || value === 'de' ? value : 'en';

type SignupRow = { email: string };

async function pruneExpired(): Promise<void> {
  // Database migration must be applied before enabling this endpoint.
  await prisma.$executeRaw`
    DELETE FROM "android_closed_test_signups"
    WHERE ("verified_at" IS NULL AND "updated_at" < NOW() - INTERVAL '7 days')
       OR ("verified_at" IS NOT NULL AND "verified_at" < NOW() - INTERVAL '180 days')
  `;
}

async function sendVerification(email: string, language: 'hu' | 'en' | 'de', confirmToken: string, cancelToken: string): Promise<void> {
  const origin = new URL(env.OMI_ANDROID_TEST_ORIGIN);
  origin.pathname = '/api/public/android-test/confirm';
  origin.search = '';
  origin.searchParams.set('token', confirmToken);
  origin.searchParams.set('lang', language);
  const confirmUrl = origin.toString();
  origin.pathname = '/api/public/android-test/unsubscribe';
  origin.searchParams.set('token', cancelToken);
  const cancelUrl = origin.toString();
  const messages = {
    en: [
      'Please confirm your request to participate in the Open Manuscript Studio Android closed test:',
      confirmUrl,
      '',
      'The link is valid for 48 hours. Confirming only registers your interest; the test administrator must still authorise your Google Account in Google Play.',
      'You can cancel your request here: ' + cancelUrl,
    ],
    hu: [
      'Erősítsd meg a jelentkezésedet az Open Manuscript Studio Android zárt tesztelésére:',
      confirmUrl,
      '',
      'A hivatkozás 48 óráig érvényes. A megerősítés csak a jelentkezést rögzíti; a Google Play jogosultságot a teszt üzemeltetője külön adja meg.',
      'A jelentkezés visszavonása: ' + cancelUrl,
    ],
    de: [
      'Bitte bestätige deine Anmeldung zum geschlossenen Android-Test von Open Manuscript Studio:',
      confirmUrl,
      '',
      'Dieser Link ist 48 Stunden gültig. Die Bestätigung allein gewährt noch keinen Google-Play-Zugang; die Testleitung muss dein Google-Konto separat freischalten.',
      'Anmeldung zurückziehen: ' + cancelUrl,
    ],
  };
  const message = [
    'From: ' + env.MAIL_FROM,
    'To: ' + email,
    'Subject: Confirm your OMI Android closed test request',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Auto-Submitted: auto-generated',
    '',
    ...messages[language],
    '',
    'Open Manuscript Initiative',
  ].join('\r\n');

  await new Promise<void>((resolve, reject) => {
    const child = spawn(env.SENDMAIL_PATH, ['-i', '-t'], {
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString().slice(0, 1024); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('Sendmail exited with status ' + String(code) + (stderr ? ': ' + stderr : '')));
    });
    child.stdin.on('error', () => { /* process exit carries delivery failure */ });
    child.stdin.end(message);
  });
}

function page(title: string, description: string, action?: { label: string; endpoint: string; token: string }): string {
  // No external scripts, personal details or user-controlled HTML.
  const form = action
    ? '<form method="post" action="' + action.endpoint + '">' +
      '<input type="hidden" name="token" value="' + action.token + '">' +
      '<button type="submit">' + action.label + '</button></form>'
    : '';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + title + '</title></head><body><main>' +
    '<h1>' + title + '</h1><p>' + description + '</p>' + form +
    '<p><a href="' + SITE_LINK + '">Android closed test information</a></p>' +
    '</main></body></html>';
}

function sendPage(response: import('express').Response, title: string, description: string, action?: {label: string; endpoint: string; token: string}): void {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.type('html').status(200).send(page(title, description, action));
}

androidTestSignupRouter.post('/signups', signupRateLimit, async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  if (!env.OMI_ANDROID_TEST_SIGNUPS_ENABLED) {
    response.status(503).json({ error: { code: 'SIGNUP_NOT_AVAILABLE', message: 'Android test signups are not enabled.' } });
    return;
  }
  const data = signupSchema.safeParse(request.body);
  if (!data.success) {
    response.status(400).json({ error: { code: 'INVALID_SIGNUP', message: 'A valid e-mail address and consent are required.' } });
    return;
  }
  // The confirmation response is intentionally indistinguishable for duplicate applications.
  const accepted = (): void => { response.status(202).json({ received: true, requiresEmailConfirmation: true, playAccessGranted: false }); };
  if (data.data.website) { accepted(); return; }
  const email = data.data.email.toLowerCase();
  const confirmToken = newToken();
  const cancelToken = newToken();
  const confirmHash = digest(confirmToken);
  try {
    await pruneExpired();
    const rows = await prisma.$queryRaw<SignupRow[]>`
      INSERT INTO "android_closed_test_signups"
        ("email", "confirm_token_hash", "cancel_token_hash", "confirm_expires_at")
      VALUES (${email}, ${confirmHash}, ${digest(cancelToken)}, NOW() + INTERVAL '48 hours')
      ON CONFLICT ("email") DO UPDATE SET
        "confirm_token_hash" = EXCLUDED."confirm_token_hash",
        "cancel_token_hash" = EXCLUDED."cancel_token_hash",
        "confirm_expires_at" = EXCLUDED."confirm_expires_at",
        "updated_at" = NOW()
      WHERE "android_closed_test_signups"."verified_at" IS NULL
        AND "android_closed_test_signups"."updated_at" < NOW() - INTERVAL '15 minutes'
      RETURNING "email"
    `;
    if (rows.length) {
      try {
        await sendVerification(email, data.data.language, confirmToken, cancelToken);
      } catch {
        // A failed mail must not strand this address for the retry window.
        await prisma.$executeRaw`
          DELETE FROM "android_closed_test_signups"
          WHERE "email" = ${email} AND "confirm_token_hash" = ${confirmHash} AND "verified_at" IS NULL
        `;
        response.status(503).json({ error: { code: 'MAIL_UNAVAILABLE', message: 'Confirmation mail could not be sent. Try again later.' } });
        return;
      }
    }
    accepted();
  } catch {
    // Do not log addresses or tokens.
    console.error('Android test signup database/delivery failure');
    response.status(503).json({ error: { code: 'SIGNUP_UNAVAILABLE', message: 'Registration is temporarily unavailable.' } });
  }
});

androidTestSignupRouter.get('/confirm', (request, response) => {
  const token = tokenSchema.safeParse(request.query.token);
  if (!env.OMI_ANDROID_TEST_SIGNUPS_ENABLED || !token.success) {
    sendPage(response, 'Invalid request', 'The confirmation link is invalid or unavailable.');
    return;
  }
  const language = locale(request.query.lang);
  const label = language === 'hu' ? 'Jelentkezés megerősítése' : language === 'de' ? 'Anmeldung bestätigen' : 'Confirm registration';
  const title = language === 'hu' ? 'Android tesztelés – megerősítés' : language === 'de' ? 'Android-Test – Bestätigung' : 'Android closed test – confirmation';
  const body = language === 'hu' ? 'A jelentkezés rögzítéséhez nyomd meg a gombot. Ez még nem ad Google Play-hozzáférést.' : language === 'de' ? 'Bitte bestätige deine Anmeldung. Der Google-Play-Zugang wird separat vergeben.' : 'Click below to confirm your request. Google Play access is granted separately.';
  sendPage(response, title, body, { label, endpoint: '/api/public/android-test/confirm', token: token.data });
});

androidTestSignupRouter.post('/confirm', async (request, response) => {
  if (!env.OMI_ANDROID_TEST_SIGNUPS_ENABLED) {
    response.status(503).type('text').send('Not available.'); return;
  }
  const data = formSchema.safeParse(request.body);
  if (!data.success) { response.status(400).type('text').send('Invalid token.'); return; }
  try {
    const rows = await prisma.$queryRaw<SignupRow[]>`
      UPDATE "android_closed_test_signups"
      SET "verified_at" = NOW(), "updated_at" = NOW()
      WHERE "confirm_token_hash" = ${digest(data.data.token)}
        AND "confirm_expires_at" > NOW()
        AND "verified_at" IS NULL
      RETURNING "email"
    `;
    if (!rows.length) {
      sendPage(response, 'Link expired or already used', 'If needed, request another confirmation e-mail through the registration page.');
      return;
    }
    sendPage(response, 'Registration confirmed', 'Your address has been verified and recorded. The test operator must still grant Google Play access. After approval, open ' + PLAY_LINK);
  } catch {
    response.status(503).type('text').send('Please try again later.');
  }
});

androidTestSignupRouter.get('/unsubscribe', (request, response) => {
  const token = tokenSchema.safeParse(request.query.token);
  if (!env.OMI_ANDROID_TEST_SIGNUPS_ENABLED || !token.success) {
    sendPage(response, 'Invalid request', 'The removal link is invalid or unavailable.'); return;
  }
  sendPage(response, 'Remove Android test registration', 'Remove the e-mail address associated with this registration.', {
    label: 'Delete registration', endpoint: '/api/public/android-test/unsubscribe', token: token.data,
  });
});

androidTestSignupRouter.post('/unsubscribe', async (request, response) => {
  if (!env.OMI_ANDROID_TEST_SIGNUPS_ENABLED) {
    response.status(503).type('text').send('Not available.'); return;
  }
  const data = formSchema.safeParse(request.body);
  if (!data.success) { response.status(400).type('text').send('Invalid token.'); return; }
  try {
    await prisma.$executeRaw`
      DELETE FROM "android_closed_test_signups"
      WHERE "cancel_token_hash" = ${digest(data.data.token)}
    `;
    sendPage(response, 'Registration removed', 'If a Google Play invitation was already granted, leave the test separately in Google Play. Removal here does not manage your Google account.');
  } catch {
    response.status(503).type('text').send('Please try again later.');
  }
});
