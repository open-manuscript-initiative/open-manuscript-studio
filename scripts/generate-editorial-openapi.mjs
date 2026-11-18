import { writeFileSync } from 'node:fs';
import { editorialOpenApi } from '../server/dist/contracts/editorialOpenApi.js';
writeFileSync(new URL('../docs/api/editorial-v1.openapi.json', import.meta.url), JSON.stringify(editorialOpenApi(), null, 2) + '\n');
