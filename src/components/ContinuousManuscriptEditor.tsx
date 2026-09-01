import { useMemo } from 'react';
import type { JSONContent } from '@tiptap/core';

import { stageContinuousDocumentChange } from '../app/continuousDocumentActions';
import { useStudioStore } from '../app/useStudioStore';
import {
  buildContinuousManuscriptDocument,
  projectContinuousManuscriptDocument,
} from '../editor/continuousManuscriptDocument';
import { formatHierarchicalSectionNumber } from '../model/sectionNumbering';
import { BlockEditor } from './BlockEditor';

export function ContinuousManuscriptEditor() {
  const manuscript = useStudioStore((state) => state.manuscript);
  const document = useMemo(() => {
    const sectionNumbers = new Map(
      manuscript.sections.map((section) => [
        section.id,
        formatHierarchicalSectionNumber(
          manuscript.sections,
          section.id,
          manuscript.sectionNumberingStyle,
        ),
      ]),
    );
    return buildContinuousManuscriptDocument(manuscript.sections, sectionNumbers);
  }, [manuscript.sectionNumberingStyle, manuscript.sections]);

  const updateDocument = (_documentId: string, content: string) => {
    let parsed: JSONContent;
    try {
      parsed = JSON.parse(content) as JSONContent;
    } catch {
      return;
    }
    const currentSections = useStudioStore.getState().manuscript.sections;
    stageContinuousDocumentChange(
      projectContinuousManuscriptDocument(parsed, currentSections),
    );
  };

  return (
    <BlockEditor
      blockId="omi-continuous-document"
      blockType="manuscript"
      content={JSON.stringify(document)}
      onUpdate={updateDocument}
      manuscriptLanguage={manuscript.locale}
      className="omi-continuous-document-editor"
      continuous
    />
  );
}
