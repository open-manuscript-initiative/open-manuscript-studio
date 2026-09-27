import { FileUp, Plus } from 'lucide-react';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import type { JSONContent } from '@tiptap/core';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';

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
  sectionsShareIdentity,
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
import { useAuthStore, getCurrentUser } from '../store/authStore';
import {
  collectStudyNoteOverview,
  resolveCurrentStudy,
} from '../model/currentStudyNotes';
import { buildSectionNumberMap } from '../model/sectionNumbering';
import { getDocumentStructureProfile } from '../model/documentProfile';
import { createInitialCollaborationDocument } from '../editor/collaborationDocument';
import {
  createCollaborationDocument,
  collaborationWebSocketUrl,
  getCollaborationAccess,
  getCollaborationTicket,
  inviteCollaborationMember,
  isCollaborationEnabled,
  type CollaborationAccess,
} from '../services/collaborationApi';
import type { ProofingSelection } from '../model/proofing';
import {
  getParentSectionId,
  partitionManuscriptStudies,
  replaceManuscriptStudySections,
  type ManuscriptStudy,
} from '../model/sectionStructure';
import { BlockEditor } from './BlockEditor';
import { ContributorEditor } from './ContributorEditor';
import { CurrentStudyNotesFooter } from './CurrentStudyNotesFooter';

interface CollaborationSession {
  document: Y.Doc;
  provider: HocuspocusProvider;
  user: { name: string; color: string };
}

