import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { OMI_CONTINUOUS_RICH_TEXT_EXTENSIONS } from '../editor/extensions/OmiRichTextExtensions';
import { useFormattingEditor } from '../editor/useFormattingEditor';
import { useStudioStore } from '../app/useStudioStore';
import { importPublicationMatterImage, stagePublicationMatter } from '../app/publicationMatterActions';
import { createPublicationMatter, getPublicationMatter, publicationMatterTemplate, type PublicationMatterPage, type PublicationMatterPageKind } from '../model/publicationMatter';
import { getPublicationMatterCopy } from '../i18n/publicationMatter';
import { getRichTextCopy } from '../i18n/richText';
import { useTranslation } from '../i18n';
import { getAssetPayload } from '../services/assetRepository';
import { loadPublicationStyle } from '../services/publicationStyleExport';
import './PublicationMatterEditor.css';

export function PublicationMatterEditor({ widthMm, heightMm, readOnly = false }: { widthMm?: number; heightMm?: number; readOnly?: boolean }) {
  const { locale } = useTranslation();
  const copy = getPublicationMatterCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const [defaultStyle] = useState(loadPublicationStyle);
  const model = getPublicationMatter(manuscript) ?? createPublicationMatter(manuscript);
  const [selected, setSelected] = useState<PublicationMatterPageKind>('front-cover');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const page = model.pages.find((item) => item.kind === selected) ?? createPublicationMatter(manuscript).pages.find((item) => item.kind === selected)!;
  const asset = manuscript.assets?.find((item) => item.id === page.image?.assetId);
  const [imageUrl, setImageUrl] = useState('');
  useEffect(() => {
    let disposed = false;
    let url = '';
    setImageUrl('');
    if (asset) void getAssetPayload(manuscript.id, asset.id).then((bytes) => {
      if (!bytes || disposed) return;
      url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: asset.mediaType }));
      setImageUrl(url);
    }).catch(() => setImageUrl(''));
    return () => { disposed = true; if (url) URL.revokeObjectURL(url); };
  }, [asset, manuscript.id]);

  function update(patch: Partial<PublicationMatterPage>) {
    if (readOnly) return;
    stagePublicationMatter({ ...model, pages: model.pages.some((item) => item.kind === selected)
      ? model.pages.map((item) => item.kind === selected ? { ...item, ...patch } : item)
      : [...model.pages, { ...page, ...patch }] });
  }
  function appearance(patch: Partial<PublicationMatterPage['appearance']>) { update({ appearance: { ...page.appearance, ...patch } }); }

  async function upload(file: File) {
    const manuscriptId = manuscript.id;
    const kind = selected;
    setBusy(true); setError('');
    try {
      const uploaded = await importPublicationMatterImage(file, manuscriptId);
      const latest = useStudioStore.getState().manuscript;
      if (latest.id !== manuscriptId) return;
      const current = getPublicationMatter(latest) ?? createPublicationMatter(latest);
      const currentPage = current.pages.find((item) => item.kind === kind) ?? createPublicationMatter(latest).pages.find((item) => item.kind === kind)!;
      const nextPage: PublicationMatterPage = { ...currentPage, image: { assetId: uploaded.id, alt: '', fit: 'cover' } };
      stagePublicationMatter({ ...current, pages: current.pages.some((item) => item.kind === kind)
        ? current.pages.map((item) => item.kind === kind ? nextPage : item) : [...current.pages, nextPage] }, uploaded, manuscriptId);
    } catch { setError(copy.imageError); }
    finally { setBusy(false); }
  }

  return <section className="omi-publication-matter-editor" aria-label={copy.title}>
    <h2>{copy.title}</h2><p>{copy.description}</p>
    <label>{copy.kind}<select disabled={readOnly} value={model.publicationKind}
      onChange={(event) => stagePublicationMatter({ ...model, publicationKind: event.target.value as 'volume' | 'journal-issue' })}>
      <option value="volume">{copy.volume}</option><option value="journal-issue">{copy.journal}</option>
    </select></label>
    <div className="omi-publication-matter-tabs" role="tablist" aria-label={copy.title}>
      {Object.entries(copy.pages).map(([kind, label]) => <button type="button" role="tab" key={kind}
        aria-selected={selected === kind} aria-controls="omi-publication-matter-selected" onClick={() => setSelected(kind as PublicationMatterPageKind)}>{label}</button>)}
    </div>
    <div id="omi-publication-matter-selected" role="tabpanel">
      <label className="omi-publication-matter-include"><input type="checkbox" checked={page.enabled} disabled={readOnly} onChange={(event) => update({ enabled: event.target.checked })} />{copy.include}</label>
      {!readOnly ? <button type="button" className="studio-menu-secondary-action" onClick={() => update({ content: publicationMatterTemplate(selected, manuscript) })}>{copy.template}</button> : null}
      <div className="omi-publication-matter-settings">
        <label>{copy.font}<input value={page.appearance.fontFamily} disabled={readOnly} maxLength={128} onChange={(event) => { if (event.target.value.trim()) appearance({ fontFamily: event.target.value }); }} /></label>
        <MatterNumber label={copy.size} min={6} max={120} value={page.appearance.fontSizePt} disabled={readOnly} onCommit={(value) => appearance({ fontSizePt: value })} />
        <label>{copy.color}<input type="color" value={page.appearance.color} disabled={readOnly} onChange={(event) => appearance({ color: event.target.value })} /></label>
        <label>{copy.background}<input type="color" value={page.appearance.background} disabled={readOnly} onChange={(event) => appearance({ background: event.target.value })} /></label>
        <MatterNumber label={copy.padding} min={0} max={60} value={page.appearance.paddingMm} disabled={readOnly} onCommit={(value) => appearance({ paddingMm: value })} />
        <label>{copy.alignment}<select value={page.appearance.alignment} disabled={readOnly} onChange={(event) => appearance({ alignment: event.target.value as 'left' | 'center' | 'right' })}>
          <option value="left">{copy.left}</option><option value="center">{copy.center}</option><option value="right">{copy.right}</option>
        </select></label>
        <label>{copy.vertical}<select value={page.appearance.vertical} disabled={readOnly} onChange={(event) => appearance({ vertical: event.target.value as 'top' | 'center' | 'bottom' })}>
          <option value="top">{copy.top}</option><option value="center">{copy.middle}</option><option value="bottom">{copy.bottom}</option>
        </select></label>
        {!readOnly ? <label>{copy.image}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }} /></label> : null}
        {page.image ? <>
          <label>{copy.alt}<input value={page.image.alt} disabled={readOnly} onChange={(event) => update({ image: { ...page.image!, alt: event.target.value } })} /></label>
          <label>{copy.fit}<select value={page.image.fit} disabled={readOnly} onChange={(event) => update({ image: { ...page.image!, fit: event.target.value as 'cover' | 'contain' } })}><option value="cover">{copy.cover}</option><option value="contain">{copy.contain}</option></select></label>
          {!readOnly ? <button type="button" onClick={() => update({ image: undefined })}>{copy.removeImage}</button> : null}
        </> : null}
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <MatterPageContent key={`${manuscript.id}:${selected}`} page={page} widthMm={widthMm ?? defaultStyle.page.width} heightMm={heightMm ?? defaultStyle.page.height}
        imageUrl={imageUrl} onChange={(content) => update({ content })} readOnly={readOnly} />
    </div>
  </section>;
}

