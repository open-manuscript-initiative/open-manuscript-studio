import test from 'node:test';
import { coreExportPrivacyCases } from './coreExportPrivacyCases.ts';
for (const item of coreExportPrivacyCases) test(`${item.id} [${item.requirements.join(', ')}]`, item.run);
