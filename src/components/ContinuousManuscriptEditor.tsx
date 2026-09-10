import { FileUp, Plus } from 'lucide-react';
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import type { JSONContent } from '@tiptap/core';

import { stageContinuousDocumentChange } from '../app/continuousDocumentActions';
import { stageInsertTopLevelSection } from '../app/sectionActions';
import { importOmiDocumentAsStudy } from '../app/studyImportActions';
import { useStudioStore } from '../app/useStudioStore';
import {
  registerDeferredBlockEditorActivator,
  requestBlockEditorFocus,
} from '../editor/blockFocusRegistry';
import {
  buildContinuousManuscriptDocument,
  projectContinuousManuscriptDocument,
} from '../editor/continuousManuscriptDocument';
import {
  announceRenderedManuscriptChange,
  findRenderedSectionElement,
} from '../editor/renderedManuscriptNavigation';
import {
  estimateDeferredStudyHeight,
  shouldProgressivelyMountStudyEditors,
} from '../editor/progressiveStudyMounting';
import { useTranslation } from '../i18n';
import {
  collectStudyNoteOverview,
  resolveCurrentStudy,
} from '../model/currentStudyNotes';
import { formatHierarchicalSectionNumber } from '../model/sectionNumbering';
import { getDocumentStructureProfile } from '../model/documentProfile';
import {
  partitionManuscriptStudies,
  replaceManuscriptStudySections,
  type ManuscriptStudy,
} from '../model/sectionStructure';
import { BlockEditor } from './BlockEditor';
import { ContributorEditor } from './ContributorEditor';
import { CurrentStudyNotesFooter } from './CurrentStudyNotesFooter';

interface StudyEditorProps {
  study: ManuscriptStudy;
  sectionNumbers: ReadonlyMap<string, string>;
  manuscriptLanguage: string;
  ariaLabel: string;
  documentWide?: boolean;
  showContributors?: boolean;
  contributorTitle: string;
  contributorDescription: string;
}

interface ProgressiveStudyEditorProps extends StudyEditorProps {
  defer: boolean;
  selected: boolean;
  title: string;
  deferredLabel: string;
}

function StudyEditor({
  study,
  sectionNumbers,
  manuscriptLanguage,
  ariaLabel,
  documentWide = false,
  showContributors = false,
  contributorTitle,
  contributorDescription,
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
    const currentStudy = documentWide
      ? { rootSectionId: study.rootSectionId, sections: currentSections }
      : partitionManuscriptStudies(currentSections).find(
          (candidate) => candidate.rootSectionId === study.rootSectionId,
        );
    if (!currentStudy) return;

    const projectedStudy = projectContinuousManuscriptDocument(
      parsed,
      currentStudy.sections,
    );
    stageContinuousDocumentChange(documentWide
      ? projectedStudy
      : replaceManuscriptStudySections(
          currentSections,
          study.rootSectionId,
          projectedStudy,
        ));
  };

  const contributionCount = useStudioStore.getState().manuscript.contributions
    .filter((contribution) => contribution.targetId === study.rootSectionId)
    .length;

  return (
    <section
      className="omi-study-editor"
      data-study-id={study.rootSectionId}
      aria-label={ariaLabel}
    >
      {showContributors ? (
        <details className="omi-study-contributors">
          <summary>{contributorTitle} <span>{contributionCount}</span></summary>
          <ContributorEditor
            targetId={study.rootSectionId}
            title={contributorTitle}
            description={contributorDescription}
            className="omi-study-contributor-editor"
          />
        </details>
      ) : null}
      <BlockEditor
        blockId={`omi-study-${study.rootSectionId}`}
        blockType="manuscript"
        content={JSON.stringify(document)}
        onUpdate={updateDocument}
        manuscriptLanguage={manuscriptLanguage}
        className="omi-continuous-document-editor"
        continuous
        proofingMode="editor"
        onProofingSelection={(selection) =>
          useStudioStore.getState().setProofingSelection(selection)
        }
      />
    </section>
  );
}

