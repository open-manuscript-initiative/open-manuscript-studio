import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

import { getAccountDeletionCopy } from '../src/i18n/accountDeletionTranslations.ts';
import { getAccountPanelCopy } from '../src/i18n/accountPanelTranslations.ts';
import { getAssetContainerCopy } from '../src/i18n/assetContainer.ts';
import { authSupplementalTranslations } from '../src/i18n/authSupplementalTranslations.ts';
import { authTranslations } from '../src/i18n/authTranslations.ts';
import { getCentralAdministrationCopy } from '../src/i18n/centralAdministrationTranslations.ts';
import { getCloudOAuthCopy } from '../src/i18n/cloudOAuthTranslations.ts';
import { getCloudStorageCopy } from '../src/i18n/cloudStorageTranslations.ts';
import { getCrossReferenceCopy } from '../src/i18n/crossReferences.ts';
import { getCslRenderingCopy } from '../src/i18n/cslRendering.ts';
import { getCurrentStudyNotesCopy } from '../src/i18n/currentStudyNotes.ts';
import { getDocxImportCopy } from '../src/i18n/docxImport.ts';
import { getExportFormatCopy } from '../src/i18n/exportFormats.ts';
import { getFrontMatterCopy } from '../src/i18n/frontMatter.ts';
import { getHeaderSupplementalCopy } from '../src/i18n/headerSupplementalTranslations.ts';
import { getLocalizedHelpCopy } from '../src/i18n/helpResolver.ts';
import {
  getDetailedHelpLabels,
  getDetailedHelpTopic,
} from '../src/i18n/helpDetailedAll.ts';
import { getHtmlExportCopy } from '../src/i18n/htmlExport.ts';
import { getInstitutionalProfilesCopy } from '../src/i18n/institutionalProfilesTranslations.ts';
import { getJatsExportCopy } from '../src/i18n/jatsExport.ts';
import { getLinkedIdentitiesCopy } from '../src/i18n/linkedIdentitiesTranslations.ts';
import { getLocalFileLabels } from '../src/i18n/nativeStorageTranslations.ts';
import { getNoteCitationCopy } from '../src/i18n/noteCitations.ts';
import { getOrcidLookupCopy } from '../src/i18n/orcidLookup.ts';
import { getPersonalPublishingCredentialsCopy } from '../src/i18n/personalPublishingCredentials.ts';
import { getPublicationProfileCopy } from '../src/i18n/publicationProfile.ts';
import { getReferenceLookupCopy } from '../src/i18n/referenceLookup.ts';
import { getRichTextCopy } from '../src/i18n/richText.ts';
import { getRorAffiliationCopy } from '../src/i18n/rorAffiliation.ts';
import { getSectionStructureCopy } from '../src/i18n/sectionStructure.ts';
import { getStateDigestCopy } from '../src/i18n/stateDigest.ts';
import { getStudioMenuSupplementalCopy } from '../src/i18n/studioMenuSupplementalTranslations.ts';
import { getVisualElementsCopy } from '../src/i18n/visualElements.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const pendingRoot = path.join(root, 'locale', 'pending');
const supplementalRoot = path.join(pendingRoot, 'supplemental');

const deeplMap = JSON.parse(
  await fs.readFile(path.join(pendingRoot, 'deepl-language-map.json'), 'utf8'),
);
const terminology = JSON.parse(
  await fs.readFile(path.join(root, 'locale', 'terminology.json'), 'utf8'),
);
const legacyModuleTranslations = new Map();

