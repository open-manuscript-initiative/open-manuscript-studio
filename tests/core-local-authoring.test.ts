import test from 'node:test';
import { coreLocalAuthoringCases } from './coreLocalAuthoringCases.ts';
for (const item of coreLocalAuthoringCases) test(`${item.id} [${item.requirements.join(', ')}]`, item.run);