function ProgressiveStudyEditor({
  defer,
  selected,
  title,
  deferredLabel,
  study,
  ...editorProps
}: ProgressiveStudyEditorProps) {
  const hostRef = useRef<HTMLElement>(null);
  const studyRef = useRef(study);
  const [mounted, setMounted] = useState(!defer || selected);
  const activatedRef = useRef(!defer || selected);
  if (!defer || selected || mounted) activatedRef.current = true;
  const active = activatedRef.current;
  const placeholderHeight = useMemo(
    () => estimateDeferredStudyHeight(study),
    [study],
  );
  studyRef.current = study;

  useEffect(() => {
    if (active) return;
    return registerDeferredBlockEditorActivator((blockId) => {
      const containsBlock = studyRef.current.sections.some((section) =>
        section.blocks.some((block) => block.id === blockId),
      );
      if (!containsBlock) return false;
      setMounted(true);
      return true;
    });
  }, [active]);

  useEffect(() => {
    if (active) return;
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setMounted(true);
        observer.disconnect();
      },
      { rootMargin: '1800px 0px' },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [active]);

  useEffect(() => {
    if (active) announceRenderedManuscriptChange();
  }, [active]);

  if (active) {
    return (
      <StudyEditor
        {...editorProps}
        study={study}
      />
    );
  }

  return (
    <section
      ref={hostRef}
      className="omi-study-editor omi-study-editor--deferred"
      data-study-id={study.rootSectionId}
      data-section-id={study.rootSectionId}
      data-progressive-study-placeholder="true"
      style={{ minHeight: `${placeholderHeight}px` }}
      aria-label={editorProps.ariaLabel}
    >
      <div className="omi-study-editor__deferred-label">
        <strong>{title}</strong>
        <span>{deferredLabel}</span>
      </div>
    </section>
  );
}