const maintainedLocales = (await fs.readdir(path.join(root, 'locale'), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && entry.name !== 'pending')
  .map((entry) => entry.name)
  .filter((locale) => locale !== 'en')
  .filter((locale) => locale in deeplMap.languages)
  .filter((locale) => locale !== 'completion-overlays')
  .sort();

for (const locale of maintainedLocales) {
  const file = path.join(root, 'scripts', 'i18n-module-translations', `${locale}.json`);
  try {
    legacyModuleTranslations.set(locale, JSON.parse(await fs.readFile(file, 'utf8')));
  } catch {
    // A locale without a legacy module file simply has no prefilled values.
  }
}

const surfaces = [
  ['accountDeletion', 'src/i18n/accountDeletionTranslations.ts', getAccountDeletionCopy],
  ['accountPanel', 'src/i18n/accountPanelTranslations.ts', getAccountPanelCopy],
  ['assetContainer', 'src/i18n/assetContainer.ts', getAssetContainerCopy],
  ['centralAdministration', 'src/i18n/centralAdministrationTranslations.ts', getCentralAdministrationCopy],
  ['cloudOAuth', 'src/i18n/cloudOAuthTranslations.ts', getCloudOAuthCopy],
  ['cloudStorage', 'src/i18n/cloudStorageTranslations.ts', getCloudStorageCopy],
  ['crossReferences', 'src/i18n/crossReferences.ts', getCrossReferenceCopy],
  ['cslRendering', 'src/i18n/cslRendering.ts', getCslRenderingCopy],
  ['currentStudyNotes', 'src/i18n/currentStudyNotes.ts', getCurrentStudyNotesCopy],
  ['docxImport', 'src/i18n/docxImport.ts', getDocxImportCopy],
  ['exportFormats', 'src/i18n/exportFormats.ts', getExportFormatCopy],
  ['frontMatter', 'src/i18n/frontMatter.ts', getFrontMatterCopy],
  ['header', 'src/i18n/headerSupplementalTranslations.ts', getHeaderSupplementalCopy],
  ['help', 'src/i18n/helpResolver.ts', getLocalizedHelpCopy],
  ['htmlExport', 'src/i18n/htmlExport.ts', getHtmlExportCopy],
  ['institutionalProfiles', 'src/i18n/institutionalProfilesTranslations.ts', getInstitutionalProfilesCopy],
  ['jatsExport', 'src/i18n/jatsExport.ts', getJatsExportCopy],
  ['linkedIdentities', 'src/i18n/linkedIdentitiesTranslations.ts', getLinkedIdentitiesCopy],
  ['noteCitations', 'src/i18n/noteCitations.ts', getNoteCitationCopy],
  ['orcidLookup', 'src/i18n/orcidLookup.ts', getOrcidLookupCopy],
  ['personalPublishingCredentials', 'src/i18n/personalPublishingCredentials.ts', getPersonalPublishingCredentialsCopy],
  ['publicationProfile', 'src/i18n/publicationProfile.ts', getPublicationProfileCopy],
  ['referenceLookup', 'src/i18n/referenceLookup.ts', getReferenceLookupCopy],
  ['richText', 'src/i18n/richText.ts', getRichTextCopy],
  ['rorAffiliation', 'src/i18n/rorAffiliation.ts', getRorAffiliationCopy],
  ['sectionStructure', 'src/i18n/sectionStructure.ts', getSectionStructureCopy],
  ['stateDigest', 'src/i18n/stateDigest.ts', getStateDigestCopy],
  ['studioMenu', 'src/i18n/studioMenuSupplementalTranslations.ts', getStudioMenuSupplementalCopy],
  ['visualElements', 'src/i18n/visualElements.ts', getVisualElementsCopy],
];

const directScanRoots = [
  path.join(root, 'src', 'App.tsx'),
  path.join(root, 'src', 'auth'),
  path.join(root, 'src', 'components'),
  path.join(root, 'src', 'editor'),
  path.join(root, 'src', 'mobile'),
];
const directAttributeNames = new Set(['alt', 'aria-description', 'aria-label', 'placeholder', 'title']);
const directMessageNames = new Set([
  'alert',
  'confirm',
  'setError',
  'setMessage',
  'setNotice',
  'setStatus',
  'setSuccess',
  'setWarning',
]);

const surfaceNotes = [
  {
    id: 'global-navigation-and-accessibility',
    files: [
      'src/App.tsx',
      'src/components/DesktopDocumentOutline.tsx',
      'src/components/Footer.tsx',
      'src/components/LazyBlockEditor.tsx',
      'src/components/SelectionActionToolbar.tsx',
      'src/mobile/navigation/MobileLayout.tsx',
    ],
    action: 'Route remaining loading, failure, footer and accessibility literals through shared i18n.',
  },
  {
    id: 'authentication-and-recovery',
    files: [
      'src/auth/LoginPage.tsx',
      'src/auth/RegisterPage.tsx',
      'src/auth/PasswordRecoveryPage.tsx',
      'src/auth/PendingExternalLaunchNotice.tsx',
      'src/store/authStore.ts',
    ],
    action: 'Complete login, registration, invitation, recovery and authorization-error copy.',
  },
  {
    id: 'identity-and-language-settings',
    files: [
      'src/components/AuthorSignatureControl.tsx',
      'src/components/AuthorSignaturePanel.tsx',
      'src/components/ContentLanguageSettings.tsx',
      'src/components/ManuscriptLanguageField.tsx',
      'src/components/OrcidEnvironmentBadge.tsx',
      'src/model/manuscriptLanguage.ts',
    ],
    action: 'Localize identity, ORCID/signature and manuscript-language settings.',
  },
  {
    id: 'integrations-proofreading-and-agents',
    files: [
      'src/components/IntegrationsPanel.tsx',
      'src/components/IntegrationExecutionWorkspace.tsx',
      'src/components/SelectionIntegrationDialog.tsx',
      'src/components/OjsAssignmentPanel.tsx',
      'src/components/ProofreadingSettings.tsx',
      'src/components/ProofreadingSuggestionCard.tsx',
      'src/editor/useEditorProofreading.ts',
    ],
    action: 'Move DeepL, OJS/OMP, proofreading, AI and OMI-agent UI copy into locale-aware dictionaries.',
  },
  {
    id: 'review-and-editorial-workflows',
    files: [
      'src/components/EditorReviewMode.tsx',
      'src/components/ReviewPortal.tsx',
    ],
    action: 'Complete review status, recommendation, privacy and double-blind workflow wording.',
  },
  {
    id: 'editor-metadata-and-publishing',
    files: [
      'src/components/SearchReplaceOverlay.tsx',
      'src/components/EditorPane.tsx',
      'src/components/ScholarlyMetadataPanel.tsx',
      'src/components/PublisherExportStylesheetPanel.tsx',
      'src/components/PublisherPrintStylesheetPanel.tsx',
      'src/components/PublisherProfileEditor.tsx',
    ],
    action: 'Complete editor controls, metadata, notes, citations, DOCX, history and publication-style copy.',
  },
  {
    id: 'output-document-language',
    files: [
      'src/services/exportEpub.ts',
      'src/services/exportHtml.ts',
      'src/services/exportJats.ts',
      'src/services/exportDocx.ts',
      'src/services/publicationStyleExport.ts',
    ],
    action: 'Treat generated-document labels separately and derive them from manuscript/publication language.',
  },
];

function flatten(value, prefix = '') {
  if (typeof value === 'string') return [[prefix, value]];
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => flatten(child, `${prefix}[${index}]`));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return flatten(child, next);
  });
}

