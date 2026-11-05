import test from 'node:test';
import { coreExtensionCases } from './coreExtensionCases.ts';
for (const item of coreExtensionCases) test(`${item.id} [${item.requirements.join(', ')}]`, item.run);