export function ContinuousManuscriptEditor() {
  const { locale } = useTranslation();
  const copy = getStudyEditorCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectedSectionId = useStudioStore(
    (state) => state.selectedSectionId,
  );
  const currentStudyNotesVisible = useStudioStore(
    (state) => state.currentStudyNotesVisible,
  );
  const structure = getDocumentStructureProfile(manuscript);
  const studies = useMemo(() => {
    if (structure.kind === 'study' && manuscript.sections.length > 0) {
      return [{
        rootSectionId: manuscript.sections[0]!.id,
        sections: manuscript.sections,
      }];
    }
    return partitionManuscriptStudies(manuscript.sections);
  }, [manuscript.sections, structure.kind]);
  const currentStudy = useMemo(
    () => resolveCurrentStudy(manuscript, selectedSectionId),
    [manuscript, selectedSectionId],
  );
  const currentStudyNoteOverview = useMemo(
    () => currentStudyNotesVisible && currentStudy
      ? collectStudyNoteOverview(manuscript, currentStudy)
      : null,
    [
      currentStudy,
      currentStudyNotesVisible,
      manuscript,
    ],
  );
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState('');
  const [importBusy, setImportBusy] = useState(false);
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
  const progressiveStudyMounting = useMemo(
    () => structure.kind === 'volume'
      && shouldProgressivelyMountStudyEditors(studies),
    [structure.kind, studies],
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

  const importStudy = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportBusy(true);
    setImportStatus('');
    try {
      const imported = await importOmiDocumentAsStudy(file);
      const root = useStudioStore.getState().manuscript.sections.find(
        (section) => section.id === imported.rootSectionId,
      );
      const firstBlockId = root?.blocks[0]?.id;
      if (firstBlockId) requestBlockEditorFocus(firstBlockId, 'start');
      window.setTimeout(() => {
        findRenderedSectionElement(imported.rootSectionId)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 0);
      setImportStatus(copy.imported(imported.title));
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setImportBusy(false);
      event.target.value = '';
    }
  };

  return (
    <>
      {studies.map((study) => {
        const root = study.sections.find(
          (section) => section.id === study.rootSectionId,
        );
        const title = root?.title.trim() || copy.untitled;
        const showNotes = currentStudyNotesVisible
          && currentStudy?.rootSectionId === study.rootSectionId;
        return (
          <Fragment key={study.rootSectionId}>
            <ProgressiveStudyEditor
              study={study}
              sectionNumbers={sectionNumbers}
              manuscriptLanguage={manuscript.locale}
              ariaLabel={`${copy.study}: ${title}`}
              defer={progressiveStudyMounting}
              selected={study.sections.some(
                (section) => section.id === selectedSectionId,
              )}
              title={title}
              deferredLabel={copy.deferredStudy(
                study.sections.length,
                study.sections.reduce(
                  (total, section) => total + section.blocks.length,
                  0,
                ),
              )}
              documentWide={structure.kind === 'study'}
              showContributors={
                structure.kind === 'volume'
                && structure.volumeKind === 'edited-volume'
              }
              contributorTitle={copy.contributorTitle}
              contributorDescription={copy.contributorDescription}
            />
            {showNotes && currentStudyNoteOverview ? (
              <CurrentStudyNotesFooter
                study={study}
                notes={currentStudyNoteOverview.notes}
                numberByNoteId={currentStudyNoteOverview.numberByNoteId}
              />
            ) : null}
          </Fragment>
        );
      })}

      {structure.kind === 'volume' ? (
        <div className="omi-add-study-row">
          <div className="omi-add-study-actions">
            <button type="button" className="omi-add-study" onClick={insertStudy}>
              <Plus size={17} aria-hidden="true" />
              {structure.volumeKind === 'monograph' ? copy.addChapter : copy.addStudy}
            </button>
            <input
              ref={importInputRef}
              type="file"
              hidden
              accept=".omi,.omi.json,.json,application/json,application/vnd.openmanuscript+json,application/vnd.openmanuscript.omi+zip,application/zip"
              onChange={(event) => void importStudy(event)}
            />
            <button
              type="button"
              className="omi-add-study omi-import-study"
              disabled={importBusy}
              onClick={() => importInputRef.current?.click()}
            >
              <FileUp size={17} aria-hidden="true" />
              {importBusy ? copy.importing : copy.importStudy}
            </button>
          </div>
          <span>{structure.volumeKind === 'monograph' ? copy.addChapterHint : copy.addStudyHint}</span>
          {importStatus ? <span role="status" aria-live="polite">{importStatus}</span> : null}
        </div>
      ) : null}
    </>
  );
}

function getStudyEditorCopy(locale: string): {
  study: string;
  untitled: string;
  addStudy: string;
  addChapter: string;
  addStudyHint: string;
  addChapterHint: string;
  importStudy: string;
  importing: string;
  imported: (title: string) => string;
  contributorTitle: string;
  contributorDescription: string;
  deferredStudy: (sections: number, blocks: number) => string;
} {
  if (locale === 'hu') {
    return {
      study: 'Tanulmány szerkesztője',
      untitled: 'Névtelen tanulmány',
      addStudy: 'Új tanulmány',
      addChapter: 'Új fejezet',
      addStudyHint: 'Külön szerkesztő nyílik a kötet új tanulmányához.',
      addChapterHint: 'Külön szerkesztő nyílik a monográfia új fejezetéhez.',
      importStudy: 'OMI-dokumentum importálása',
      importing: 'OMI importálása…',
      imported: (title) => `A(z) „${title}” tanulmány külön szerkesztőben megnyílt.`,
      contributorTitle: 'Tanulmány szerzői',
      contributorDescription: 'A tanulmányhoz tartozó szerzők és szerepek; az importált OMI-adatok itt szerkeszthetők.',
      deferredStudy: (sections, blocks) => `${sections} szakasz, ${blocks} blokk — betöltés görgetéskor vagy navigáláskor`,
    };
  }
  if (locale === 'de') {
    return {
      study: 'Beitragseditor',
      untitled: 'Unbenannter Beitrag',
      addStudy: 'Neuer Beitrag',
      addChapter: 'Neues Kapitel',
      addStudyHint: 'Öffnet einen eigenen Editor für einen neuen Bandbeitrag.',
      addChapterHint: 'Öffnet einen eigenen Editor für ein neues Kapitel der Monografie.',
      importStudy: 'OMI-Dokument importieren',
      importing: 'OMI wird importiert…',
      imported: (title) => `„${title}“ wurde in einem eigenen Editor geöffnet.`,
      contributorTitle: 'Autorinnen und Autoren des Beitrags',
      contributorDescription: 'Beitragsbezogene Autorinnen, Autoren und Rollen; importierte OMI-Daten können hier bearbeitet werden.',
      deferredStudy: (sections, blocks) => `${sections} Abschnitte, ${blocks} Blöcke — Laden beim Scrollen oder Navigieren`,
    };
  }
  return {
    study: 'Study editor',
    untitled: 'Untitled study',
    addStudy: 'New study',
    addChapter: 'New chapter',
    addStudyHint: 'Opens a separate editor for a new contribution to the volume.',
    addChapterHint: 'Opens a separate editor for a new monograph chapter.',
    importStudy: 'Import OMI document',
    importing: 'Importing OMI…',
    imported: (title) => `“${title}” opened in its own study editor.`,
    contributorTitle: 'Study authors',
    contributorDescription: 'Authors and roles attached to this study; imported OMI identities remain editable here.',
    deferredStudy: (sections, blocks) => `${sections} sections, ${blocks} blocks — loads on scroll or navigation`,
  };
}
