import { isPublicationMeasurementUnit, type PublicationMeasurementUnit } from '../model/publicationMeasurementUnits';
import { MatterNumber } from './PublicationMatterControls';
import { useEffect, useState } from 'react';
import { PublicationMatterFrameEditor } from './PublicationMatterFrameEditor';
import { useStudioStore } from '../app/useStudioStore';
import { importPublicationMatterImage, stagePublicationMatter } from '../app/publicationMatterActions';
import { createPublicationMatter, getPublicationMatter, publicationMatterTemplate, type PublicationMatterPage, type PublicationMatterPageKind } from '../model/publicationMatter';
import { getPublicationMatterCopy } from '../i18n/publicationMatter';
import { useTranslation } from '../i18n';
import { getAssetPayload } from '../services/assetRepository';
import { loadPublicationStyle } from '../services/publicationStyleExport';
import './PublicationMatterEditor.css';

export function PublicationMatterEditor({ widthMm, heightMm, readOnly = false }: { widthMm?: number; heightMm?: number; readOnly?: boolean }) {
  const { locale } = useTranslation();
  const copy = getPublicationMatterCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const [defaultStyle] = useState(loadPublicationStyle);
  const [unit, setUnit] = useState<PublicationMeasurementUnit>(() => {
    try { const saved = localStorage.getItem('omi-publication-matter-measurement-unit-v1'); return isPublicationMeasurementUnit(saved) ? saved : 'mm'; }
    catch { return 'mm'; }
  });
  useEffect(() => {
    try { localStorage.setItem('omi-publication-matter-measurement-unit-v1', unit); } catch { /* Device preferences are optional. */ }
  }, [unit]);
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
    <label>{copy.units}<select value={unit} onChange={(event) => { if (isPublicationMeasurementUnit(event.target.value)) setUnit(event.target.value); }}>
      <option value="mm">{copy.unitMm}</option><option value="pc">{copy.unitPica}</option><option value="pt">{copy.unitPoint}</option>
    </select></label><p>{copy.unitHelp}</p>
    <div className="omi-publication-matter-tabs" role="tablist" aria-label={copy.title}>
      {Object.entries(copy.pages).map(([kind, label]) => <button type="button" role="tab" key={kind}
        aria-selected={selected === kind} aria-controls="omi-publication-matter-selected" onClick={() => setSelected(kind as PublicationMatterPageKind)}>{label}</button>)}
    </div>
    <div id="omi-publication-matter-selected" role="tabpanel">
      <label className="omi-publication-matter-include"><input type="checkbox" checked={page.enabled} disabled={readOnly} onChange={(event) => update({ enabled: event.target.checked })} />{copy.include}</label>
      {!readOnly ? <button type="button" className="studio-menu-secondary-action" onClick={() => update({ content: publicationMatterTemplate(selected, manuscript) })}>{copy.template}</button> : null}
      {selected === 'spine' ? <><MatterNumber unit={unit} label={copy.spineWidth} min={1} max={100} value={model.spineWidthMm ?? 10} disabled={readOnly} onCommit={(value) => stagePublicationMatter({ ...model, spineWidthMm: value })} /><p>{copy.spineHelp}</p></> : null}
      <div className="omi-publication-matter-settings">
        <label>{copy.font}<input value={page.appearance.fontFamily} disabled={readOnly} maxLength={128} onChange={(event) => { if (event.target.value.trim()) appearance({ fontFamily: event.target.value }); }} /></label>
        <MatterNumber label={copy.size} min={6} max={120} value={page.appearance.fontSizePt} disabled={readOnly} onCommit={(value) => appearance({ fontSizePt: value })} />
        <label>{copy.color}<input type="color" value={page.appearance.color} disabled={readOnly} onChange={(event) => appearance({ color: event.target.value })} /></label>
        <label>{copy.background}<input type="color" value={page.appearance.background} disabled={readOnly} onChange={(event) => appearance({ background: event.target.value })} /></label>
        <MatterNumber unit={unit} label={copy.padding} min={0} max={60} value={page.appearance.paddingMm} disabled={readOnly} onCommit={(value) => appearance({ paddingMm: value })} />
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
      <PublicationMatterFrameEditor key={`${manuscript.id}:${selected}`} page={page} widthMm={selected === 'spine' ? model.spineWidthMm ?? 10 : widthMm ?? defaultStyle.page.width} heightMm={heightMm ?? defaultStyle.page.height}
        imageUrl={imageUrl} unit={unit} onChange={update} readOnly={readOnly} />
    </div>
  </section>;
}
