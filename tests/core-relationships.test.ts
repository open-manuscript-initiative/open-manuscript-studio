import test from 'node:test';
import { coreRelationshipCases } from './coreRelationshipCases.ts';
for (const item of coreRelationshipCases) test(`${item.id} [${item.requirements.join(', ')}]`, item.run);