function authCopy(locale) {
  const fallback = authTranslations.en;
  const base = authTranslations[locale] ?? {};
  const supplemental = authSupplementalTranslations[locale] ?? {};
  return Object.fromEntries(
    Object.keys(fallback).map((key) => [
      key,
      supplemental[key] ?? base[key] ?? fallback[key],
    ]),
  );
}

function detailedHelpCopy(locale) {
  return {
    labels: getDetailedHelpLabels(locale),
    topics: Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => {
        const number = String(index + 1);
        return [number, getDetailedHelpTopic(locale, number)];
      }),
    ),
  };
}

function valueForSurface(id, getter, locale) {
  if (id === 'auth') return authCopy(locale);
  if (id === 'nativeStorageDesktop') return getLocalFileLabels(locale, 'desktop');
  if (id === 'nativeStorageAndroid') return getLocalFileLabels(locale, 'android');
  if (id === 'detailedHelp') return detailedHelpCopy(locale);
  return getter(locale);
}

function protectedTerms(source) {
  const terms = new Set(
    terminology.protectedTerms.filter((term) => source.includes(term)),
  );
  for (const placeholder of source.match(/\{[^}]+\}/g) ?? []) terms.add(placeholder);
  for (const url of source.match(/https?:\/\/[^\s)]+/g) ?? []) terms.add(url);
  return [...terms];
}

