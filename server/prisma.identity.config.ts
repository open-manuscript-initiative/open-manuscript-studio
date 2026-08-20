import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const identityDatabaseUrl =
  process.env.IDENTITY_DATABASE_URL ??
  'postgresql://identity_not_configured:identity_not_configured@127.0.0.1:1/identity_not_configured';

export default defineConfig({
  schema: 'prisma/identity/schema.prisma',
  migrations: {
    path: 'prisma/identity/migrations',
  },
  datasource: {
    url: identityDatabaseUrl,
  },
});
