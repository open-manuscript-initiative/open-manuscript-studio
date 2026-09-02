import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildContinuousManuscriptDocument,
  projectContinuousManuscriptDocument,
} from '../src/editor/continuousManuscriptDocument.ts';
import { buildCaptionListEntries } from '../src/model/generatedLists.ts';
import {
  createEmptyStudy,
  partitionManuscriptStudies,
  replaceManuscriptStudySections,
} from '../src/model/sectionStructure.ts';
import { buildTableOfContentsEntries } from '../src/model/tableOfContents.ts';
import type { OmiBlock, OmiSection } from '../src/types/omi.ts';

test('one top-level study and all of its subsections form one editor document', () => {
  const sections = volumeSections();
  const studies = partitionManuscriptStudies(sections);

  assert.deepEqual(
    studies.map((study) => study.sections.map((section) => section.id)),
    [['study-a', 'study-a-1'], ['study-b']],
  );

  const firstDocument = buildContinuousManuscriptDocument(studies[0]!.sections);
  assert.deepEqual(
    firstDocument.content?.map((node) => node.attrs?.omiSectionId),
    ['study-a', 'study-a', 'study-a-1', 'study-a-1'],
  );
  assert.equal(
    firstDocument.content?.some((node) => node.attrs?.omiSectionId === 'study-b'),
    false,
  );
});

test('projecting one study leaves every other study untouched', () => {
  const sections = volumeSections();
  const firstStudy = partitionManuscriptStudies(sections)[0]!;
  const document = buildContinuousManuscriptDocument(firstStudy.sections);
  const paragraph = document.content?.find(
    (node) => node.attrs?.omiBlockId === 'paragraph-a',
  );
  assert.ok(paragraph);
  paragraph.content = [{ type: 'text', text: 'Edited only in study A' }];

  const projected = projectContinuousManuscriptDocument(
    document,
    firstStudy.sections,
  );
  const merged = replaceManuscriptStudySections(
    sections,
    firstStudy.rootSectionId,
    projected,
  );

  assert.equal(merged[2], sections[2]);
  assert.match(merged[0]!.blocks[1]!.content, /Edited only in study A/);
  assert.deepEqual(merged[2], sections[2]);
});

test('a new study starts with its own editable heading and body', () => {
  const created = createEmptyStudy('study-new', 'heading-new', 'body-new');

  assert.equal(created.blocks[0]?.type, 'heading');
  assert.equal(created.blocks[1]?.type, 'paragraph');
  assert.match(created.blocks[0]!.content, /"level":1/);
  assert.equal(partitionManuscriptStudies([created])[0]?.rootSectionId, 'study-new');
});

test('table of contents and caption lists aggregate the complete volume', () => {
  const sections = volumeSections();
  sections[0]!.blocks.push(figure('figure-a', 'First study figure'));
  sections[2]!.blocks.push(figure('figure-b', 'Second study figure'));

  const toc = buildTableOfContentsEntries(sections, {
    id: 'toc',
    title: 'Contents',
    minLevel: 1,
    maxLevel: 3,
    hyperlinks: true,
    useOutlineLevels: true,
  });
  const figures = buildCaptionListEntries(sections, 'figures');

  assert.deepEqual(
    toc.map((entry) => entry.sectionId),
    ['study-a', 'study-a-1', 'study-b'],
  );
  assert.deepEqual(
    figures.map((entry) => entry.blockId),
    ['figure-a', 'figure-b'],
  );
  assert.deepEqual(
    figures.map((entry) => entry.label),
    ['Figure 1. First study figure', 'Figure 2. Second study figure'],
  );
});

test('the UI mounts one Tiptap host per study and supports multiple focus targets', () => {
  const editorSource = readFileSync(
    new URL('../src/components/ContinuousManuscriptEditor.tsx', import.meta.url),
    'utf8',
  );
  const focusRegistrySource = readFileSync(
    new URL('../src/editor/blockFocusRegistry.ts', import.meta.url),
    'utf8',
  );
  const blockEditorSource = readFileSync(
    new URL('../src/components/BlockEditor.tsx', import.meta.url),
    'utf8',
  );
  const structurePanelSource = readFileSync(
    new URL('../src/components/SectionStructurePanel.tsx', import.meta.url),
    'utf8',
  );
  const documentMenuSource = readFileSync(
    new URL('../src/components/StudioMenu.tsx', import.meta.url),
    'utf8',
  );
  const closedWorkspaceSource = readFileSync(
    new URL('../src/components/ClosedDocumentScreen.tsx', import.meta.url),
    'utf8',
  );
  const newDocumentSource = readFileSync(
    new URL('../src/components/NewDocumentActions.tsx', import.meta.url),
    'utf8',
  );

  assert.match(editorSource, /studies\.map/);
  assert.match(editorSource, /blockId=\{`omi-study-\$\{study\.rootSectionId\}`\}/);
  assert.match(editorSource, /stageInsertTopLevelSection\(\)/);
  assert.match(editorSource, /importOmiDocumentAsStudy\(file\)/);
  assert.match(focusRegistrySource, /const continuousEditors = new Set<Editor>\(\)/);
  assert.match(focusRegistrySource, /for \(const continuousEditor of continuousEditors\)/);
  assert.match(blockEditorSource, /selectSection\(active\.sectionId\)/);
  assert.match(structurePanelSource, /requestBlockEditorFocus\(firstBlockId, 'start'\)/);
  assert.match(documentMenuSource, /<NewDocumentActions onCreated=\{onCreated\} \/>/);
  assert.match(closedWorkspaceSource, /<NewDocumentActions variant="empty-workspace" \/>/);
  assert.match(newDocumentSource, /Új OMI tanulmány/);
  assert.match(newDocumentSource, /Új OMI monográfia/);
  assert.match(newDocumentSource, /Új OMI tanulmánykötet/);
});

function volumeSections(): OmiSection[] {
  return [
    section('study-a', 'Study A', [
      textBlock('heading-a', 'heading', 'Study A', 1),
      textBlock('paragraph-a', 'paragraph', 'Alpha'),
    ]),
    {
      ...section('study-a-1', 'Study A subsection', [
        textBlock('heading-a-1', 'heading', 'Study A subsection', 2),
        textBlock('paragraph-a-1', 'paragraph', 'Subsection'),
      ]),
      parentSectionId: 'study-a',
    } as OmiSection,
    section('study-b', 'Study B', [
      textBlock('heading-b', 'heading', 'Study B', 1),
      textBlock('paragraph-b', 'paragraph', 'Beta'),
    ]),
  ];
}

function section(id: string, title: string, blocks: OmiBlock[]): OmiSection {
  return { id, title, blocks };
}

function textBlock(
  id: string,
  type: 'heading' | 'paragraph',
  text: string,
  level?: number,
): OmiBlock {
  return {
    id,
    type,
    content: JSON.stringify({
      type: 'doc',
      content: [{
        type,
        ...(level ? { attrs: { level } } : {}),
        content: [{ type: 'text', text }],
      }],
    }),
  };
}

function figure(id: string, caption: string): OmiBlock {
  return {
    id,
    type: 'image',
    content: '',
    visual: {
      kind: 'image',
      src: 'data:image/png;base64,AA==',
      mediaType: 'image/png',
      alt: '',
      caption,
    },
  };
}