function isIdentityOnly(source) {
  const value = source.trim();
  if (!value) return true;
  if (terminology.protectedTerms.includes(value)) return true;
  if (/^[A-Z0-9][A-Z0-9._/+:-]*$/.test(value) && value.length > 1) return true;
  if (/^\d{4}-\d{4}-\d{4}-\d{4}$/.test(value)) return true;
  return false;
}

function normalizedText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function getNestedValue(value, key) {
  const parts = key.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let current = value;
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) return undefined;
    current = current[part];
  }
  return current;
}

function getLegacyTranslation(locale, sourceEntry) {
  const legacy = legacyModuleTranslations.get(locale);
  if (!legacy || sourceEntry.kind !== 'coded-copy') return undefined;
  const prefix = `/supplemental/${sourceEntry.surface}/`;
  if (!sourceEntry.key.startsWith(prefix)) return undefined;
  const pathInSurface = sourceEntry.key.slice(prefix.length);
  const container = legacy[sourceEntry.surface];
  const value = getNestedValue(container, pathInSurface);
  return typeof value === 'string' && value.trim() && value !== sourceEntry.source
    ? value
    : undefined;
}

function renderQueue(payload) {
  const { entries, ...metadata } = payload;
  const header = JSON.stringify(metadata, null, 2).slice(0, -1);
  const renderedEntries = entries.map((entry) => `    ${JSON.stringify(entry)}`).join(',\n');
  return `${header},\n  "entries": [\n${renderedEntries}\n  ]\n}\n`;
}

function literalText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function isJsxChildExpression(node) {
  let current = node.parent;
  while (current && !ts.isJsxExpression(current) && !ts.isJsxAttribute(current)) {
    current = current.parent;
  }
  if (!current || !ts.isJsxExpression(current)) return false;
  return ts.isJsxElement(current.parent) || ts.isJsxFragment(current.parent);
}

async function collectSourceFiles(directory, output = []) {
  const stats = await fs.stat(directory);
  if (stats.isFile()) {
    if (path.extname(directory) === '.ts' || path.extname(directory) === '.tsx') output.push(directory);
    return output;
  }
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectSourceFiles(child, output);
    else if (entry.isFile() && (child.endsWith('.ts') || child.endsWith('.tsx'))) output.push(child);
  }
  return output;
}

