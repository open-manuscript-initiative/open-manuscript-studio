import test from 'node:test';
import { coreRemainingCases } from './coreRemainingCases.ts';
for (const item of coreRemainingCases) test(`${item.id} [${item.requirements.join(', ')}]`, item.run);
