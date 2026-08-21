import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const generatedIcons = path.join(root, 'src-tauri', 'icons', 'android');
const androidRes = path.join(
  root,
  'src-tauri',
  'gen',
  'android',
  'app',
  'src',
  'main',
  'res',
);

if (!fs.existsSync(generatedIcons)) {
  throw new Error(
    `Generated Android icons were not found at ${generatedIcons}. Run "npm run icons:generate" first.`,
  );
}

if (!fs.existsSync(androidRes)) {
  throw new Error(
    `Generated Android project was not found at ${androidRes}. Run "npm run tauri -- android init" first.`,
  );
}

const copied = [];
for (const entry of fs.readdirSync(generatedIcons, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  if (!entry.name.startsWith('mipmap-')) continue;

  const sourceDir = path.join(generatedIcons, entry.name);
  const targetDir = path.join(androidRes, entry.name);
  fs.mkdirSync(targetDir, { recursive: true });

  for (const iconEntry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (!iconEntry.isFile()) continue;
    const source = path.join(sourceDir, iconEntry.name);
    const target = path.join(targetDir, iconEntry.name);
    fs.copyFileSync(source, target);
    copied.push(path.relative(root, target));
  }
}

if (copied.length === 0) {
  throw new Error(`No Android launcher icons were found below ${generatedIcons}.`);
}

console.log(`Synchronized ${copied.length} Android launcher icon files.`);
for (const file of copied) console.log(`  ${file}`);
