import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/identity/schema.prisma',
  migrations: {
    path: 'prisma/identity/migrations',
  },
  datasource: {
    url: env('IDENTITY_DATABASE_URL'),
  },
});
