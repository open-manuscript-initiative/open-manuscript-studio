import { ExternalPlatform } from '@prisma/client';

import { upsertExternalInstallation } from '../integrations/externalInstallations.js';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;

  return process.argv
    .find((argument) =>
      argument.startsWith(prefix),
    )
    ?.slice(prefix.length);
}

const platformValue =
  (readArg('platform') ?? '').toLowerCase();

const platform =
  platformValue === 'ojs'
    ? ExternalPlatform.OJS
    : platformValue === 'omp'
      ? ExternalPlatform.OMP
      : null;

const installationId = readArg('id');
const displayName = readArg('name');
const baseUrl = readArg('base-url');
const sharedSecret =
  readArg('secret') ??
  process.env.OMI_INTEGRATION_SHARED_SECRET;

if (
  !platform ||
  !installationId ||
  !displayName ||
  !baseUrl ||
  !sharedSecret
) {
  console.error(
    'Usage: OMI_INTEGRATION_SHARED_SECRET=<64-hex> npm run integration:add -- --platform=ojs --id=example-ojs --name="Example Journal" --base-url=https://example.org/ojs',
  );
  process.exit(1);
}

try {
  const result =
    await upsertExternalInstallation({
      installationId,
      platform,
      displayName,
      baseUrl,
      sharedSecret,
    });

  console.log('Integration saved:');
  console.log(
    JSON.stringify(result, null, 2),
  );
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : error,
  );

  process.exit(1);
}
