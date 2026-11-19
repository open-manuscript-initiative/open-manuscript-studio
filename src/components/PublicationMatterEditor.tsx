import { PublicationMeasurementSelector, usePublicationMeasurementUnit } from './PublicationMeasurementControls';
import { MatterNumber } from './PublicationMatterControls';
import { createCoverSheetFrame, getPublicationCoverSheet, isPublicationCoverSheet, publicationCoverPanels } from '../model/publicationCoverSheet';
import { formatPublicationMeasurement } from '../model/publicationMeasurementUnits';
import { publicationInsidePageCount, publicationSpineWidth } from '../model/publicationSpine';
import { PublicationSpineControls } from './PublicationSpineControls';
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

export function PublicationMatterEditor({ widthMm, heightMm, bodyPageCount, readOnly = false }: { widthMm?: number; heightMm?: number; bodyPageCount?: number; readOnly?: boolean }) {
  const { locale } = useTranslation();
  const copy = getPublicationMatterCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const [defaultStyle] = useState(loadPublicationStyle);
  const [unit] = usePublicationMeasurementUnit();
  const model = getPublicationMatter(manuscript) ?? createPublicationMatter(manuscript);
  const [selected, setSelected] = useState<PublicationMatterPageKind>('cover-outside');
  const [area, setArea] = useState<PublicationMatterPageKind>('front-cover');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const trimWidth = widthMm ?? defaultStyle.page.width, trimHeight = heightMm ?? defaultStyle.page.height;
  const sheet = isPublicationCoverSheet(selected);
  const spineWidth = publicationSpineWidth(model);
  const paperWidth = sheet ? 2 * trimWidth + spineWidth : trimWidth;
  const page = isPublicationCoverSheet(selected) ? getPublicationCoverSheet(model, selected, trimWidth, trimHeight)
    : model.pages.find((item) => item.kind === selected) ?? createPublicationMatter(manuscript).pages.find((item) => item.kind === selected)!;
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
      const currentPage = isPublicationCoverSheet(kind) ? getPublicationCoverSheet(current, kind, trimWidth, trimHeight) : current.pages.find((item) => item.kind === kind) ?? createPublicationMatter(latest).pages.find((item) => item.kind === kind)!;
      const nextPage: PublicationMatterPage = { ...currentPage, image: { assetId: uploaded.id, alt: '', fit: 'cover' } };
      stagePublicationMatter({ ...current, pages: current.pages.some((item) => item.kind === kind)
        ? current.pages.map((item) => item.kind === kind ? nextPage : item) : [...current.pages, nextPage] }, uploaded, manuscriptId);
    } catch { setError(copy.imageError); }
    finally { setBusy(false); }
  }

  return <section className="omi-publication-matter-editor" aria-label={copy.title}>
    <h2>{copy.title}</h2><p>{copy.description}</p>
    <label>{copy.kind}<select aria-label={copy.kind} disabled={readOnly} value={model.publicationKind}
      onChange={(event) => stagePublicationMatter({ ...model, publicationKind: event.target.value as 'volume' | 'journal-issue' })}>
      <option value="volume">{copy.volume}</option><option value="journal-issue">{copy.journal}</option>
    </select></label>
    <PublicationMeasurementSelector /><p>{copy.unitHelp}</p>
    <div className="omi-publication-matter-tabs" role="tablist" aria-label={copy.title}>
      {(['cover-outside', 'cover-inside', 'half-title', 'series-page', 'title-page', 'imprint-page'] as const).map((kind) => <button type="button" role="tab" key={kind}
        aria-selected={selected === kind} aria-controls="omi-publication-matter-selected" onClick={() => { setSelected(kind); setArea(kind === 'cover-outside' ? 'front-cover' : kind === 'cover-inside' ? 'inside-front-cover' : kind); }}>{copy.pages[kind]}</button>)}
    </div>
    <div id="omi-publication-matter-selected" role="tabpanel">
      <label className="omi-publication-matter-include"><input type="checkbox" checked={page.enabled} disabled={readOnly} onChange={(event) => update({ enabled: event.target.checked })} />{copy.include}</label>
      {!readOnly ? <button type="button" className="studio-menu-secondary-action" onClick={() => {
        if (isPublicationCoverSheet(selected)) {
          if ((page.frames?.length ?? 0) >= 512) return;
          const frame = createCoverSheetFrame('text', area, selected, trimWidth, trimHeight, spineWidth);
          frame.content = publicationMatterTemplate(area, manuscript);
          update({ frames: [...(page.frames ?? []), frame] });
        } else update({ content: publicationMatterTemplate(selected, manuscript) });
      }}>{copy.template}</button> : null}
      {sheet ? <><PublicationSpineControls model={model} insidePageCount={bodyPageCount ? publicationInsidePageCount(model, bodyPageCount) : undefined} unit={unit} readOnly={readOnly} onChange={stagePublicationMatter} /><p>{copy.sheetHelp}</p>
        <p className="omi-cover-sheet-dimensions">{copy.sheetSize}: {formatPublicationMeasurement(paperWidth, unit)} × {formatPublicationMeasurement(trimHeight, unit)} {unit}</p>
        <label>{copy.frameArea}<select aria-label={copy.frameArea} value={isPublicationCoverSheet(selected) && publicationCoverPanels(selected, trimWidth, spineWidth).some((panel) => panel.kind === area && panel.widthMm > 0) ? area : selected} onChange={(event) => setArea(event.target.value as PublicationMatterPageKind)}>
          <option value={selected}>{copy.wholeSheet}</option>
          {isPublicationCoverSheet(selected) ? publicationCoverPanels(selected, trimWidth, spineWidth).filter((panel) => panel.widthMm > 0).map((panel) => <option key={panel.kind} value={panel.kind}>{copy.pages[panel.kind]}</option>) : null}
        </select></label>
      </> : null}
      <div className="omi-publication-matter-settings">
        <label>{copy.font}<input value={page.appearance.fontFamily} disabled={readOnly} maxLength={128} onChange={(event) => { if (event.target.value.trim()) appearance({ fontFamily: event.target.value }); }} /></label>
        <MatterNumber label={copy.size} min={6} max={120} value={page.appearance.fontSizePt} disabled={readOnly} onCommit={(value) => appearance({ fontSizePt: value })} />
        <label>{copy.color}<input type="color" value={page.appearance.color} disabled={readOnly} onChange={(event) => appearance({ color: event.target.value })} /></label>
        <label>{copy.background}<input type="color" value={page.appearance.background} disabled={readOnly} onChange={(event) => appearance({ background: event.target.value })} /></label>
        <MatterNumber unit={unit} label={copy.padding} min={0} max={60} value={page.appearance.paddingMm} disabled={readOnly} onCommit={(value) => appearance({ paddingMm: value })} />
        <label>{copy.alignment}<select aria-label={copy.alignment} value={page.appearance.alignment} disabled={readOnly} onChange={(event) => appearance({ alignment: event.target.value as 'left' | 'center' | 'right' })}>
          <option value="left">{copy.left}</option><option value="center">{copy.center}</option><option value="right">{copy.right}</option>
        </select></label>
        <label>{copy.vertical}<select aria-label={copy.vertical} value={page.appearance.vertical} disabled={readOnly} onChange={(event) => appearance({ vertical: event.target.value as 'top' | 'center' | 'bottom' })}>
          <option value="top">{copy.top}</option><option value="center">{copy.middle}</option><option value="bottom">{copy.bottom}</option>
        </select></label>
        {!readOnly ? <label>{copy.image}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }} /></label> : null}
        {page.image ? <>
          <label>{copy.alt}<input value={page.image.alt} disabled={readOnly} onChange={(event) => update({ image: { ...page.image!, alt: event.target.value } })} /></label>
          <label>{copy.fit}<select aria-label={copy.fit} value={page.image.fit} disabled={readOnly} onChange={(event) => update({ image: { ...page.image!, fit: event.target.value as 'cover' | 'contain' } })}><option value="cover">{copy.cover}</option><option value="contain">{copy.contain}</option></select></label>
          {!readOnly ? <button type="button" onClick={() => update({ image: undefined })}>{copy.removeImage}</button> : null}
        </> : null}
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <PublicationMatterFrameEditor key={`${manuscript.id}:${selected}`} page={page} widthMm={paperWidth} heightMm={trimHeight} trimWidthMm={trimWidth}
        createFrame={isPublicationCoverSheet(selected) ? (kind) => createCoverSheetFrame(kind, area, selected, trimWidth, trimHeight, spineWidth) : undefined}
        guides={sheet ? <div className="omi-cover-sheet-guides" aria-hidden="true">
          {[trimWidth, trimWidth + spineWidth].filter((value, index, all) => index === 0 || value !== all[0]).map((value) => <span className="omi-cover-fold" key={value} style={{ left: `${value / paperWidth * 100}%` }} />)}
          {isPublicationCoverSheet(selected) ? publicationCoverPanels(selected, trimWidth, spineWidth).filter((panel) => panel.widthMm > 0).map((panel) => <span className="omi-cover-region-label" key={panel.kind} style={{ left: `${panel.xMm / paperWidth * 100}%`, width: `${panel.widthMm / paperWidth * 100}%` }}>{copy.pages[panel.kind]}</span>) : null}
        </div> : undefined}
        imageUrl={imageUrl} unit={unit} onChange={update} readOnly={readOnly} />
    </div>
  </section>;
}
