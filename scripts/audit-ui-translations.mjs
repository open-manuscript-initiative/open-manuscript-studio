import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const srcRoot = path.join(root, 'src');

const sourceExtensions = new Set(['.ts', '.tsx']);
const skippedPathFragments = [
  `${path.sep}i18n${path.sep}locales${path.sep}`,
];

const intentionalLiteralPatterns = [
  /^OMI(?: Studio)?$/,
  /^Open Manuscript Studio$/,
  /^ORCID$/,
  /^ROR$/,
  /^DOI$/,
  /^JATS$/,
  /^DOCX$/,
  /^EPUB$/,
  /^IDML$/,
  /^XTG$/,
  /^MIF$/,
  /^SLA$/,
  /^LaTeX$/,
  /^WebDAV$/,
  /^Nextcloud$/,
  /^Google$/,
  /^Microsoft$/,
  /^ADMIN$/,
  /^OWNER$/,
  /^MEMBER$/,
  /^\d{4}-\d{4}-\d{4}-\d{4}$/,
];

const findings = [];

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(absolute);
      continue;
    }
    if (!sourceExtensions.has(path.extname(entry.name))) continue;
    if (skippedPathFragments.some((fragment) => absolute.includes(fragment))) continue;
    await auditFile(absolute);
  }
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function addFinding(file, source, index, category, text) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return;
  if (intentionalLiteralPatterns.some((pattern) => pattern.test(normalized))) return;
  findings.push({
    file: path.relative(root, file).replaceAll(path.sep, '/'),
    line: lineNumber(source, index),
    category,
    text: normalized,
  });
}

async function auditFile(file) {
  const source = await fs.readFile(file, 'utf8');

  const localePatterns = [
    /locale\s*===\s*['"](?:hu|de)['"]/g,
    /Record\s*<\s*['"]en['"]\s*\|\s*['"]hu['"]\s*\|\s*['"]de['"]/g,
    /copy\s*\[\s*locale[^\]]*\]\s*\?\?\s*copy\.en/g,
    /COPY\s*\[\s*locale[^\]]*\]\s*\?\?/g,
  ];
  for (const pattern of localePatterns) {
    for (const match of source.matchAll(pattern)) {
      addFinding(file, source, match.index ?? 0, 'limited-locale-map', match[0]);
    }
  }

  const propPattern = /\b(?:aria-label|title|placeholder)\s*=\s*["']([^"'{}]*[A-Za-zÀ-žΑ-ωА-я][^"'{}]*)["']/g;
  for (const match of source.matchAll(propPattern)) {
    addFinding(file, source, match.index ?? 0, 'literal-prop', match[1]);
  }

  const jsxTextPattern = />\s*([^<{\n][^<{]*[A-Za-zÀ-žΑ-ωА-я][^<{]*)\s*</g;
  for (const match of source.matchAll(jsxTextPattern)) {
    addFinding(file, source, match.index ?? 0, 'jsx-text', match[1]);
  }

  const userMessagePattern = /(?:window\.confirm|setError|setMessage|setNotice)\(\s*["'`]([^"'`]*[A-Za-zÀ-žΑ-ωА-я][^"'`]*)["'`]\s*\)/g;
  for (const match of source.matchAll(userMessagePattern)) {
    addFinding(file, source, match.index ?? 0, 'literal-message', match[1]);
  }
}

await walk(srcRoot);

findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.category.localeCompare(b.category));

const limited = findings.filter((finding) => finding.category === 'limited-locale-map');
const literal = findings.filter((finding) => finding.category !== 'limited-locale-map');
const files = new Set(findings.map((finding) => finding.file));

console.log('Studio user-interface translation audit');
console.log('=======================================');
console.log(`Candidate files: ${files.size}`);
console.log(`Limited-locale map candidates: ${limited.length}`);
console.log(`Direct user-visible literal candidates: ${literal.length}`);
console.log('');

for (const finding of findings) {
  console.log(`${finding.file}:${finding.line} [${finding.category}] ${finding.text}`);
}

console.log('');
console.log('Audit is report-only while the existing translation debt is being migrated.');
console.log('When the baseline reaches zero, CI should switch this audit to a strict no-new-literals gate.');
