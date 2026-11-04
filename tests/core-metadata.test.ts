import test from 'node:test';
import { coreMetadataCases } from './coreMetadataCases.ts';
for (const item of coreMetadataCases) test(`${item.id} [${item.requirements.join(', ')}]`, item.run);
