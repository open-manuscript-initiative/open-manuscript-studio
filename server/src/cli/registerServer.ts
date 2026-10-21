import 'dotenv/config';

import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const registryOrigin = (process.env.OMI_SERVER_REGISTRY_ORIGIN || 'https://studio.openmanuscript.org').replace(/\/$/, '');
const verifyId = process.argv.includes('--verify')
  ? process.argv[process.argv.indexOf('--verify') + 1]
  : undefined;

async function request(path: string, method: 'POST' = 'POST', bodyValue: unknown = {}): Promise<{ response: Response; body: Record<string, unknown> }> {
  const response = await fetch(`${registryOrigin}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyValue),
    signal: AbortSignal.timeout(15_000),
  });
  const body = response.status === 204 ? {} : await response.json() as Record<string, unknown>;
  return { response, body };
}

if (verifyId) {
  const { response, body } = await request(
    `/api/server-registry/registrations/${encodeURIComponent(verifyId)}/verify`,
    'POST', {} ,
  );
  if (!response.ok) {
    console.error(body);
    process.exitCode = 1;
  } else {
    console.log('Server verified and registered.');
    console.log(`GitHub audit: ${String(body.auditUrl)}`);
    console.log('');
    console.log('Keep this heartbeat token secret. It is shown only once:');
    console.log(String(body.heartbeatToken));
    console.log('');
    console.log('Add these values to the server environment:');
    console.log(`OMI_SERVER_REGISTRY_INSTANCE_ID=${String(body.id)}`);
    console.log(`OMI_SERVER_REGISTRY_HEARTBEAT_TOKEN=${String(body.heartbeatToken)}`);
    console.log(`OMI_SERVER_REGISTRY_ORIGIN=${registryOrigin}`);
  }
} else {
  const args = process.argv.slice(2);
  const arg = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const terminal = createInterface({ input, output });
  try {
    const name = arg('--name') || await terminal.question('Public server name: ');
    const origin = arg('--origin') || await terminal.question('Public HTTPS origin: ');
    const { response, body } = await request('/api/server-registry/registrations', {
      'POST', {
        name,
        origin,
        softwareVersion: process.env.OMI_SERVER_REGISTRY_SOFTWARE_VERSION || 'unknown',
        capabilities: (process.env.OMI_SERVER_REGISTRY_CAPABILITIES || 'web,api')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      },
    });
    if (!response.ok) {
      console.error(body);
      process.exitCode = 1;
    } else {
      const verification = body.verification as { name: string; value: string };
      console.log('Publish this DNS TXT record to prove control of the server domain:');
      console.log(`${verification.name} TXT ${verification.value}`);
      console.log('');
      console.log('');
      console.log('After DNS has propagated, verify the domain to receive the one-time heartbeat token:');
      console.log(`npm run server:register -- --verify ${String(body.id)}`);
    }
  } finally {
    terminal.close();
  }
}
