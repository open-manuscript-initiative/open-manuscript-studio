import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { toPortableOmiManuscript } from '../src/services/omiPortableFormat.ts';
import { createReferenceManuscript } from '../tests/referenceManuscriptFixture.ts';

const output = resolve(
  process.cwd(),
  process.argv[2] ?? 'tests/fixtures/reference-manuscript-all-features.omi.json',
);

const portable = toPortableOmiManuscript(createReferenceManuscript());
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(portable, null, 2)}\n`, 'utf8');

process.stdout.write(`${output}\n`);
