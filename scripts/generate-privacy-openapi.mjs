import { writeFileSync } from 'node:fs';
import { privacyClientTypes } from '../server/dist/contracts/privacyClientTypes.js';
import { privacyOpenApi } from '../server/dist/contracts/privacyOpenApi.js';
writeFileSync(new URL('../docs/api/privacy-v1.openapi.json', import.meta.url), JSON.stringify(privacyOpenApi(), null, 2) + '\n');
writeFileSync(new URL('../src/api/privacyContract.ts', import.meta.url), privacyClientTypes());
