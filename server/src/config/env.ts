import 'dotenv/config';

import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z
    .enum([
      'development',
      'test',
      'production',
    ])
    .default('development'),

  PORT: z.coerce
    .number()
    .int()
    .positive()
    .max(65535)
    .default(3001),

  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL is required.'),

  FRONTEND_ORIGIN: z
    .string()
    .url()
    .default('http://localhost:5173'),
});

const result = environmentSchema.safeParse(
  process.env,
);

if (!result.success) {
  console.error(
    'Invalid server environment configuration:',
    result.error.flatten().fieldErrors,
  );

  throw new Error(
    'The server environment configuration is invalid.',
  );
}

export const env = result.data;
