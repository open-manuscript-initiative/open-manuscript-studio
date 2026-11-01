import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// First incremental A10 architectural boundary: the semantic model must
// remain usable without a React/editor/store/HTTP/native runtime. Type-only
// references are accepted during migration and must not become value imports.
// This does NOT claim the whole planned A10/ContentCodec refactor is finished.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const forbiddenTopLevel = new Set([
  'app', 'components', 'editor', 'store', 'platform', 'services',
]);
const forbiddenPackages = /^(?:react(?:\/|$)|react-dom(?:\/|$)|zustand(?:\/|$)|@tauri-apps(?:\/|$)|@prisma\/client(?:\/|$)|express(?:\/|$))/;

function normalizedLocalTarget(file, specifier) {
  if (!specifier.startsWith('.')) return null;
  const target = resolve(dirname(resolve(root, file)), specifier);
  const relativePath = relative(resolve(root, 'src'), target).split(sep);
  if (relativePath[0] === '..' || relativePath[0] === '' || relativePath[0] === '.') return null;
  return relativePath;
}

export function classifyRuntimeCoreImport(file, specifier) {
  if (forbiddenPackages.test(specifier)) return 'forbidden runtime package';
  const parts = normalizedLocalTarget(file, specifier);
  if (parts && forbiddenTopLevel.has(parts[0])) {
    return 'semantic model importing ' + parts[0] + ' runtime';
  }
  if (parts && parts[0] === 'server') return 'semantic model importing server runtime';
  return null;
}

export function scanCoreSource(file, source) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const findings = [];
  const check = (specifier, node) => {
    const reason = classifyRuntimeCoreImport(file, specifier);
    if (reason) {
      const location = ast.getLineAndCharacterOfPosition(node.getStart(ast));
      findings.push({ file, line: location.line + 1, import: specifier, reason });
    }
  };
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      // TS permits `import { type Foo }` in addition to `import type { Foo }`.
      // Both are erased from emitted JavaScript and must not be treated as
      // runtime dependency violations.
      const allNamedBindingsTypeOnly = clause?.namedBindings &&
        ts.isNamedImports(clause.namedBindings) &&
        clause.namedBindings.elements.every(item => item.isTypeOnly);
      const isTypeOnly = clause?.isTypeOnly || (allNamedBindingsTypeOnly && !clause.name);
      if (!isTypeOnly) check(node.moduleSpecifier.text, node);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier &&
               ts.isStringLiteral(node.moduleSpecifier)) {
      const allNamesTypeOnly = node.exportClause &&
        ts.isNamedExports(node.exportClause) &&
        node.exportClause.elements.every(item => item.isTypeOnly);
      if (!node.isTypeOnly && !allNamesTypeOnly) check(node.moduleSpecifier.text, node);
    } else if (ts.isImportEqualsDeclaration(node) &&
               ts.isExternalModuleReference(node.moduleReference) &&
               node.moduleReference.expression &&
               ts.isStringLiteral(node.moduleReference.expression)) {
      if (!node.isTypeOnly) check(node.moduleReference.expression.text, node);
    } else if (ts.isCallExpression(node) && node.arguments.length > 0 &&
               ts.isStringLiteral(node.arguments[0])) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
        check(node.arguments[0].text, node);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return findings;
}

export function auditCoreSources(files) {
  return files.flatMap(({ path, text }) => scanCoreSource(path, text))
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

function runCli() {
  const files = execFileSync('git', ['ls-files', '--', 'src/model'], {
    cwd: root, encoding: 'utf8',
  }).split('\n').filter(path => /\.tsx?$/.test(path));
  if (files.length < 10) {
    console.error('Refusing incomplete core boundary scan: fewer than 10 tracked semantic-model files.');
    process.exitCode = 2;
    return;
  }
  const findings = auditCoreSources(files.map(path => ({
    path, text: readFileSync(resolve(root, path), 'utf8'),
  })));
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`${finding.file}:${finding.line}: ${finding.reason}: ${finding.import}`);
    }
    console.error(`OMI A10 core boundary: ${findings.length} forbidden runtime import(s).`);
    process.exitCode = 1;
  } else {
    console.log(`OMI A10 incremental core boundary: PASS (${files.length} semantic-model files; no forbidden UI/editor/store/native/network value imports).`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
