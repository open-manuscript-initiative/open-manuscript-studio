import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(root, 'src/schemas/omi-schema-source.json'), 'utf8'));
if (manifest.repository !== 'open-manuscript-initiative/omi' || !/^[a-f0-9]{40}$/.test(manifest.revision)
  || !Array.isArray(manifest.schemas) || manifest.schemas.length !== 3) throw new Error('Invalid immutable OMI schema source manifest.');
const sourceArgument = process.argv.find(arg => arg.startsWith('--source='));
const sourceRoot = sourceArgument ? resolve(sourceArgument.slice('--source='.length)) : null;
if (sourceRoot && execFileSync('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() !== manifest.revision) {
  throw new Error('OMI source checkout is not the pinned commit.');
}
for (const schema of manifest.schemas) {
  const bytes = readFileSync(resolve(root, schema.path));
  if (createHash('sha256').update(bytes).digest('hex') !== schema.sha256) throw new Error(`Vendored OMI bytes changed: ${schema.path}`);
  if (sourceRoot && !bytes.equals(readFileSync(resolve(sourceRoot, schema.sourcePath)))) {
    throw new Error(`Vendored schema differs from pinned canonical source: ${schema.path}`);
  }
}
if (process.argv.includes('--github-output')) {
  if (!process.env.GITHUB_OUTPUT) throw new Error('Missing GitHub output path.');
  appendFileSync(process.env.GITHUB_OUTPUT, `revision=${manifest.revision}\n`);
}
console.log(`OMI schema source: PASS (${manifest.revision}; ${sourceRoot ? 'canonical byte parity and ' : ''}SHA-256 verified).`);