interface StudyEditorProps {
  study: ManuscriptStudy;
  sectionNumbers: ReadonlyMap<string, string>;
  manuscriptLanguage: string;
  ariaLabel: string;
  documentWide?: boolean;
  showContributors?: boolean;
  contributorTitle: string;
  contributorDescription: string;
  collaboration?: CollaborationSession | null;
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
  collaboration,
}: StudyEditorProps) {
  const localProjectionRef = useRef<{
    sections: ReadonlyArray<ManuscriptStudy['sections'][number]>;
    content: string;
  } | null>(null);
  const serializedDocument = useMemo(() => {
    const localProjection = localProjectionRef.current;
    if (
      localProjection
      && sectionsShareIdentity(study.sections, localProjection.sections)
    ) {
      return localProjection.content;
    }

    return JSON.stringify(
      buildContinuousManuscriptDocument(study.sections, sectionNumbers),
    );
  }, [sectionNumbers, study.sections]);

  const updateDocument = useCallback((_documentId: string, content: string) => {
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
    // The store update below is synchronous. Remember the exact projected
    // section objects so the resulting React render can reuse Tiptap's own
    // serialized document instead of rebuilding and stringifying the complete
    // study after every local keystroke.
    localProjectionRef.current = {
      sections: projectedStudy,
      content,
    };
    stageContinuousDocumentChange(documentWide
      ? projectedStudy
      : replaceManuscriptStudySections(
          currentSections,
          study.rootSectionId,
          projectedStudy,
        ));
  }, [documentWide, study.rootSectionId]);

  const handleProofingSelection = useCallback(
    (selection: ProofingSelection | null) =>
      useStudioStore.getState().setProofingSelection(selection),
    [],
  );

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
        content={serializedDocument}
        onUpdate={updateDocument}
        manuscriptLanguage={manuscriptLanguage}
        className="omi-continuous-document-editor"
        continuous
        proofingMode="editor"
        onProofingSelection={handleProofingSelection}
        collaboration={collaboration ? {
          fragment: collaboration.document.getXmlFragment(study.rootSectionId),
          provider: collaboration.provider,
          user: collaboration.user,
        } : undefined}
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
  const currentUser = useAuthStore(getCurrentUser);
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
    () => currentStudyNotesVisible
      ? resolveCurrentStudy(manuscript, selectedSectionId)
      : null,
    [currentStudyNotesVisible, manuscript, selectedSectionId],
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
  const sectionNumberCacheRef = useRef<{
    signature: string;
    style: typeof manuscript.sectionNumberingStyle;
    numbers: Map<string, string>;
  } | null>(null);
  const sectionNumberingSignature = manuscript.sections.map((section) =>
    [
      section.id,
      getParentSectionId(section) ?? '',
      section.title,
    ].join('\u0000'),
  ).join('\u0001');
  if (
    !sectionNumberCacheRef.current
    || sectionNumberCacheRef.current.signature !== sectionNumberingSignature
    || sectionNumberCacheRef.current.style !== manuscript.sectionNumberingStyle
  ) {
    sectionNumberCacheRef.current = {
      signature: sectionNumberingSignature,
      style: manuscript.sectionNumberingStyle,
      numbers: buildSectionNumberMap(
        manuscript.sections,
        manuscript.sectionNumberingStyle,
      ),
    };
  }
  const sectionNumbers = sectionNumberCacheRef.current.numbers;
  const progressiveStudyMounting = useMemo(
    () => structure.kind === 'volume'
      && shouldProgressivelyMountStudyEditors(studies),
    [structure.kind, studies],
  );
  const [collaborationEnabled, setCollaborationEnabled] = useState(false);
  const [collaborationAccess, setCollaborationAccess] = useState<CollaborationAccess | null>(null);
  const [collaborationSession, setCollaborationSession] = useState<CollaborationSession | null>(null);
  const [collaborationStatus, setCollaborationStatus] = useState('');
  const [collaborationConnected, setCollaborationConnected] = useState(false);
  const [collaborationParticipants, setCollaborationParticipants] = useState(0);
  const [collaboratorEmail, setCollaboratorEmail] = useState('');
  const [collaborationBusy, setCollaborationBusy] = useState(false);
  const [collaborationRefresh, setCollaborationRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void isCollaborationEnabled()
      .then((enabled) => { if (!cancelled) setCollaborationEnabled(enabled); })
      .catch(() => { if (!cancelled) setCollaborationEnabled(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const refreshMembership = () => setCollaborationRefresh((value) => value + 1);
    window.addEventListener('omi:collaboration-access-changed', refreshMembership);
    return () => window.removeEventListener('omi:collaboration-access-changed', refreshMembership);
  }, []);

  useEffect(() => {
    return () => {
      collaborationSession?.provider.destroy();
      collaborationSession?.document.destroy();
    };
  }, [collaborationSession]);

  useEffect(() => {
    setCollaborationAccess(null);
    setCollaborationSession(null);
    setCollaborationStatus('');
    setCollaborationConnected(false);
    setCollaborationParticipants(0);
    if (!collaborationEnabled || !currentUser) return;
    let cancelled = false;
    void getCollaborationAccess(manuscript.id).then(async (access) => {
      if (cancelled) return;
      setCollaborationAccess(access);
      if (!access.members.some((member) => member.userId === currentUser.id)) return;
      const ticket = await getCollaborationTicket(manuscript.id);
      if (cancelled) return;
      const document = new Y.Doc();
      const provider = new HocuspocusProvider({
        url: collaborationWebSocketUrl(ticket.webSocketPath),
        name: manuscript.id,
        document,
        token: ticket.token,
      });
      const session = {
        document,
        provider,
        user: { name: currentUser.profile.fullName || currentUser.email, color: collaborationColor(currentUser.id) },
      };
      provider.on('status', (event: { status: string }) => setCollaborationConnected(event.status === 'connected'));
      provider.on('awarenessUpdate', () => setCollaborationParticipants(provider.awareness?.getStates().size ?? 0));
      setCollaborationSession(session);
    }).catch(() => {
      // A missing membership is expected before an invitation is accepted.
      if (!cancelled) setCollaborationAccess(null);
    });
    return () => { cancelled = true; };
  }, [collaborationEnabled, collaborationRefresh, currentUser, manuscript.id]);

  const startCollaboration = async () => {
    if (!currentUser) return;
    setCollaborationBusy(true);
    setCollaborationStatus('');
    try {
      const seeded = createInitialCollaborationDocument(studies, sectionNumbers);
      const update = Y.encodeStateAsUpdate(seeded);
      seeded.destroy();
      let binary = '';
      for (let offset = 0; offset < update.length; offset += 0x8000) {
        binary += String.fromCharCode(...update.subarray(offset, offset + 0x8000));
      }
      await createCollaborationDocument({
        documentId: manuscript.id,
        title: manuscript.title || 'Untitled manuscript',
        initialState: btoa(binary),
      });
      setCollaborationAccess(await getCollaborationAccess(manuscript.id));
      const ticket = await getCollaborationTicket(manuscript.id);
      const document = new Y.Doc();
      const provider = new HocuspocusProvider({
        url: collaborationWebSocketUrl(ticket.webSocketPath),
        name: manuscript.id,
        document,
        token: ticket.token,
      });
      provider.on('status', (event: { status: string }) => setCollaborationConnected(event.status === 'connected'));
      provider.on('awarenessUpdate', () => setCollaborationParticipants(provider.awareness?.getStates().size ?? 0));
      setCollaborationSession({
        document,
        provider,
        user: { name: currentUser.profile.fullName || currentUser.email, color: collaborationColor(currentUser.id) },
      });
    } catch (error) {
      setCollaborationStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setCollaborationBusy(false);
    }
  };

  const inviteCollaborator = async () => {
    const email = collaboratorEmail.trim();
    if (!email) return;
    setCollaborationBusy(true);
    setCollaborationStatus('');
    try {
      const emailSent = await inviteCollaborationMember(manuscript.id, email, 'AUTHOR');
      setCollaboratorEmail('');
      setCollaborationAccess(await getCollaborationAccess(manuscript.id));
      setCollaborationStatus(emailSent
        ? 'Invitation sent. The invited author must accept it before joining.'
        : 'Invitation added to the Studio inbox, but the notification email could not be sent.');
    } catch (error) {
      setCollaborationStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setCollaborationBusy(false);
    }
  };

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
      {collaborationEnabled ? (
        <aside className="omi-collaboration-panel" aria-label="Live collaboration">
          <div className="omi-collaboration-panel__summary">
            <strong>Live collaboration</strong>
            {collaborationSession ? (
              <span className={collaborationConnected ? 'is-connected' : ''}>
                {collaborationConnected ? 'Connected' : 'Connecting'}
                {collaborationConnected ? ` · ${collaborationParticipants} participant${collaborationParticipants === 1 ? '' : 's'}` : ''}
              </span>
            ) : null}
          </div>
          {!collaborationAccess ? (
            <button type="button" onClick={startCollaboration} disabled={collaborationBusy}>
              {collaborationBusy ? 'Starting…' : 'Start shared editing'}
            </button>
          ) : null}
          {collaborationAccess && collaborationAccess.members.some((member) =>
            member.userId === currentUser?.id && ['OWNER', 'EDITOR'].includes(member.role),
          ) ? (
            <div className="omi-collaboration-invite">
              <label htmlFor="omi-collaborator-email">Invite an author</label>
              <input
                id="omi-collaborator-email"
                type="email"
                value={collaboratorEmail}
                onChange={(event) => setCollaboratorEmail(event.target.value)}
                placeholder="Email address"
              />
              <button type="button" onClick={inviteCollaborator} disabled={collaborationBusy || !collaboratorEmail.trim()}>
                Send invitation
              </button>
              {collaborationAccess.invitations.map((invitation) => (
                <span key={invitation.id} className="omi-collaboration-invite__pending">
                  {invitation.invitedEmail} · awaiting acceptance
                </span>
              ))}
            </div>
          ) : null}
          {collaborationStatus ? <p role="status">{collaborationStatus}</p> : null}
        </aside>
      ) : null}
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
              collaboration={collaborationSession}
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

function collaborationColor(identity: string): string {
  let hash = 0;
  for (let index = 0; index < identity.length; index += 1) {
    hash = (hash * 31 + identity.charCodeAt(index)) | 0;
  }
  const palette = ['#2563eb', '#7c3aed', '#c2410c', '#15803d', '#be185d', '#0f766e'];
  return palette[Math.abs(hash) % palette.length]!;
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
