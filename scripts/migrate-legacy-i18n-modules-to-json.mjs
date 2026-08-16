import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getAssetContainerCopy } from '../src/i18n/assetContainer.ts';
import { getCrossReferenceCopy } from '../src/i18n/crossReferences.ts';
import { getCslRenderingCopy } from '../src/i18n/cslRendering.ts';
import { getDocxImportCopy } from '../src/i18n/docxImport.ts';
import { getExportFormatCopy } from '../src/i18n/exportFormats.ts';
import { getFrontMatterCopy } from '../src/i18n/frontMatter.ts';
import { getHelpCopy } from '../src/i18n/help.ts';
import { getHtmlExportCopy } from '../src/i18n/htmlExport.ts';
import { getJatsExportCopy } from '../src/i18n/jatsExport.ts';
import { getNoteCitationCopy } from '../src/i18n/noteCitations.ts';
import { getOrcidLookupCopy } from '../src/i18n/orcidLookup.ts';
import { getPublicationProfileCopy } from '../src/i18n/publicationProfile.ts';
import { getReferenceLookupCopy } from '../src/i18n/referenceLookup.ts';
import { getRichTextCopy } from '../src/i18n/richText.ts';
import { getRorAffiliationCopy } from '../src/i18n/rorAffiliation.ts';
import { getSectionStructureCopy } from '../src/i18n/sectionStructure.ts';
import { getStateDigestCopy } from '../src/i18n/stateDigest.ts';
import { getVisualElementsCopy } from '../src/i18n/visualElements.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const localesDir = path.join(root, 'src', 'i18n', 'locales');

const nativeLegacyLocales = new Set(['en', 'hu', 'de']);

const modules = {
  assetContainer: getAssetContainerCopy,
  crossReferences: getCrossReferenceCopy,
  cslRendering: getCslRenderingCopy,
  docxImport: getDocxImportCopy,
  exportFormats: getExportFormatCopy,
  frontMatter: getFrontMatterCopy,
  help: getHelpCopy,
  htmlExport: getHtmlExportCopy,
  jatsExport: getJatsExportCopy,
  noteCitations: getNoteCitationCopy,
  orcidLookup: getOrcidLookupCopy,
  publicationProfile: getPublicationProfileCopy,
  referenceLookup: getReferenceLookupCopy,
  richText: getRichTextCopy,
  rorAffiliation: getRorAffiliationCopy,
  sectionStructure: getSectionStructureCopy,
  stateDigest: getStateDigestCopy,
  visualElements: getVisualElementsCopy,
};

function flatten(value, prefix = '', out = {}) {
  if (typeof value === 'string') {
    out[prefix] = value;
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out));
    return out;
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  }

  return out;
}

const entries = await fs.readdir(localesDir, { withFileTypes: true });
const locales = entries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (!locales.includes('en')) {
  throw new Error('English JSON locale is required.');
}

const englishModules = Object.fromEntries(
  Object.entries(modules).map(([namespace, getter]) => [namespace, getter('en')]),
);
const englishLegacyKeyCount = Object.keys(flatten(englishModules, 'modules')).length;

let totalFallbackStrings = 0;

for (const locale of locales) {
  const file = path.join(localesDir, locale, 'studio.json');
  const dictionary = JSON.parse(await fs.readFile(file, 'utf8'));

  const sourceLocale = nativeLegacyLocales.has(locale) ? locale : 'en';
  const migratedModules = Object.fromEntries(
    Object.entries(modules).map(([namespace, getter]) => [
      namespace,
      getter(sourceLocale),
    ]),
  );

  dictionary.modules = migratedModules;

  await fs.writeFile(file, `${JSON.stringify(dictionary, null, 2)}\n`, 'utf8');

  const moduleKeyCount = Object.keys(flatten(migratedModules, 'modules')).length;
  if (moduleKeyCount !== englishLegacyKeyCount) {
    throw new Error(
      `${locale}: migrated module key count ${moduleKeyCount} differs from English ${englishLegacyKeyCount}`,
    );
  }

  if (!nativeLegacyLocales.has(locale)) {
    totalFallbackStrings += englishLegacyKeyCount;
  }

  console.log(
    `Migrated ${locale}: ${moduleKeyCount} legacy module strings` +
      (nativeLegacyLocales.has(locale) ? '' : ' (English fallback; translation required)'),
  );
}

console.log('');
console.log(`Legacy namespaces migrated: ${Object.keys(modules).length}`);
console.log(`Legacy strings per locale: ${englishLegacyKeyCount}`);
console.log(`Locales processed: ${locales.length}`);
console.log(`Fallback strings still requiring translation: ${totalFallbackStrings}`);
console.log('Run npm run i18n:validate-json next.');