async function collectDirectUiStrings() {
  const files = [];
  for (const rootPath of directScanRoots) await collectSourceFiles(rootPath, files);
  const findings = [];
  const seen = new Set();

  function add(sourceFile, node, source, kind) {
    const text = normalizedText(source);
    if (text.length < 2 || isIdentityOnly(text)) return;
    if (!/[A-Za-zÀ-žΑ-ωА-я一-鿿]/u.test(text)) return;
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const relative = path.relative(root, sourceFile.fileName).replaceAll(path.sep, '/');
    const key = `${relative}:${position.line + 1}:${position.character + 1}:${kind}:${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({
      key: `/supplemental/direct/${relative}:${position.line + 1}:${position.character + 1}`,
      source: text,
      kind: 'direct-ui-literal',
      surface: 'direct-ui-literals',
      sourceFile: relative,
      protectedTerms: protectedTerms(text),
    });
  }

  for (const file of files.sort()) {
    const source = await fs.readFile(file, 'utf8');
    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    function visit(node) {
      if (ts.isJsxText(node)) add(sourceFile, node, node.getText(sourceFile), 'jsx-text');

      if (ts.isJsxAttribute(node)) {
        const name = node.name.getText(sourceFile);
        if (directAttributeNames.has(name)) {
          const initializer = node.initializer;
          if (initializer) {
            const direct = literalText(initializer);
            if (direct !== null) add(sourceFile, initializer, direct, `attribute:${name}`);
            if (ts.isJsxExpression(initializer) && initializer.expression) {
              const expressionText = literalText(initializer.expression);
              if (expressionText !== null) add(sourceFile, initializer.expression, expressionText, `attribute:${name}`);
            }
          }
        }
      }

      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        const name = ts.isIdentifier(expression)
          ? expression.text
          : ts.isPropertyAccessExpression(expression)
            ? expression.name.text
            : '';
        if (directMessageNames.has(name)) {
          for (const argument of node.arguments) {
            const direct = literalText(argument);
            if (direct !== null) add(sourceFile, argument, direct, `message:${name}`);
          }
        }
      }

      if (ts.isStringLiteral(node) && isJsxChildExpression(node)) {
        add(sourceFile, node, node.text, 'jsx-expression');
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return findings.sort((left, right) => left.key.localeCompare(right.key));
}

const surfaceDefinitions = [
  ...surfaces.map(([id, sourceFile, getter]) => ({ id, sourceFile, getter })),
  { id: 'auth', sourceFile: 'src/i18n/authTranslations.ts', getter: null },
  { id: 'nativeStorageDesktop', sourceFile: 'src/i18n/nativeStorageTranslations.ts', getter: null },
  { id: 'nativeStorageAndroid', sourceFile: 'src/i18n/nativeStorageTranslations.ts', getter: null },
  { id: 'detailedHelp', sourceFile: 'src/i18n/helpDetailedAll.ts', getter: null },
];

const directUiStrings = await collectDirectUiStrings();
const allSourceEntries = [];
for (const surface of surfaceDefinitions) {
  const sourceValue = valueForSurface(surface.id, surface.getter, 'en');
  for (const [key, source] of flatten(sourceValue)) {
    if (isIdentityOnly(source)) continue;
    allSourceEntries.push({
      key: `/supplemental/${surface.id}/${key}`,
      source,
      kind: 'coded-copy',
      surface: surface.id,
      sourceFile: surface.sourceFile,
      protectedTerms: protectedTerms(source),
    });
  }
}

for (const finding of directUiStrings) allSourceEntries.push(finding);

const uniqueSourceEntries = new Map();
for (const entry of allSourceEntries) uniqueSourceEntries.set(entry.key, entry);

await fs.mkdir(supplementalRoot, { recursive: true });
const status = {
  generatedFrom: 'scripts/export-pending-supplemental-translations.mjs',
  referenceLocale: 'en',
  scope: 'All locale/<locale>/studio.po catalogues currently present in the repository, excluding en.',
  directUiLiteralCount: directUiStrings.length,
  codedCopySurfaceCount: surfaceDefinitions.length,
  surfaceNotes,
  locales: {},
};

for (const locale of maintainedLocales) {
  const targetBySurface = new Map();
  for (const surface of surfaceDefinitions) {
    targetBySurface.set(
      surface.id,
      new Map(flatten(valueForSurface(surface.id, surface.getter, locale))),
    );
  }

  const entries = [];
  const surfaceSummary = {};
  const pendingSurfaceSummary = {};
  const existingTranslationSurfaceSummary = {};
  for (const sourceEntry of uniqueSourceEntries.values()) {
    if (sourceEntry.kind === 'direct-ui-literal') {
      entries.push({ ...sourceEntry, translation: '' });
      surfaceSummary[sourceEntry.surface] = (surfaceSummary[sourceEntry.surface] ?? 0) + 1;
      pendingSurfaceSummary[sourceEntry.surface] = (pendingSurfaceSummary[sourceEntry.surface] ?? 0) + 1;
      continue;
    }

    const surface = surfaceDefinitions.find((item) => item.id === sourceEntry.surface);
    const targetValue = targetBySurface.get(sourceEntry.surface)?.get(
      sourceEntry.key.slice(`/supplemental/${sourceEntry.surface}/`.length),
    );
    if (!surface || targetValue !== undefined && targetValue !== sourceEntry.source) continue;

    const existingTranslation = getLegacyTranslation(locale, sourceEntry);
    entries.push({
      ...sourceEntry,
      translation: existingTranslation ?? '',
      ...(existingTranslation
        ? { translationSource: `scripts/i18n-module-translations/${locale}.json` }
        : {}),
    });
    surfaceSummary[sourceEntry.surface] = (surfaceSummary[sourceEntry.surface] ?? 0) + 1;
    if (existingTranslation) {
      existingTranslationSurfaceSummary[sourceEntry.surface] =
        (existingTranslationSurfaceSummary[sourceEntry.surface] ?? 0) + 1;
    } else {
      pendingSurfaceSummary[sourceEntry.surface] = (pendingSurfaceSummary[sourceEntry.surface] ?? 0) + 1;
    }
  }

  entries.sort((left, right) => left.key.localeCompare(right.key));
  try {
    const previous = JSON.parse(
      await fs.readFile(path.join(supplementalRoot, `${locale}.json`), 'utf8'),
    );
    const previousByKey = new Map(
      (previous.entries ?? []).map((entry) => [entry.key, entry]),
    );
    for (const entry of entries) {
      const previousEntry = previousByKey.get(entry.key);
      if (typeof previousEntry?.translation === 'string' && previousEntry.translation.trim()) {
        entry.translation = previousEntry.translation;
        if (previousEntry.translationSource) entry.translationSource = previousEntry.translationSource;
      }
    }
  } catch {
    // No previous supplemental queue exists; use the generated carry-forward values.
  }

  const language = deeplMap.languages[locale];
  const payload = {
    locale,
    referenceLocale: 'en',
    generatedFrom: 'source-level coded dictionaries and direct UI literals',
    translationService: 'DeepL',
    deepL: language,
    entryCount: entries.length,
    pendingCount: entries.filter((entry) => !entry.translation.trim()).length,
    existingTranslationCount: entries.filter((entry) => entry.translation.trim()).length,
    surfaceSummary,
    pendingSurfaceSummary,
    existingTranslationSurfaceSummary,
    instructions: [
      'Translate only the translation field.',
      'Do not change key, source, kind, surface or sourceFile.',
      'Preserve protectedTerms verbatim.',
      'Preserve placeholders, URLs, identifiers, file extensions and standard names.',
      'These entries are source-level debt; they are intentionally separate from the 722-entry PO queue.',
    ],
    entries,
  };

  await fs.writeFile(
    path.join(supplementalRoot, `${locale}.json`),
    renderQueue(payload),
    'utf8',
  );
  status.locales[locale] = {
    appName: language.appName,
    deepLName: language.deepLName,
    deepLCode: language.code,
    deepLApiTargetCode: language.apiTargetCode,
    deepLSupported: language.supported,
    entryCount: entries.length,
    pendingCount: entries.filter((entry) => !entry.translation.trim()).length,
    existingTranslationCount: entries.filter((entry) => entry.translation.trim().length > 0).length,
    surfaceSummary,
    pendingSurfaceSummary,
    existingTranslationSurfaceSummary,
  };
  console.log(`${locale}: ${entries.length} supplemental entries`);
}

await fs.writeFile(
  path.join(supplementalRoot, 'status.json'),
  `${JSON.stringify(status, null, 2)}\n`,
  'utf8',
);

console.log(`\nExported ${maintainedLocales.length} supplemental locale queues.`);
console.log(`Coded-copy source entries: ${uniqueSourceEntries.size - directUiStrings.length}`);
console.log(`Direct UI literal candidates: ${directUiStrings.length}`);