function MatterPageContent({ page, widthMm, heightMm, imageUrl, onChange, readOnly }: {
  page: PublicationMatterPage; widthMm: number; heightMm: number; imageUrl: string; onChange(content: string): void; readOnly: boolean;
}) {
  const { locale } = useTranslation();
  const copy = getPublicationMatterCopy(locale);
  const format = getRichTextCopy(locale);
  const change = useRef(onChange); change.current = onChange;
  const paper = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const editor = useEditor({ editable: !readOnly, extensions: [StarterKit.configure({ horizontalRule: false, link: false, underline: false }),
    ...OMI_CONTINUOUS_RICH_TEXT_EXTENSIONS.filter((extension) => extension.name !== 'omiBlockTypeMenu')],
    content: JSON.parse(page.content), editorProps: { attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': copy.content } },
    onUpdate: ({ editor: current }) => change.current(JSON.stringify(current.getJSON())),
  });
  useFormattingEditor(editor);
  const marks = ['bold', 'italic', 'omiUnderline', 'omiSmallCaps', 'omiSuperscript', 'omiSubscript'];
  const active = useEditorState({ editor, selector: ({ editor: current }) => marks.map((mark) => current?.isActive(mark) ?? false) });
  useEffect(() => { editor?.setEditable(!readOnly); }, [editor, readOnly]);
  useEffect(() => {
    if (!editor) return;
    const next = editor.schema.nodeFromJSON(JSON.parse(page.content)).toJSON();
    if (JSON.stringify(next) === JSON.stringify(editor.getJSON())) return;
    const { from, to } = editor.state.selection;
    editor.commands.setContent(next, { emitUpdate: false });
    const max = editor.state.doc.content.size;
    editor.commands.setTextSelection({ from: Math.min(from, max), to: Math.min(to, max) });
  }, [editor, page.content]);
  useEffect(() => {
    if (!paper.current) return;
    const measure = () => { if (paper.current) setScale(paper.current.clientWidth / (widthMm * 96 / 25.4)); };
    const observer = new ResizeObserver(measure); observer.observe(paper.current); measure();
    return () => observer.disconnect();
  }, [widthMm]);
  const style: CSSProperties = { background: page.appearance.background, color: page.appearance.color,
    aspectRatio: `${widthMm}/${heightMm}`, padding: page.appearance.paddingMm * 96 / 25.4 * scale,
    fontFamily: page.appearance.fontFamily, fontSize: `${page.appearance.fontSizePt * scale}pt`, textAlign: page.appearance.alignment,
    justifyContent: { top: 'flex-start', center: 'center', bottom: 'flex-end' }[page.appearance.vertical] };
  return <>
    {editor && !readOnly ? <div className="omi-publication-matter-format" role="group" aria-label={format.toolbar}>
      {[format.bold, format.italic, format.underline, format.smallCaps, format.superscript, format.subscript].map((label, index) => <button type="button" key={label} title={label} aria-label={label} aria-pressed={active?.[index] ?? false}
        onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().toggleMark(marks[index]!).run()}>{['B', 'I', 'U', 'Aa', 'x²', 'x₂'][index]}</button>)}
    </div> : null}
    <div ref={paper} className="omi-publication-matter-paper" style={style}>
      {imageUrl ? <img src={imageUrl} alt={page.image?.alt ?? ''} style={{ objectFit: page.image?.fit }} /> : null}
      <EditorContent editor={editor} />
    </div>
  </>;
}

function MatterNumber({ label, min, max, value, disabled, onCommit }: {
  label: string; min: number; max: number; value: number; disabled: boolean; onCommit(value: number): void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return <label>{label}<input type="number" min={min} max={max} value={draft} disabled={disabled}
    onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
    onBlur={() => { const next = Number(draft); if (draft.trim() && Number.isFinite(next) && next >= min && next <= max) onCommit(next); else setDraft(String(value)); }} /></label>;
}
