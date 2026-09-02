import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import type { JSONContent } from '@tiptap/core';

import { stageContinuousDocumentChange } from '../app/continuousDocumentActions';
import { stageInsertTopLevelSection } from '../app/sectionActions';
import { useStudioStore } from '../app/useStudioStore';
import { requestBlockEditorFocus } from '../editor/blockFocusRegistry';
import {
  buildContinuousManuscriptDocument,
  projectContinuousManuscriptDocument,
} from '../editor/continuousManuscriptDocument';
import { findRenderedSectionElement } from '../editor/renderedManuscriptNavigation';
import { useTranslation } from '../i18n';
import { formatHierarchicalSectionNumber } from '../model/sectionNumbering';
import {
  partitionManuscriptStudies,
  replaceManuscriptStudySections,
  type ManuscriptStudy,
} from '../model/sectionStructure';
import { BlockEditor } from './BlockEditor';

interface StudyEditorProps {
  study: ManuscriptStudy;
  sectionNumbers: ReadonlyMap<string, string>;
  manuscriptLanguage: string;
  ariaLabel: string;
}

function StudyEditor({
  study,
  sectionNumbers,
  manuscriptLanguage,
  ariaLabel,
}: StudyEditorProps) {
  const document = useMemo(
    () => buildContinuousManuscriptDocument(study.sections, sectionNumbers),
    [sectionNumbers, study.sections],
  );

  const updateDocument = (_documentId: string, content: string) => {
    let parsed: JSONContent;
    try {
      parsed = JSON.parse(content) as JSONContent;
    } catch {
      return;
    }

    const currentSections = useStudioStore.getState().manuscript.sections;
    const currentStudy = partitionManuscriptStudies(currentSections).find(
      (candidate) => candidate.rootSectionId === study.rootSectionId,
    );
    if (!currentStudy) return;

    const projectedStudy = projectContinuousManuscriptDocument(
      parsed,
      currentStudy.sections,
    );
    stageContinuousDocumentChange(
      replaceManuscriptStudySections(
        currentSections,
        study.rootSectionId,
        projectedStudy,
      ),
    );
  };

  return (
    <section
      className="omi-study-editor"
      data-study-id={study.rootSectionId}
      aria-label={ariaLabel}
    >
      <BlockEditor
        blockId={`omi-study-${study.rootSectionId}`}
        blockType="manuscript"
        content={JSON.stringify(document)}
        onUpdate={updateDocument}
        manuscriptLanguage={manuscriptLanguage}
        className="omi-continuous-document-editor"
        continuous
      />
    </section>
  );
}

export function ContinuousManuscriptEditor() {
  const { locale } = useTranslation();
  const copy = getStudyEditorCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const studies = useMemo(
    () => partitionManuscriptStudies(manuscript.sections),
    [manuscript.sections],
  );
  const sectionNumbers = useMemo(
    () => new Map(
      manuscript.sections.map((section) => [
        section.id,
        formatHierarchicalSectionNumber(
          manuscript.sections,
          section.id,
          manuscript.sectionNumberingStyle,
        ),
      ]),
    ),
    [manuscript.sectionNumberingStyle, manuscript.sections],
  );

  const insertStudy = () => {
    const sectionId = stageInsertTopLevelSection();
    if (!sectionId) return;

    const inserted = useStudioStore
      .getState()
      .manuscript.sections.find((section) => section.id === sectionId);
    const firstBlockId = inserted?.blocks[0]?.id;
    if (firstBlockId) requestBlockEditorFocus(firstBlockId, 'start');

    window.setTimeout(() => {
      findRenderedSectionElement(sectionId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 0);
  };

  return (
    <>
      {studies.map((study) => {
        const root = study.sections.find(
          (section) => section.id === study.rootSectionId,
        );
        const title = root?.title.trim() || copy.untitled;
        return (
          <StudyEditor
            key={study.rootSectionId}
            study={study}
            sectionNumbers={sectionNumbers}
            manuscriptLanguage={manuscript.locale}
            ariaLabel={`${copy.study}: ${title}`}
          />
        );
      })}

      <div className="omi-add-study-row">
        <button type="button" className="omi-add-study" onClick={insertStudy}>
          <Plus size={17} aria-hidden="true" />
          {copy.addStudy}
        </button>
        <span>{copy.addStudyHint}</span>
      </div>
    </>
  );
}

function getStudyEditorCopy(locale: string): {
  study: string;
  untitled: string;
  addStudy: string;
  addStudyHint: string;
} {
  if (locale === 'hu') {
    return {
      study: 'Tanulmány szerkesztője',
      untitled: 'Névtelen tanulmány',
      addStudy: 'Új tanulmány',
      addStudyHint: 'Külön szerkesztő nyílik a kötet új tanulmányához.',
    };
  }
  if (locale === 'de') {
    return {
      study: 'Beitragseditor',
      untitled: 'Unbenannter Beitrag',
      addStudy: 'Neuer Beitrag',
      addStudyHint: 'Öffnet einen eigenen Editor für einen neuen Bandbeitrag.',
    };
  }
  return {
    study: 'Study editor',
    untitled: 'Untitled study',
    addStudy: 'New study',
    addStudyHint: 'Opens a separate editor for a new contribution to the volume.',
  };
}
