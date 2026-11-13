import { saveExportBlob } from '../../services/exportFileDelivery';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { stageInsertBlocks } from '../../app/visualBlockActions';
import { useStudioStore } from '../../app/useStudioStore';
import { buildGraphDiagramContribution, diagramSourceSuggestion } from './manuscriptContribution';
import { newWorkspaceId, safeWorkspaceFileName } from '../disciplineWorkspace';
import { graphCopy, nodeLabels, relationLabels, type GraphCopy } from './copy';
import { decodeGedcom, parseGedcom } from './gedcom';
import { GraphCanvas } from './GraphCanvas';
import { graphLayout, graphSvg } from './layout';
import {
  CERTAINTIES,
  createGraphWorkspace,
  GraphError,
  MAX_GRAPH_NODES,
  MAX_IMPORT_BYTES,
  mergeGraphs,
  newGraphEdge,
  newGraphNode,
  NODE_KINDS,
  parseGraphJson,
  PEDIGREES,
  putEdge,
  RELATION_KINDS,
  relationshipCsv,
  removeNode,
  type GraphEdge,
  type GraphMode,
  type GraphNode,
  type GraphWorkspace,
  type NodeKind,
} from './model';
import { useGraphWorkspace } from './useGraphWorkspace';
import './genealogy.css';

