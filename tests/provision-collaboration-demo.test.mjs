import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const begin = '# BEGIN OMI Studio collaboration demo managed block';
const end = '# END OMI Studio collaboration demo managed block';
const awkFile = fileURLToPath(new URL('../scripts/strip-managed-nginx-block.awk', import.meta.url));
const provisionScript = readFileSync(fileURLToPath(new URL('../scripts/provision-collaboration-demo.sh', import.meta.url)), 'utf8');

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

test('managed Nginx block replacement removes repeated complete blocks', () => {
  const input = `before\n${begin}\nold block\n${end}\n${begin}\nolder block\n${end}\nafter\n`;

  assert.equal(stripManagedBlock(input), 'before\nafter\n');
});

test('managed Nginx block replacement refuses nested or unmatched markers', () => {
  assert.throws(() => stripManagedBlock(`${begin}\n${begin}\n${end}\n${end}\n`));
  assert.throws(() => stripManagedBlock(`${begin}\n`));
  assert.throws(() => stripManagedBlock(`${end}\n`));
});

test('Plesk provisioning adds a distinct WebSocket route and refuses unmanaged collisions', () => {
  assert.match(provisionScript, /location \^~ \/collaboration\/ws/);
  assert.match(provisionScript, /proxy_pass http:\/\/127\.0\.0\.1:3022/);
  assert.match(provisionScript, /proxy_set_header Upgrade \$http_upgrade/);
  assert.match(provisionScript, /\/collaboration\/ws\)/);
  assert.match(provisionScript, /refusing to create a duplicate/);
});
