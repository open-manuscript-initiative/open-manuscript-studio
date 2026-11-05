import test from 'node:test';
import { coreAuthorityCases } from './coreAuthorityCases.ts';
for (const item of coreAuthorityCases) test(`${item.id} [${item.requirements.join(', ')}]`, item.run);
