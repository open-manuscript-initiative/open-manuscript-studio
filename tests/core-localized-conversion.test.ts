import test from 'node:test';
import { coreLocalizedConversionCases } from './coreLocalizedConversionCases.ts';
for (const item of coreLocalizedConversionCases) test(`${item.id} [${item.requirements.join(', ')}]`, item.run);
