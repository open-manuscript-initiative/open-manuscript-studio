import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parsePort(value: string | undefined): number {
  const parsed = Number(value ?? '3001');
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error('SERVER_PORT must be a valid TCP port.');
  }
  return parsed;
}

export const serverConfig = {
  port: parsePort(process.env.SERVER_PORT),
  integrationMasterKeyHex: required('INTEGRATION_MASTER_KEY'),
};
