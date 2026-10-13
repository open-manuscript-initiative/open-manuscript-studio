import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { getModuleShellCopy } from '../src/modules/moduleShellTranslations.ts';
import { normalizeModuleLocale } from '../src/modules/moduleLocale.ts';
import { appendHealthResearchHelp } from '../src/i18n/helpHealthResearch.ts';
import { appendMathematicsHelp } from '../src/i18n/helpMathematics.ts';

const locales = ['en', 'de', 'hu'] as const;
const emptyHelp = { topics: [] };

test('research module shell exposes every registered module in English', () => {
  const copies = [getModuleShellCopy('en')];
  const moduleIds = Object.keys(copies[0]!.modules).sort();

  for (const copy of copies) {
    assert.deepEqual(Object.keys(copy.modules).sort(), moduleIds);
    for (const id of moduleIds) {
      assert.ok(copy.modules[id]?.title.trim(), `missing title: ${id}`);
      assert.ok(copy.modules[id]?.description.trim(), `missing description: ${id}`);
      assert.ok(copy.modules[id]?.overview.trim(), `missing overview: ${id}`);
    }
  }

  assert.match(copies[0]!.modules['org.omi.mathematics']!.title, /Mathematics/);
});

test('research module locale normalization keeps English as the default', () => {
  assert.equal(normalizeModuleLocale(undefined), 'en');
  assert.equal(normalizeModuleLocale('en-US'), 'en');
  assert.equal(normalizeModuleLocale('de-DE'), 'de');
  assert.equal(normalizeModuleLocale('hu_HU'), 'hu');
});

test('mathematics and health research help are available in all three base languages', () => {
  const expectedMath = {
    en: 'Mathematics module and LaTeX equations',
    de: 'Mathematikmodul und LaTeX-Formeln',
    hu: 'Matematikai modul és LaTeX-képletek',
  } as const;

  const expectedHealth = {
    en: 'Psychology / Medical and Health Sciences',
    de: 'Psychologie / Medizin und Gesundheitswissenschaften',
    hu: 'Pszichológia / Orvostudomány és egészségtudomány',
  } as const;

  for (const locale of locales) {
    const math = appendMathematicsHelp(locale, emptyHelp);
    const health = appendHealthResearchHelp(locale, emptyHelp);
    assert.equal(math.topics[0]?.title, expectedMath[locale]);
    assert.equal(health.topics[0]?.title, expectedHealth[locale]);
    assert.ok(math.topics[0]?.body.trim());
    assert.ok(health.topics[0]?.body.trim());
  }
});

test('research module panels read their copy from the shared PO catalog', async () => {
  for (const path of ["src/modules/moduleShellTranslations.ts","src/modules/ResearchCatalogSearchPanel.tsx","src/modules/ResearchModuleInsertPanel.tsx","src/modules/archaeology/ArchaeologyPanel.tsx","src/modules/corpus-linguistics/CorpusLinguisticsPanel.tsx","src/modules/critical-text-edition/CriticalTextEditionPanel.tsx","src/modules/history-archives/HistoryArchivesSourcesPanel.tsx","src/modules/history-archives/EleveltarSearchPanel.tsx","src/modules/history-archives/RomanianArchivesSearchPanel.tsx","src/modules/legal-sources/LegalSourcesPanel.tsx","src/modules/religious-texts/ReligiousTextsPanel.tsx","src/modules/research-databases/ResearchDatabasePanel.tsx","src/modules/research-reproducibility/ResearchReproducibilityPanel.tsx","src/modules/social-research-methods/SocialResearchMethodsPanel.tsx","src/modules/statistical-analysis/StatisticalAnalysisPanel.tsx","src/modules/mathematics/EquationEditor.tsx","src/modules/cultural-heritage/CulturalHeritagePanel.tsx","src/modules/experimental-laboratory/ExperimentalLaboratoryPanel.tsx","src/modules/musicology/MusicologyPanel.tsx","src/modules/spatial-research/SpatialResearchPanel.tsx","src/modules/health-research/copy.ts","src/modules/health-research/searchCopy.ts","src/modules/ModuleManagerPanel.tsx","src/modules/mathematics/MathematicsPanel.tsx"]) {
    const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.match(source, /getResearchModuleCopyByLocale/, `${path} should use the PO-backed catalog`);
  }
});
