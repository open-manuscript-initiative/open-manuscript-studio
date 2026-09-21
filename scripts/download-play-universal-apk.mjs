import { createSign } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ANDROID_PUBLISHER_SCOPE =
  'https://www.googleapis.com/auth/androidpublisher';
const ANDROID_PUBLISHER_ROOT =
  'https://androidpublisher.googleapis.com/androidpublisher/v3';

function base64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function signServiceAccountJwt(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
  );
  const payload = base64Url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: ANDROID_PUBLISHER_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer
    .sign(credentials.private_key, 'base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  return `${signingInput}.${signature}`;
}

export async function getAndroidPublisherAccessToken(credentials) {
  if (!credentials?.client_email || !credentials?.private_key) {
    throw new Error(
      'Google Play service-account credentials require client_email and private_key.',
    );
  }

  const assertion = signServiceAccountJwt(credentials);
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Google OAuth token request failed (${response.status}): ${await response.text()}`,
    );
  }

  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error('Google OAuth token response did not contain access_token.');
  }
  return payload.access_token;
}

async function publisherGet(path, accessToken) {
  const response = await fetch(`${ANDROID_PUBLISHER_ROOT}${path}`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(
      `Google Play Developer API request failed (${response.status}) for ${path}: ${await response.text()}`,
    );
  }
  return response;
}

export async function downloadPlayUniversalApk({
  credentials,
  packageName,
  versionCode,
  outputPath,
}) {
  if (!packageName) throw new Error('packageName is required.');
  if (!Number.isInteger(Number(versionCode))) {
    throw new Error('versionCode must be an integer.');
  }

  const accessToken = await getAndroidPublisherAccessToken(credentials);
  const encodedPackage = encodeURIComponent(packageName);
  const code = String(versionCode);

  const listResponse = await publisherGet(
    `/applications/${encodedPackage}/generatedApks/${code}`,
    accessToken,
  );
  const metadata = await listResponse.json();
  const signingGroups = metadata.generatedApks ?? [];
  const universal = signingGroups
    .map((group) => ({
      downloadId: group.generatedUniversalApk?.downloadId,
      certificateSha256Hash: group.certificateSha256Hash,
    }))
    .find((entry) => entry.downloadId);

  if (!universal?.downloadId) {
    throw new Error(
      `Google Play has no generated universal APK for ${packageName} versionCode ${code}. ` +
        'Wait for bundle processing to complete and retry.',
    );
  }

  const downloadResponse = await publisherGet(
    `/applications/${encodedPackage}/generatedApks/${code}/downloads/${encodeURIComponent(
      universal.downloadId,
    )}:download`,
    accessToken,
  );
  const bytes = Buffer.from(await downloadResponse.arrayBuffer());
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error('Downloaded Google Play artifact is not an APK/ZIP payload.');
  }

  const absoluteOutput = resolve(outputPath);
  mkdirSync(dirname(absoluteOutput), { recursive: true });
  writeFileSync(absoluteOutput, bytes);

  return {
    outputPath: absoluteOutput,
    size: bytes.length,
    certificateSha256Hash: universal.certificateSha256Hash ?? null,
  };
}

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : '';

if (import.meta.url === invokedPath) {
  try {
    const credentialsRaw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    if (!credentialsRaw) {
      throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is required.');
    }
    const credentials = JSON.parse(credentialsRaw);
    const packageName =
      readArg('--package') ?? 'org.openmanuscript.studio';
    const versionCode = Number(readArg('--version-code'));
    const outputPath =
      readArg('--output') ??
      resolve('artifacts/translation/play-universal.apk');

    const result = await downloadPlayUniversalApk({
      credentials,
      packageName,
      versionCode,
      outputPath,
    });
    console.log(
      `Downloaded Play universal APK (${result.size} bytes) to ${result.outputPath}.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