function errorMessage(error: unknown, t: GraphCopy): string {
  const keys: Record<string, keyof GraphCopy> = {
    invalid: 'errorInvalid',
    limit: 'errorLimit',
    cycle: 'errorCycle',
    duplicate: 'errorDuplicate',
    self: 'errorSelf',
    reference: 'errorReference',
    encoding: 'errorEncoding',
    gedcom: 'errorGedcom',
    version: 'errorVersion',
  };
  return error instanceof GraphError
    ? `${t[keys[error.code] ?? 'errorInvalid']}${error.line ? ` (${t.line} ${error.line})` : ''}`
    : t.errorRead;
}
export function GenealogyNetworkPanel({
  locale = 'en',
  storageKey,
  mode,
}: {
  locale?: string;
  storageKey: string;
  mode: GraphMode;
}) {
  const t = graphCopy(locale),
    types = nodeLabels(t),
    relations = relationLabels(t);
  const { workspace, status, canUndo, update, undo } =
    useGraphWorkspace(storageKey);
  const [selectedId, setSelectedId] = useState(''),
    [search, setSearch] = useState(''),
    [nodeKind, setNodeKind] = useState<NodeKind>('person');
  const [draft, setDraft] = useState<GraphNode | null>(null),
    [edgeDraft, setEdgeDraft] = useState<GraphEdge | null>(null);
  const [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [encoding, setEncoding] = useState('auto');
  const [pending, setPending] = useState<{
    workspace: GraphWorkspace;
    fileName: string;
    warnings: Record<string, number>;
  } | null>(null);
  const [focus, setFocus] = useState(false),
    [depth, setDepth] = useState(3);
  const [diagramReview, setDiagramReview] = useState<{ svg: string; fingerprint: string; manuscriptId: string; sectionId: string } | null>(null);
  const diagramSourceId = useId();
  const [diagramSource, setDiagramSource] = useState('');
  const [diagramOwn, setDiagramOwn] = useState(false);
  const [diagramApproved, setDiagramApproved] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const people = workspace.nodes.filter(
    (n) => mode === 'network' || n.kind === 'person',
  );
  const selected = people.find((n) => n.id === selectedId) ?? people[0];
  useEffect(() => {
    setDraft(selected ? { ...selected } : null);
    setEdgeDraft(null);
  }, [selected]);
  const layout = useMemo(
    () => graphLayout(workspace, mode, focus ? selected?.id : '', depth),
    [workspace, mode, focus, selected?.id, depth],
  );
  const manuscript = useStudioStore((s) => s.manuscript),
    sectionId = useStudioStore((s) => s.selectedSectionId);
  const target =
    manuscript.sections.find((s) => s.id === sectionId) ??
    manuscript.sections[0];
  const filename = safeWorkspaceFileName(workspace.title, 'research-graph');
  const related = workspace.edges.filter(
    (e) =>
      (e.from === selected?.id || e.to === selected?.id) &&
      (mode === 'network' ||
        ['parent', 'partner', 'kinship', 'godparent', 'other'].includes(
          e.kind,
        )),
  );
  const displayed = people
    .filter((n) =>
      `${n.label} ${n.givenName} ${n.familyName} ${n.alternateNames.join(' ')}`
        .toLocaleLowerCase(locale)
        .includes(search.toLocaleLowerCase(locale)),
    )
    .slice(0, 200);
  const names = new Map(workspace.nodes.map((n) => [n.id, n.label]));
  const pedigreeLabels = {
    unspecified: t.unspecified,
    birth: t.birthParentage,
    adopted: t.adopted,
    foster: t.foster,
    other: t.otherParentage,
  };
  const certaintyLabels = {
    documented: t.documented,
    probable: t.probable,
    uncertain: t.uncertain,
  };
  function apply(
    change: GraphWorkspace | ((current: GraphWorkspace) => GraphWorkspace),
  ) {
    try {
      update(change);
      setError('');
      setMessage('');
      return true;
    } catch (e) {
      setError(errorMessage(e, t));
      return false;
    }
  }
  function add() {
    if (workspace.nodes.length >= MAX_GRAPH_NODES) {
      setError(t.errorLimit);
      return;
    }
    const node = newGraphNode(
      newWorkspaceId(),
      mode === 'tree' ? 'person' : nodeKind,
    );
    node.label = node.kind === 'person' ? t.newPerson : t.newEntity;
    if (apply((current) => ({ ...current, nodes: [...current.nodes, node] })))
      setSelectedId(node.id);
  }
  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError('');
    setPending(null);
    try {
      if (
        file.size >
        (/\.json$/i.test(file.name) ? MAX_IMPORT_BYTES * 8 : MAX_IMPORT_BYTES)
      )
        throw new GraphError('limit');
      if (/\.json$/i.test(file.name)) {
        setPending({
          workspace: parseGraphJson(await file.text()),
          fileName: file.name,
          warnings: {},
        });
      } else {
        const bytes = new Uint8Array(await file.arrayBuffer()),
          raw = decodeGedcom(bytes, encoding),
          result = parseGedcom(raw, file.name);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000)
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        result.workspace.imports[0]!.originalBase64 = btoa(binary);
        setPending({
          workspace: result.workspace,
          fileName: file.name,
          warnings: result.warnings,
        });
      }
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }
  function acceptImport(replace = false) {
    if (!pending) return;
    if (replace && workspace.nodes.length && !window.confirm(t.replaceConfirm))
      return;
    try {
      const next = replace
        ? pending.workspace
        : mergeGraphs(workspace, pending.workspace, newWorkspaceId);
      if (apply(next)) {
        setPending(null);
        setSelectedId('');
        setSearch('');
      }
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }
  function beginRelation() {
    if (!selected) return;
    const other = workspace.nodes.find(
      (n) =>
        n.id !== selected.id && (mode === 'network' || n.kind === 'person'),
    );
    setEdgeDraft(
      newGraphEdge(
        newWorkspaceId(),
        selected.id,
        other?.id ?? '',
        mode === 'tree' ? 'parent' : 'other',
      ),
    );
  }
  async function downloadFile(
    name: string,
    content: string | Uint8Array<ArrayBuffer>,
    type: string,
  ) {
    setError('');
    try {
      await saveExportBlob(new Blob([content], { type }), name);
    } catch {
      setError(t.exportError);
    }
  }
  function insertDiagram() {
    if (!target) { setError(t.insertError); return; }
    const svg = graphSvg(layout, relations, workspace.title || t[mode === 'tree' ? 'tree' : 'network']);
    setDiagramReview({ svg, fingerprint: JSON.stringify({ storageKey, workspace, layout: layout.workspace }), manuscriptId: manuscript.id, sectionId: target.id });
    setDiagramSource(diagramSourceSuggestion(layout.workspace) || workspace.imports.map(item => item.fileName).join('; ').slice(0,20000));
    setDiagramOwn(false);
    setDiagramApproved(false);
    setError('');
  }
  function confirmDiagram() {
    if (!diagramReview || !target || diagramReview.manuscriptId !== manuscript.id || diagramReview.sectionId !== target.id
      || diagramReview.fingerprint !== JSON.stringify({ storageKey, workspace, layout: layout.workspace })) {
      setDiagramApproved(false); setError(t.diagramChanged); return;
    }
    try {
      const contribution = buildGraphDiagramContribution({ svg: diagramReview.svg, title: workspace.title || t.title,
        width: layout.width, height: layout.height, source: diagramSource, selfAuthored: diagramOwn,
        approved: diagramApproved, sourceLabel: t.source, timestamp: new Date().toISOString(), existingRecords: manuscript.bibliographicRecords ?? [] });
      if (stageInsertBlocks(target.id, target.blocks.length, contribution.blocks, 'Insert attributed research diagram',
        contribution.annotations, contribution.sourceAttributions, contribution.bibliographicRecords)) {
        setDiagramReview(null); setDiagramApproved(false); setMessage(t.inserted); setError('');
      } else setError(t.insertError);
    } catch { setError(t.diagramReviewRequired); }
  }

  return (
    <section
      className="genealogy-workspace"
      aria-label={mode === 'tree' ? t.tree : t.network}
    >
      <p>{t.intro}</p>
      <div className="genealogy-toolbar">
        <label>
          {t.project}
          <input
            defaultValue={workspace.title}
            key={workspace.title}
            maxLength={1000}
            disabled={status === 'loading'}
            onBlur={(e) => {
              const title = e.target.value;
              if (title !== workspace.title)
                apply((current) => ({ ...current, title }));
            }}
          />
        </label>
        <button type="button" disabled={!canUndo} onClick={undo}>
          {t.undo}
        </button>
        <button
          type="button"
          disabled={status === 'loading'}
          onClick={() => {
            if (!workspace.nodes.length || window.confirm(t.clearConfirm)) {
              apply(createGraphWorkspace());
              setSelectedId('');
            }
          }}
        >
          {t.clear}
        </button>
      </div>
      <p className="genealogy-hint">{t.local}</p>
      <p role={status === 'error' ? 'alert' : 'status'}>
        {status === 'loading'
          ? t.loading
          : status === 'saving'
            ? t.saving
            : status === 'error'
              ? t.storageError
              : t.saved}
      </p>
      <fieldset
        disabled={status === 'loading' || busy}
        className="genealogy-import"
      >
        <legend>{t.import}</legend>
        <p>{t.importHint}</p>
        <div className="genealogy-toolbar">
          <label>
            {t.encoding}
            <select
              value={encoding}
              onChange={(e) => setEncoding(e.target.value)}
            >
              <option value="auto">{t.auto}</option>
              {[
                'utf-8',
                'utf-16le',
                'utf-16be',
                'windows-1250',
                'windows-1252',
              ].map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </label>
          <input
            ref={input}
            type="file"
            accept=".ged,.gedcom,.json"
            aria-label={t.import}
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() =>
              downloadFile(
                `${filename}.json`,
                JSON.stringify(workspace, null, 2),
                'application/json;charset=utf-8',
              )
            }
          >
            {t.exportJson}
          </button>
          <button
            type="button"
            disabled={!layout.workspace.nodes.length}
            onClick={() =>
              downloadFile(
                `${filename}-${mode}.svg`,
                graphSvg(layout, relations, workspace.title || t.title),
                'image/svg+xml;charset=utf-8',
              )
            }
          >
            {t.exportSvg}
          </button>
          <button
            type="button"
            disabled={!workspace.edges.length}
            onClick={() =>
              downloadFile(
                `${filename}-relationships.csv`,
                relationshipCsv(workspace),
                'text/csv;charset=utf-8',
              )
            }
          >
            {t.exportCsv}
          </button>
        </div>
        {pending && (
          <div className="genealogy-import-preview">
            <h5>
              {t.preview}: {pending.fileName}
            </h5>
            <p>
              {t.counts}: {pending.workspace.nodes.length} /{' '}
              {pending.workspace.edges.length}
            </p>
            <p>
              {pending.workspace.nodes
                .slice(0, 5)
                .map((n) => n.label)
                .join(' · ')}
            </p>
            <ul>
              {Object.entries(pending.warnings).map(([key, count]) => (
                <li key={key}>
                  {t[key as keyof GraphCopy] ?? key}
                  {count > 1 ? ` (${count})` : ''}
                </li>
              ))}
            </ul>
            <p>{t.mergeHint}</p>
            <div className="genealogy-toolbar">
              <button type="button" onClick={() => acceptImport()}>
                {t.merge}
              </button>
              <button type="button" onClick={() => acceptImport(true)}>
                {t.replace}
              </button>
              <button type="button" onClick={() => setPending(null)}>
                {t.cancel}
              </button>
            </div>
          </div>
        )}
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <fieldset disabled={status === 'loading'} className="genealogy-controls">
        <legend>{t.people}</legend>
        <div className="genealogy-toolbar">
          <label>
            {t.search}
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {mode === 'network' && (
            <label>
              {t.addNode}
              <select
                value={nodeKind}
                onChange={(e) => setNodeKind(e.target.value as NodeKind)}
              >
                {NODE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {types[kind]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" onClick={add}>
            {mode === 'tree' ? t.addPerson : t.addNode}
          </button>
        </div>
        <label>
          {t.people} ({people.length})
          <select
            size={Math.min(6, Math.max(2, displayed.length))}
            value={selected?.id ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {selected && !displayed.some((n) => n.id === selected.id) && (
              <option value={selected.id}>{selected.label}</option>
            )}
            {displayed.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label} {n.birthDate ? `(${n.birthDate})` : ''}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      {!workspace.nodes.length ? (
        <p>{t.noNodes}</p>
      ) : (
        <>
          <div className="genealogy-toolbar">
            <label className="genealogy-checkbox">
              <input
                type="checkbox"
                checked={focus}
                onChange={(e) => setFocus(e.target.checked)}
              />
              {t.focus}
            </label>
            <label>
              {t.depth}
              <select
                value={depth}
                onChange={(e) => setDepth(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() =>
                apply((current) => ({
                  ...current,
                  nodes: current.nodes.map((n) => ({
                    ...n,
                    [mode === 'tree' ? 'treePosition' : 'networkPosition']:
                      undefined,
                  })),
                }))
              }
            >
              {t.layout}
            </button>
            <button
              type="button"
              disabled={!target || !layout.workspace.nodes.length}
              onClick={insertDiagram}
            >
              {t.insert}
            </button>
          </div>
          <GraphCanvas
            layout={layout}
            selected={selected?.id ?? ''}
            onSelect={setSelectedId}
            onMove={(id, position) =>
              apply((current) => ({
                ...current,
                nodes: current.nodes.map((n) =>
                  n.id === id
                    ? {
                        ...n,
                        [mode === 'tree' ? 'treePosition' : 'networkPosition']:
                          position,
                      }
                    : n,
                ),
              }))
            }
            t={t}
          />
        </>
      )}
      {diagramReview && <section className="genealogy-diagram-review" aria-label={t.diagramReview}>
        <h3>{t.diagramReview}</h3>
        <img alt={t.diagramReview} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(diagramReview.svg)}`} style={{ maxWidth: '100%' }} />
        <p>{t.diagramSnapshot}</p>
        <label htmlFor={diagramSourceId}>{t.source}</label>
        <textarea id={diagramSourceId} maxLength={20000} value={diagramSource} onChange={e => { setDiagramSource(e.target.value); setDiagramApproved(false); }} />
        <label><input type="checkbox" checked={diagramOwn} onChange={e => { setDiagramOwn(e.target.checked); setDiagramApproved(false); }} />{t.diagramOwn}</label>
        <label><input type="checkbox" checked={diagramApproved} onChange={e => setDiagramApproved(e.target.checked)} />{t.diagramApprove}</label>
        <button type="button" disabled={!diagramApproved || (!diagramOwn && !diagramSource.trim())} onClick={confirmDiagram}>{t.diagramConfirm}</button>
        <button type="button" onClick={() => { setDiagramReview(null); setDiagramApproved(false); }}>{t.cancel}</button>
      </section>}
      {draft && (
        <form
          className="genealogy-entity-form"
          onSubmit={(e) => {
            e.preventDefault();
            const node = {
              ...draft,
              label:
                draft.label.trim() ||
                [draft.givenName, draft.familyName].filter(Boolean).join(' ') ||
                t.newPerson,
            };
            apply((current) => ({
              ...current,
              nodes: current.nodes.map((n) => (n.id === node.id ? node : n)),
            }));
          }}
        >
          <fieldset>
            <legend>
              {types[draft.kind]}: {selected?.label}
            </legend>
            <div className="genealogy-form-grid">
              {(
                [
                  ['label', t.name],
                  ...(draft.kind === 'person'
                    ? [
                        ['givenName', t.given],
                        ['familyName', t.family],
                        ['birthDate', t.birth],
                        ['birthPlace', t.birthPlace],
                        ['deathDate', t.death],
                        ['deathPlace', t.deathPlace],
                      ]
                    : []),
                  ['source', t.source],
                ] as [keyof GraphNode, string][]
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    value={String(draft[key] ?? '')}
                    maxLength={key === 'source' ? 100000 : 1000}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              {draft.kind === 'person' && (
                <label>
                  {t.sex}
                  <select
                    value={draft.sex}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        sex: e.target.value as GraphNode['sex'],
                      })
                    }
                  >
                    <option value="U">{t.unknown}</option>
                    <option value="M">{t.male}</option>
                    <option value="F">{t.female}</option>
                    <option value="X">{t.otherSex}</option>
                  </select>
                </label>
              )}
              <label className="genealogy-full">
                {t.notes}
                <textarea
                  rows={3}
                  value={draft.notes}
                  maxLength={100000}
                  onChange={(e) =>
                    setDraft({ ...draft, notes: e.target.value })
                  }
                />
              </label>
              {draft.kind === 'person' && (
                <label className="genealogy-full">
                  {t.alternateNames}
                  <textarea
                    rows={2}
                    value={draft.alternateNames.join('\n')}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        alternateNames: e.target.value
                          .split(/\r?\n/)
                          .filter(Boolean),
                      })
                    }
                  />
                </label>
              )}
            </div>
            <p className="genealogy-hint">{t.datesHint}</p>
            <div className="genealogy-toolbar">
              <button type="submit">{t.save}</button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t.deleteNodeConfirm)) {
                    apply((current) => removeNode(current, draft.id));
                    setSelectedId('');
                  }
                }}
              >
                {t.deleteNode}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      <fieldset>
        <legend>{t.relationships}</legend>
        <button
          type="button"
          disabled={!selected || workspace.nodes.length < 2}
          onClick={beginRelation}
        >
          {t.addRelation}
        </button>
        {related.length ? (
          <ul className="genealogy-relation-list">
            {related.slice(0, 200).map((edge) => (
              <li key={edge.id}>
                <button type="button" onClick={() => setEdgeDraft({ ...edge })}>
                  {names.get(edge.from)} {edge.directed ? '→' : '—'}{' '}
                  {names.get(edge.to)} · {edge.label || relations[edge.kind]}{' '}
                  {edge.kind === 'parent'
                    ? `· ${pedigreeLabels[edge.pedigree]}`
                    : ''}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t.noRelations}</p>
        )}
        {edgeDraft && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (apply((current) => putEdge(current, edgeDraft)))
                setEdgeDraft(null);
            }}
          >
            <h5>
              {workspace.edges.some((e) => e.id === edgeDraft.id)
                ? t.editRelation
                : t.addRelation}
            </h5>
            <div className="genealogy-form-grid">
              {(['from', 'to'] as const).map((key) => (
                <label key={key}>
                  {t[key]}
                  <select
                    value={edgeDraft[key]}
                    required
                    onChange={(e) =>
                      setEdgeDraft({ ...edgeDraft, [key]: e.target.value })
                    }
                  >
                    <option value="">—</option>
                    {workspace.nodes
                      .filter(
                        (n) =>
                          !['parent', 'partner'].includes(edgeDraft.kind) ||
                          n.kind === 'person',
                      )
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
              <label>
                {t.relation}
                <select
                  value={edgeDraft.kind}
                  onChange={(e) => {
                    const kind = e.target.value as GraphEdge['kind'];
                    setEdgeDraft({
                      ...edgeDraft,
                      kind,
                      directed: !['partner', 'kinship'].includes(kind),
                    });
                  }}
                >
                  {RELATION_KINDS.filter(
                    (kind) =>
                      mode === 'network' ||
                      [
                        'parent',
                        'partner',
                        'kinship',
                        'godparent',
                        'other',
                      ].includes(kind),
                  ).map((kind) => (
                    <option key={kind} value={kind}>
                      {relations[kind]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t.relationLabel}
                <input
                  value={edgeDraft.label}
                  maxLength={1000}
                  onChange={(e) =>
                    setEdgeDraft({ ...edgeDraft, label: e.target.value })
                  }
                />
              </label>
              {edgeDraft.kind === 'parent' && (
                <label>
                  {t.pedigree}
                  <select
                    value={edgeDraft.pedigree}
                    onChange={(e) =>
                      setEdgeDraft({
                        ...edgeDraft,
                        pedigree: e.target.value as GraphEdge['pedigree'],
                      })
                    }
                  >
                    {PEDIGREES.map((kind) => (
                      <option key={kind} value={kind}>
                        {pedigreeLabels[kind]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                {t.certainty}
                <select
                  value={edgeDraft.certainty}
                  onChange={(e) =>
                    setEdgeDraft({
                      ...edgeDraft,
                      certainty: e.target.value as GraphEdge['certainty'],
                    })
                  }
                >
                  {CERTAINTIES.map((kind) => (
                    <option key={kind} value={kind}>
                      {certaintyLabels[kind]}
                    </option>
                  ))}
                </select>
              </label>
              {(['startDate', 'endDate', 'place', 'source'] as const).map(
                (key) => (
                  <label key={key}>
                    {key === 'startDate'
                      ? t.start
                      : key === 'endDate'
                        ? t.end
                        : key === 'place'
                          ? t.place
                          : t.source}
                    <input
                      value={edgeDraft[key]}
                      maxLength={key === 'source' ? 100000 : 1000}
                      onChange={(e) =>
                        setEdgeDraft({ ...edgeDraft, [key]: e.target.value })
                      }
                    />
                  </label>
                ),
              )}
              <label className="genealogy-full">
                {t.notes}
                <textarea
                  rows={2}
                  value={edgeDraft.notes}
                  maxLength={100000}
                  onChange={(e) =>
                    setEdgeDraft({ ...edgeDraft, notes: e.target.value })
                  }
                />
              </label>
              <label className="genealogy-checkbox">
                <input
                  type="checkbox"
                  checked={edgeDraft.directed}
                  disabled={edgeDraft.kind === 'parent'}
                  onChange={(e) =>
                    setEdgeDraft({ ...edgeDraft, directed: e.target.checked })
                  }
                />
                {t.directed}
              </label>
            </div>
            <div className="genealogy-toolbar">
              <button type="submit">{t.save}</button>
              <button type="button" onClick={() => setEdgeDraft(null)}>
                {t.cancel}
              </button>
              {workspace.edges.some((e) => e.id === edgeDraft.id) && (
                <button
                  type="button"
                  onClick={() => {
                    apply((current) => ({
                      ...current,
                      edges: current.edges.filter((e) => e.id !== edgeDraft.id),
                    }));
                    setEdgeDraft(null);
                  }}
                >
                  {t.remove}
                </button>
              )}
            </div>
          </form>
        )}
      </fieldset>
      {!!workspace.imports.length && (
        <details>
          <summary>{t.original}</summary>
          <ul>
            {workspace.imports.map((source) => (
              <li key={source.id}>
                <button
                  type="button"
                  onClick={() =>
                    downloadFile(
                      source.fileName,
                      source.originalBase64
                        ? Uint8Array.from(atob(source.originalBase64), (c) =>
                            c.charCodeAt(0),
                          )
                        : source.originalText,
                      'application/octet-stream',
                    )
                  }
                >
                  {source.fileName} · {source.format}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
