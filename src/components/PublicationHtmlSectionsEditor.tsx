import type { JSONContent } from '@tiptap/core';
import { useMemo, type CSSProperties } from 'react';

import { stageContinuousDocumentChange } from '../app/continuousDocumentActions';
import { useStudioStore } from '../app/useStudioStore';
import {
  buildContinuousManuscriptDocument,
  projectContinuousManuscriptDocument,
} from '../editor/continuousManuscriptDocument';
import {
  getParentSectionId,
  withParentSectionId,
} from '../model/sectionStructure';
import {
  DEFAULT_SECTION_COLUMN_GAP_MM,
  DEFAULT_TAB_INTERVAL_MM,
  normalizeColumnCount,
} from '../model/sectionLayout';
import type { OmiSection } from '../types/omi';
import { BlockEditor } from './BlockEditor';

interface PublicationHtmlSectionsEditorProps {
  sections: readonly OmiSection[];
  sectionNumbers: ReadonlyMap<string, string>;
  paragraphStyleNextById: ReadonlyMap<string, string>;
  defaultParagraphStyleId: string;
  manuscriptLanguage: string;
}

export function PublicationHtmlSectionsEditor({
  sections,
  sectionNumbers,
  paragraphStyleNextById,
  defaultParagraphStyleId,
  manuscriptLanguage,
}: PublicationHtmlSectionsEditorProps) {
  const document = useMemo(
    () => buildContinuousManuscriptDocument(
      sections,
      sectionNumbers,
      paragraphStyleNextById,
      defaultParagraphStyleId,
    ),
    [
      defaultParagraphStyleId,
      paragraphStyleNextById,
      sectionNumbers,
      sections,
    ],
  );

  return (
    <div className="publication-html-sections-editor">
      {sections.map((section) => {
        const columns = normalizeColumnCount(section.layout?.columns);
        const columnGapMm = section.layout?.columnGapMm
          ?? DEFAULT_SECTION_COLUMN_GAP_MM;
        const tabIntervalMm = section.layout?.tabStopsMm?.[0]
          ?? DEFAULT_TAB_INTERVAL_MM;
        const sectionDocument = extractSectionDocument(document, section.id);
        const layoutStyle = {
          '--omi-section-columns': String(columns),
          '--omi-section-column-gap': `${columnGapMm}mm`,
          '--omi-section-tab-size': `${tabIntervalMm}mm`,
        } as CSSProperties;

        return (
          <section
            className="publication-html-section-editor"
            data-publication-section-id={section.id}
            data-publication-columns={columns}
            style={layoutStyle}
            key={section.id}
          >
            <BlockEditor
              blockId={`omi-publication-html-section-${section.id}`}
              blockType="manuscript"
              content={JSON.stringify(sectionDocument)}
              onUpdate={(_documentId, content) => updateSection(section.id, content)}
              manuscriptLanguage={manuscriptLanguage}
              className="publication-layout-section-editor"
              continuous
              proofingMode="editor"
            />
          </section>
        );
      })}
    </div>
  );
}

function updateSection(sectionId: string, content: string): void {
  let parsed: JSONContent;
  try {
    parsed = JSON.parse(content) as JSONContent;
  } catch {
    return;
  }

  const currentSections = useStudioStore.getState().manuscript.sections;
  const sectionIndex = currentSections.findIndex(
    (section) => section.id === sectionId,
  );
  const previousSection = currentSections[sectionIndex];
  if (sectionIndex < 0 || !previousSection) return;

  const projected = projectContinuousManuscriptDocument(
    parsed,
    [previousSection],
  );
  if (!projected.length) return;

  const previousParent = getParentSectionId(previousSection);
  const firstProjected = projected[0];
  if (!firstProjected) return;

  const replacement = [
    withParentSectionId(
      {
        ...firstProjected,
        layout: previousSection.layout,
      },
      previousParent,
    ),
    ...projected.slice(1),
  ];
  const nextSections = [...currentSections];
  nextSections.splice(sectionIndex, 1, ...replacement);
  stageContinuousDocumentChange(nextSections);
}

function extractSectionDocument(
  document: JSONContent,
  sectionId: string,
): JSONContent {
  const content = (document.content ?? []).filter((node) => (
    stringAttribute(node.attrs?.omiSectionId) === sectionId
  ));

  return {
    type: 'doc',
    content: content.length
      ? content
      : [{
          type: 'paragraph',
          attrs: {
            omiSectionId: sectionId,
          },
        }],
  };
}

function stringAttribute(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
