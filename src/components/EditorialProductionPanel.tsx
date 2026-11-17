import type { OmiManuscript } from '../types/omi';
import { useEffect, useState } from 'react';
import { useTranslation } from '../i18n';
import { useStudioStore } from '../app/useStudioStore';
import { externalizeActiveManuscriptAssets } from '../app/assetActions';
import {
  changeProduction,
  getProduction,
  getProductionFile,
  type EditorialProduction,
  type ProductionCommand,
} from '../services/editorialProductionApi';
import {
  prepareNativeEditorialRevision,
  restoreNativeEditorialManuscript,
} from '../services/nativeEditorialSnapshot';
import { getWebPublicationAssuranceEvidence } from '../services/integrationApi';
import { createStudioReviewedAssurance } from '../integrations/webPublicationContract';
import { prepareWebPublicationArtifact } from '../services/webPublicationArtifact';
import { saveExportBlob } from '../services/exportFileDelivery';
import { preparePublicationArtifact } from '../services/publicationArtifact';

export function EditorialProductionPanel({
  submissionId,
}: {
  submissionId: string;
}) {
  const { locale } = useTranslation();
  const activeManuscript = useStudioStore((state) => state.manuscript);
  const [openedSource, setOpenedSource] = useState<OmiManuscript | null>(null);
  const t = locale === 'hu' ? hu : locale === 'de' ? de : en;
  const [data, setData] = useState<EditorialProduction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<
    'COPYEDITOR' | 'LAYOUT_EDITOR' | 'PROOFREADER'
  >('COPYEDITOR');
  const [dueAt, setDueAt] = useState('');
  const [locator, setLocator] = useState('');
  const [note, setNote] = useState('');
  const [resolution, setResolution] = useState('');
  const [proofFormat, setProofFormat] = useState<
    'html' | 'pdf-print' | 'pdf-interactive'
  >('html');
  const [preview, setPreview] = useState<string | null>(null);
  const [viewedFile, setViewedFile] = useState('');
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setPreview(null);
    setViewedFile('');
    setError('');
    void getProduction(submissionId)
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((reason) => {
        if (!cancelled) setError(String(reason.message ?? reason));
      });
    return () => {
      cancelled = true;
    };
  }, [submissionId]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }
  async function send(command: ProductionCommand) {
    if (!data) return;
    const next = await changeProduction(submissionId, data.version, command);
    setData(next);
    if (
      next.state?.proof?.fileId !== data.state?.proof?.fileId ||
      next.state?.source.fileId !== data.state?.source.fileId
    ) {
      setViewedFile('');
      setPreview(null);
    }
  }
  async function openSource() {
    if (!data?.state || !window.confirm(t.openConfirm)) return;
    const fileId = data.state.source.fileId;
    const blob = await getProductionFile(submissionId, fileId);
    const source = JSON.parse(await blob.text()) as Parameters<
      typeof prepareNativeEditorialRevision
    >[0] & {
      revisionId: string;
      manuscriptStateSnapshot: Parameters<
        typeof restoreNativeEditorialManuscript
      >[0]['manuscriptStateSnapshot'];
      assets: Parameters<typeof restoreNativeEditorialManuscript>[0]['assets'];
    };
    const restored = await restoreNativeEditorialManuscript(source);
    useStudioStore.getState().loadManuscript(restored);
    setViewedFile(fileId);
    setOpenedSource(useStudioStore.getState().manuscript);
  }
  async function saveSource() {
    await externalizeActiveManuscriptAssets();
    useStudioStore.getState().checkpoint('export');
    await send({
      type: 'SOURCE',
      source: await prepareNativeEditorialRevision(
        useStudioStore.getState().manuscript,
      ),
    });
  }
  async function buildProof() {
    if (!data?.state) return;
    const manuscript = useStudioStore.getState().manuscript;
    if (manuscript.headRevisionId !== data.state.source.revisionId)
      throw new Error(t.openSourceFirst);
    if (proofFormat !== 'html') {
      const artifact = await preparePublicationArtifact(
        manuscript,
        proofFormat,
      );
      await send({
        type: 'PROOF',
        artifactBase64: artifact.artifactBase64,
        build: { ...artifact.build },
      });
      return;
    }
    const evidence = await getWebPublicationAssuranceEvidence({
      manuscriptId: manuscript.id,
      revisionId: data.state.source.revisionId,
      stateDigest: data.state.source.stateDigest,
    });
    const decision = evidence.decisions.find(
      (item) =>
        item.authority?.venueId === manuscript.metadata?.publicationVenue?.id,
    );
    if (!decision) throw new Error(t.acceptanceRequired);
    const artifact = await prepareWebPublicationArtifact(
      manuscript,
      createStudioReviewedAssurance(
        manuscript.metadata?.publicationVenue?.type === 'BOOK_PUBLISHER'
          ? 'book-chapter'
          : 'scholarly-article',
        decision,
      ),
    );
    const bytes = new TextEncoder().encode(artifact.html);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    await send({
      type: 'PROOF',
      artifactBase64: btoa(binary),
      build: { ...artifact.build },
    });
  }
  async function viewProof() {
    const proof = data?.state?.proof;
    if (!proof) return;
    const blob = await getProductionFile(submissionId, proof.fileId);
    if (proof.mediaType.startsWith('text/html')) setPreview(await blob.text());
    else if (!(await saveExportBlob(blob, proof.fileName)).saved) return;
    setViewedFile(proof.fileId);
  }
  const state = data?.state;
  const editor = Boolean(data?.actor.editor);
  const author = Boolean(data?.actor.author);
  const can = (value: 'COPYEDITOR' | 'LAYOUT_EDITOR' | 'PROOFREADER') =>
    editor ||
    Boolean(
      state?.assignments.some(
        (a) => a.userId === data?.actor.userId && a.role === value,
      ),
    );
  const locked = busy || Boolean(data?.published);
  return (
    <section
      className="studio-settings-card publication-profile-options editorial-production-panel"
      aria-label={t.title}
    >
      <h4>{t.title}</h4>
      <p>{t.help}</p>
      <button
        className="studio-menu-secondary-action"
        type="button"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            setData(await getProduction(submissionId));
            setViewedFile('');
            setPreview(null);
          })
        }
      >
        {t.refresh}
      </button>
      {data && !state ? (
        <button
          className="studio-menu-secondary-action"
          type="button"
          disabled={locked || !editor}
          onClick={() => void run(() => send({ type: 'START' }))}
        >
          {t.start}
        </button>
      ) : null}
      {state ? (
        <>
          <p role="status">
            <strong>{t.stages[state.stage]}</strong>
            {data?.published ? ` · ${t.published}` : ''}
          </p>
          <p>
            {t.source}: <code>{state.source.revisionId}</code>
          </p>
          <button
            className="studio-menu-secondary-action"
            type="button"
            disabled={busy}
            onClick={() => void run(openSource)}
          >
            {t.openSource}
          </button>
          {can('COPYEDITOR') ? (
            <button
              className="studio-menu-secondary-action"
              type="button"
              disabled={locked}
              onClick={() => void run(saveSource)}
            >
              {t.saveSource}
            </button>
          ) : null}
          {state.stage === 'COPYEDITING' ? (
            <>
              {author ? (
                <button
                  className="studio-menu-secondary-action"
                  type="button"
                  disabled={
                    locked ||
                    viewedFile !== state.source.fileId ||
                    activeManuscript !== openedSource ||
                    Boolean(state.sourceApprovals.AUTHOR)
                  }
                  onClick={() =>
                    void run(() =>
                      send({
                        type: 'APPROVE_SOURCE',
                        role: 'AUTHOR',
                        fileId: state.source.fileId,
                      }),
                    )
                  }
                >
                  {t.authorSource}
                </button>
              ) : null}
              {editor ? (
                <>
                  <button
                    className="studio-menu-secondary-action"
                    type="button"
                    disabled={
                      locked ||
                      viewedFile !== state.source.fileId ||
                      activeManuscript !== openedSource ||
                      Boolean(state.sourceApprovals.EDITOR)
                    }
                    onClick={() =>
                      void run(() =>
                        send({
                          type: 'APPROVE_SOURCE',
                          role: 'EDITOR',
                          fileId: state.source.fileId,
                        }),
                      )
                    }
                  >
                    {t.editorSource}
                  </button>
                  <button
                    className="studio-menu-secondary-action"
                    type="button"
                    disabled={
                      locked ||
                      !state.sourceApprovals.AUTHOR ||
                      !state.sourceApprovals.EDITOR
                    }
                    onClick={() => void run(() => send({ type: 'LAYOUT' }))}
                  >
                    {t.toLayout}
                  </button>
                </>
              ) : null}
            </>
          ) : null}
          {state.stage !== 'COPYEDITING' && can('LAYOUT_EDITOR') ? (
            <>
              <label>
                {t.format}
                <select
                  disabled={locked}
                  value={proofFormat}
                  onChange={(event) =>
                    setProofFormat(event.target.value as typeof proofFormat)
                  }
                >
                  <option value="html">HTML</option>
                  <option value="pdf-print">PDF</option>
                  <option value="pdf-interactive">PDF (Interactive)</option>
                </select>
              </label>
              <button
                className="studio-menu-secondary-action"
                type="button"
                disabled={locked}
                onClick={() => void run(buildProof)}
              >
                {t.buildProof}
              </button>
            </>
          ) : null}
          {state.proof ? (
            <>
              <p>
                {t.proof}: {state.proof.fileName}
              </p>
              <button
                className="studio-menu-secondary-action"
                type="button"
                disabled={busy}
                onClick={() => void run(viewProof)}
              >
                {t.viewProof}
              </button>
              {preview ? (
                <iframe
                  title={t.proof}
                  srcDoc={preview}
                  sandbox=""
                  referrerPolicy="no-referrer"
                  style={{
                    width: '100%',
                    minHeight: '25rem',
                    background: '#fff',
                  }}
                />
              ) : null}
              {state.stage === 'PROOFREADING' ? (
                <>
                  {author || can('PROOFREADER') ? (
                    <>
                      <label>
                        {t.locator}
                        <input
                          value={locator}
                          maxLength={500}
                          onChange={(event) => setLocator(event.target.value)}
                        />
                      </label>
                      <label>
                        {t.note}
                        <textarea
                          value={note}
                          maxLength={10000}
                          onChange={(event) => setNote(event.target.value)}
                        />
                      </label>
                      <button
                        className="studio-menu-secondary-action"
                        type="button"
                        disabled={
                          locked ||
                          !locator.trim() ||
                          !note.trim() ||
                          viewedFile !== state.proof.fileId
                        }
                        onClick={() =>
                          void run(async () => {
                            await send({
                              type: 'CORRECTION',
                              fileId: state.proof!.fileId,
                              locator,
                              note,
                            });
                            setNote('');
                          })
                        }
                      >
                        {t.addCorrection}
                      </button>
                    </>
                  ) : null}
                  {can('LAYOUT_EDITOR') ? (
                    <label>
                      {t.resolution}
                      <textarea
                        value={resolution}
                        maxLength={10000}
                        onChange={(event) => setResolution(event.target.value)}
                      />
                    </label>
                  ) : null}
                  {state.corrections
                    .filter((c) => c.proofFileId === state.proof!.fileId)
                    .map((c) => (
                      <article key={c.id}>
                        <strong>{c.locator}</strong>
                        <p>{c.note}</p>
                        {c.resolution ? (
                          <p>
                            {t.resolved}: {c.resolution.note}
                          </p>
                        ) : can('LAYOUT_EDITOR') ? (
                          <button
                            className="studio-menu-secondary-action"
                            type="button"
                            disabled={locked || !resolution.trim()}
                            onClick={() =>
                              void run(() =>
                                send({
                                  type: 'RESOLVE',
                                  id: c.id,
                                  note: resolution,
                                }),
                              )
                            }
                          >
                            {t.resolve}
                          </button>
                        ) : null}
                      </article>
                    ))}
                  {author ? (
                    <button
                      className="studio-menu-secondary-action"
                      type="button"
                      disabled={
                        locked ||
                        viewedFile !== state.proof.fileId ||
                        Boolean(state.proofApprovals.AUTHOR)
                      }
                      onClick={() =>
                        void run(() =>
                          send({
                            type: 'APPROVE_PROOF',
                            role: 'AUTHOR',
                            fileId: state.proof!.fileId,
                          }),
                        )
                      }
                    >
                      {t.authorProof}
                    </button>
                  ) : null}
                  {editor ? (
                    <>
                      <button
                        className="studio-menu-secondary-action"
                        type="button"
                        disabled={
                          locked ||
                          viewedFile !== state.proof.fileId ||
                          Boolean(state.proofApprovals.EDITOR)
                        }
                        onClick={() =>
                          void run(() =>
                            send({
                              type: 'APPROVE_PROOF',
                              role: 'EDITOR',
                              fileId: state.proof!.fileId,
                            }),
                          )
                        }
                      >
                        {t.editorProof}
                      </button>
                      <button
                        className="studio-menu-secondary-action"
                        type="button"
                        disabled={
                          locked ||
                          !state.proofApprovals.AUTHOR ||
                          !state.proofApprovals.EDITOR
                        }
                        onClick={() => void run(() => send({ type: 'READY' }))}
                      >
                        {t.ready}
                      </button>
                    </>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
          {editor ? (
            <fieldset disabled={locked}>
              <legend>{t.assignments}</legend>
              <label>
                {t.email}
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label>
                {t.role}
                <select
                  value={role}
                  onChange={(event) =>
                    setRole(event.target.value as typeof role)
                  }
                >
                  {Object.entries(t.roles).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.dueAt}
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                />
              </label>
              <button
                className="studio-menu-secondary-action"
                type="button"
                disabled={!email.trim()}
                onClick={() =>
                  void run(() =>
                    send({
                      type: 'ASSIGN',
                      email,
                      role,
                      ...(dueAt
                        ? { dueAt: new Date(dueAt).toISOString() }
                        : {}),
                    }),
                  )
                }
              >
                {t.assign}
              </button>
              {state.assignments.map((a) => (
                <p key={`${a.userId}:${a.role}`}>
                  {t.roles[a.role]}
                  {a.dueAt
                    ? ` · ${new Date(a.dueAt).toLocaleString()}`
                    : ''}{' '}
                  <button
                    className="studio-menu-secondary-action"
                    type="button"
                    onClick={() =>
                      void run(() =>
                        send({
                          type: 'REVOKE',
                          userId: a.userId,
                          role: a.role,
                        }),
                      )
                    }
                  >
                    {t.revoke}
                  </button>
                </p>
              ))}
            </fieldset>
          ) : null}
          <details>
            <summary>{t.history}</summary>
            <ul>
              {data?.files.map((file) => (
                <li key={file.id}>
                  <button
                    className="studio-menu-secondary-action"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await saveExportBlob(
                          await getProductionFile(submissionId, file.id),
                          file.fileName,
                        );
                      })
                    }
                  >
                    {file.fileName}
                  </button>{' '}
                  · {new Date(file.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : null}
      {error ? (
        <p role="alert" className="publication-profile-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
const en = {
  title: 'Copyediting and proofs',
  help: 'Approve the copyedited source, prepare the proof, resolve corrections, then approve the exact publication file.',
  refresh: 'Refresh production',
  start: 'Start copyediting',
  source: 'Source revision',
  published: 'Published',
  openSource: 'Open current source',
  openConfirm: 'Open this production source in place of the current document?',
  saveSource: 'Submit current document as copyedited source',
  authorSource: 'Author: approve this source',
  editorSource: 'Editor: approve this source',
  toLayout: 'Accept this source and send to layout',
  openSourceFirst: 'Open the approved source before building the proof.',
  acceptanceRequired:
    'An editorial acceptance for this exact source is required.',
  format: 'Proof format',
  buildProof: 'Build publication proof',
  proof: 'Publication proof',
  viewProof: 'Open current proof',
  locator: 'Page, paragraph or element',
  note: 'Required correction',
  addCorrection: 'Add correction',
  resolution: 'How the correction was handled',
  resolve: 'Record resolution',
  resolved: 'Resolved',
  authorProof: 'Author: approve this proof',
  editorProof: 'Editor: approve this proof',
  ready: 'Mark ready for publication',
  assignments: 'Production assignments',
  email: 'Studio e-mail',
  role: 'Task',
  dueAt: 'Due date (optional)',
  assign: 'Assign task',
  revoke: 'Revoke task',
  history: 'Previous source and proof files',
  stages: {
    COPYEDITING: 'Copyediting',
    LAYOUT: 'Layout',
    PROOFREADING: 'Proofreading',
    READY: 'Ready for publication',
  },
  roles: {
    COPYEDITOR: 'Copyeditor',
    LAYOUT_EDITOR: 'Layout editor',
    PROOFREADER: 'Proofreader',
  },
};
const hu: typeof en = {
  title: 'Szöveggondozás és korrektúra',
  help: 'A szöveggondozott kézirat jóváhagyása után készül a korrektúrapéldány. A javítások lezárását a konkrét publikációs fájl jóváhagyása követi.',
  refresh: 'Munkafolyamat frissítése',
  start: 'Szöveggondozás indítása',
  source: 'Forrásváltozat',
  published: 'Megjelent',
  openSource: 'Aktuális forrás megnyitása',
  openConfirm:
    'Megnyitja a kiadvány-előkészítés forrását az aktuális dokumentum helyén?',
  saveSource: 'Aktuális dokumentum beadása szöveggondozott változatként',
  authorSource: 'Szerzői jóváhagyás: ez a kézirat',
  editorSource: 'Szerkesztői jóváhagyás: ez a kézirat',
  toLayout: 'Változat elfogadása és átadása tördelésre',
  openSourceFirst: 'Előbb nyissa meg a jóváhagyott forrásváltozatot.',
  acceptanceRequired:
    'Ehhez a pontos forrásváltozathoz szerkesztői elfogadás szükséges.',
  format: 'Korrektúrapéldány formátuma',
  buildProof: 'Korrektúrapéldány elkészítése',
  proof: 'Korrektúrapéldány',
  viewProof: 'Aktuális korrektúrapéldány megnyitása',
  locator: 'Oldal, bekezdés vagy elem',
  note: 'Kért javítás',
  addCorrection: 'Javítás felvétele',
  resolution: 'A javítás elvégzésének vagy elutasításának indoklása',
  resolve: 'Javítás lezárása',
  resolved: 'Lezárva',
  authorProof: 'Szerzői jóváhagyás: ez a korrektúrapéldány',
  editorProof: 'Szerkesztői jóváhagyás: ez a korrektúrapéldány',
  ready: 'Kiadásra kész állapot rögzítése',
  assignments: 'Kiadvány-előkészítési feladatok',
  email: 'Studio e-mail-cím',
  role: 'Feladat',
  dueAt: 'Határidő (nem kötelező)',
  assign: 'Feladat kiosztása',
  revoke: 'Megbízás visszavonása',
  history: 'Korábbi források és korrektúrapéldányok',
  stages: {
    COPYEDITING: 'Szöveggondozás',
    LAYOUT: 'Tördelés',
    PROOFREADING: 'Korrektúra',
    READY: 'Kiadásra kész',
  },
  roles: {
    COPYEDITOR: 'Szöveggondozó',
    LAYOUT_EDITOR: 'Tördelő',
    PROOFREADER: 'Korrektúrázó',
  },
};
const de: typeof en = {
  ...en,
  title: 'Lektorat und Korrektur',
  help: 'Bearbeitete Quelle freigeben, Korrekturfahne erstellen, Korrekturen abschließen und die genaue Publikationsdatei freigeben.',
  refresh: 'Produktion aktualisieren',
  start: 'Lektorat beginnen',
  source: 'Quellrevision',
  published: 'Veröffentlicht',
  openSource: 'Aktuelle Quelle öffnen',
  openConfirm:
    'Diese Produktionsquelle anstelle des aktuellen Dokuments öffnen?',
  saveSource: 'Aktuelles Dokument als lektorierte Quelle einreichen',
  authorSource: 'Autor: Quelle freigeben',
  editorSource: 'Redaktion: Quelle freigeben',
  toLayout: 'Quelle annehmen und zum Satz weiterleiten',
  openSourceFirst: 'Zuerst die freigegebene Quelle öffnen.',
  acceptanceRequired: 'Die genaue Quelle muss redaktionell angenommen sein.',
  format: 'Format der Korrekturfahne',
  buildProof: 'Korrekturfahne erstellen',
  proof: 'Korrekturfahne',
  viewProof: 'Aktuelle Korrekturfahne öffnen',
  locator: 'Seite, Absatz oder Element',
  note: 'Erforderliche Korrektur',
  addCorrection: 'Korrektur hinzufügen',
  resolution: 'Begründung der Bearbeitung',
  resolve: 'Bearbeitung erfassen',
  resolved: 'Abgeschlossen',
  authorProof: 'Autor: Korrekturfahne freigeben',
  editorProof: 'Redaktion: Korrekturfahne freigeben',
  ready: 'Zur Veröffentlichung freigeben',
  assignments: 'Produktionsaufträge',
  email: 'Studio-E-Mail',
  role: 'Aufgabe',
  dueAt: 'Frist (optional)',
  assign: 'Aufgabe zuweisen',
  revoke: 'Auftrag widerrufen',
  history: 'Frühere Quellen und Korrekturfahnen',
  stages: {
    COPYEDITING: 'Lektorat',
    LAYOUT: 'Satz',
    PROOFREADING: 'Korrektur',
    READY: 'Publikationsbereit',
  },
  roles: {
    COPYEDITOR: 'Lektorat',
    LAYOUT_EDITOR: 'Satz',
    PROOFREADER: 'Korrektur',
  },
};
