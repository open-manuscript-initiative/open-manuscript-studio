import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const begin = '# BEGIN OMI Studio collaboration demo managed block';
const end = '# END OMI Studio collaboration demo managed block';
const awkFile = fileURLToPath(new URL('../scripts/strip-managed-nginx-block.awk', import.meta.url));

function stripManagedBlock(input) {
  return execFileSync('awk', ['-v', `begin=${begin}`, '-v', `end=${end}`, '-f', awkFile], {
    encoding: 'utf8',
    input,
  });
}

test('managed Nginx block replacement removes indented CRLF markers', () => {
  const input = [
    'server {\r',
    `  ${begin}  \r`,
    'location ^~ /collaboration-demo/api/ { }\r',
    end,
    'location /unrelated/ { }',
    '} ',
  ].join('\n');

  assert.equal(stripManagedBlock(input), 'server {\nlocation /unrelated/ { }\n} \n');
});

test('managed Nginx block replacement refuses repeated or unmatched markers', () => {
  assert.throws(() => stripManagedBlock(`${begin}\n${end}\n${begin}\n${end}\n`));
  assert.throws(() => stripManagedBlock(`${begin}\n`));
  assert.throws(() => stripManagedBlock(`${end}\n`));
});
