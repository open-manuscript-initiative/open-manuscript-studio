import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { getPublicationCoverSheet, isPublicationCoverSheet } from '../model/publicationCoverSheet';
import { useStudioStore } from '../app/useStudioStore';
import { importPublicationMatterImage, stagePublicationMatter } from '../app/publicationMatterActions';
import { useTranslation } from '../i18n';
import { getPublicationMatterCopy } from '../i18n/publicationMatter';
import { getPublicationFramesCopy } from '../i18n/publicationFrames';
import { getPublicationMatterFramesCopy } from '../i18n/publicationMatterFrames';
import { createPublicationMatter, getPublicationMatter, type PublicationMatterPage } from '../model/publicationMatter';
import { createPublicationMatterFrame, fitPublicationMatterImage, matterFrameBoxStyle, matterImageStyle, reorderPublicationMatterFrame, resizePublicationMatterImage, type PublicationMatterFrame } from '../model/publicationMatterFrames';
import type { PublicationMeasurementUnit } from '../model/publicationMeasurementUnits';
import { frameGraphicTransform } from '../model/publicationFramePages';
import { frameClipPath, frameShapeSvg } from '../services/publicationFrameShapes';
import { getAssetPayload } from '../services/assetRepository';
import { MatterNumber } from './PublicationMatterControls';
import { MatterRichText, matterPreviewHtml } from './PublicationMatterRichText';

interface Drag { kind: 'move' | 'resize' | 'image-move' | 'image-resize' | 'point'; frame: PublicationMatterFrame; point: number; x: number; y: number; pixelsPerMm: number }
export function PublicationMatterFrameEditor({ page, widthMm, heightMm, imageUrl, onChange, readOnly, unit, createFrame, guides, trimWidthMm }: {
  page: PublicationMatterPage; widthMm: number; heightMm: number; imageUrl: string; onChange(patch: Partial<PublicationMatterPage>): void; readOnly: boolean; unit: PublicationMeasurementUnit;
  createFrame?(kind: 'text' | 'graphic'): PublicationMatterFrame; guides?: ReactNode; trimWidthMm?: number;
}) {
  const { locale } = useTranslation();
  const pageCopy = getPublicationMatterCopy(locale);
  const copy = getPublicationFramesCopy(locale), labels = getPublicationMatterFramesCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const [selectedId, setSelectedId] = useState('');
  const [editImage, setEditImage] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [toolbarHost, setToolbarHost] = useState<HTMLDivElement | null>(null);
  const paper = useRef<HTMLDivElement>(null), drag = useRef<Drag | null>(null);
  const [scale, setScale] = useState(.6);
  const [overflow, setOverflow] = useState(false);
  const frames = page.frames ?? [];
  const sheet = isPublicationCoverSheet(page.kind);
  const limitFrames = sheet ? 512 : 128;
  const selected = frames.find((frame) => frame.id === selectedId);
  const selectedIndex = frames.findIndex((frame) => frame.id === selectedId);
  const graphic = selected?.kind === 'graphic' ? frameGraphicTransform(selected) : undefined;
  useEffect(() => {
    if (!paper.current) return;
    const measure = () => { if (paper.current) setScale(paper.current.clientWidth / (widthMm * 96 / 25.4)); };
    const observer = new ResizeObserver(measure); observer.observe(paper.current); measure();
    return () => observer.disconnect();
  }, [widthMm]);
  useEffect(() => {
    const node = paper.current;
    if (!node) return;
    const check = () => setOverflow(Array.from(node.querySelectorAll<HTMLElement>('.omi-matter-frame-text')).some((item) => item.scrollHeight > item.clientHeight + 1 || item.scrollWidth > item.clientWidth + 1));
    const observer = new ResizeObserver(check); observer.observe(node);
    const mutation = new MutationObserver(check); mutation.observe(node, { childList: true, subtree: true, characterData: true, attributes: true });
    document.fonts?.addEventListener('loadingdone', check); check();
    return () => { observer.disconnect(); mutation.disconnect(); document.fonts?.removeEventListener('loadingdone', check); };
  }, [page, scale]);
  function choose(id: string) { setSelectedId(id); setEditImage(false); }
  function patchFrame(id: string, patch: Partial<PublicationMatterFrame>) {
    if (!readOnly) onChange({ frames: frames.map((frame) => frame.id === id ? { ...frame, ...patch } : frame) });
  }
  function reorder(destination: number) {
    if (!readOnly && selected) onChange({ frames: reorderPublicationMatterFrame(frames, selected.id, destination) });
  }
  function add(kind: 'text' | 'graphic') {
    if (readOnly || frames.length >= limitFrames) return;
    const frame = createFrame?.(kind) ?? createPublicationMatterFrame(kind, widthMm, heightMm);
    onChange({ frames: [...frames, frame] }); choose(frame.id);
  }
  async function upload(file: File) {
    if (readOnly || !selected || selected.kind !== 'graphic') return;
    const manuscriptId = manuscript.id, pageKind = page.kind, frameId = selected.id;
    setBusy(true); setError('');
    try {
      const ratio = await imageAspect(file);
      const asset = await importPublicationMatterImage(file, manuscriptId);
      const latest = useStudioStore.getState().manuscript;
      if (latest.id !== manuscriptId) return;
      const model = getPublicationMatter(latest) ?? createPublicationMatter(latest);
      const currentPage = isPublicationCoverSheet(pageKind) ? getPublicationCoverSheet(model, pageKind, trimWidthMm!, heightMm) : model.pages.find((item) => item.kind === pageKind);
      const frame = currentPage?.frames?.find((item) => item.id === frameId);
      if (!currentPage || !frame) return;
      const updated: PublicationMatterFrame = { ...frame, image: { assetId: asset.id, alt: '' }, graphicTransform: frameGraphicTransform({ ...frame, graphicTransform: undefined }, ratio) };
      const nextPage = { ...currentPage, frames: currentPage.frames!.map((candidate) => candidate.id === frameId ? updated : candidate) };
      stagePublicationMatter({ ...model, pages: [...model.pages.filter((item) => item.kind !== pageKind), nextPage] }, asset, manuscriptId);
    } catch { setError(labels.error); }
    finally { setBusy(false); }
  }
  function start(event: PointerEvent<HTMLElement>, frame: PublicationMatterFrame, kind: Drag['kind'], point = 0) {
    if (readOnly || busy || event.button !== 0 || !paper.current) return;
    event.preventDefault(); event.stopPropagation(); setSelectedId(frame.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { kind, frame: structuredClone(frame), point, x: event.clientX, y: event.clientY, pixelsPerMm: paper.current.getBoundingClientRect().width / widthMm };
  }
  function move(event: PointerEvent<HTMLElement>) {
    const value = drag.current;
    if (!value || readOnly || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const dx = (event.clientX - value.x) / value.pixelsPerMm, dy = (event.clientY - value.y) / value.pixelsPerMm;
    const frame = value.frame;
    const radians = frame.rotation * Math.PI / 180;
    const x = dx * Math.cos(radians) + dy * Math.sin(radians), y = -dx * Math.sin(radians) + dy * Math.cos(radians);
    const limit = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
    if (value.kind === 'move') patchFrame(frame.id, { xMm: limit(frame.xMm + dx, -2000, sheet ? 4000 : 2000), yMm: limit(frame.yMm + dy, -2000, 2000) });
    else if (value.kind === 'resize') patchFrame(frame.id, { widthMm: limit(frame.widthMm + x, 1, sheet ? 4000 : 2000), heightMm: limit(frame.heightMm + y, 1, 2000) });
    else if (value.kind === 'point') patchFrame(frame.id, { points: frame.points.map((point, index) => index === value.point ? { x: limit(point.x + x / frame.widthMm * 100, 0, 100), y: limit(point.y + y / frame.heightMm * 100, 0, 100) } : point) });
    else {
      const image = frameGraphicTransform(frame);
      const angle = image.rotation * Math.PI / 180;
      const imageX = x * Math.cos(angle) + y * Math.sin(angle), imageY = -x * Math.sin(angle) + y * Math.cos(angle);
      const resized = resizePublicationMatterImage(image, 'widthMm', limit(image.widthMm + imageX, .000001, 20000));
      if (!image.keepAspectRatio) resized.heightMm = limit(image.heightMm + imageY, .000001, 20000);
      patchFrame(frame.id, { graphicTransform: value.kind === 'image-move'
        ? { ...image, offsetXMm: limit(image.offsetXMm + x, -20000, 20000), offsetYMm: limit(image.offsetYMm + y, -20000, 20000) }
        : resized });
    }
  }
  const pointer = { onPointerMove: move, onPointerUp: () => { drag.current = null; }, onPointerCancel: () => { drag.current = null; }, onLostPointerCapture: () => { drag.current = null; } };
  const previewStyle: CSSProperties = { ...(widthMm < 60 ? { width: `min(100%, ${widthMm / heightMm * 800}px)` } : {}), background: page.appearance.background, color: page.appearance.color, aspectRatio: `${widthMm}/${heightMm}`,
    ...(frames.length || sheet ? { height: heightMm * 96 / 25.4 * scale, overflow: 'hidden' } : {}),
    padding: page.appearance.paddingMm * 96 / 25.4 * scale, fontFamily: page.appearance.fontFamily,
    fontSize: `${page.appearance.fontSizePt * scale}pt`, textAlign: page.appearance.alignment,
    justifyContent: { top: 'flex-start', center: 'center', bottom: 'flex-end' }[page.appearance.vertical] };
  return <section className="omi-matter-frames" aria-label={labels.title}
    onPasteCapture={(event) => { const file = Array.from(event.clipboardData.files).find((item) => item.type.startsWith('image/')); if (!readOnly && selected?.kind === 'graphic' && file) { event.preventDefault(); void upload(file); } }}
    onDragOver={(event) => { if (!readOnly && selected?.kind === 'graphic') event.preventDefault(); }}
    onDrop={(event) => { const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith('image/')); if (!readOnly && selected?.kind === 'graphic' && file) { event.preventDefault(); void upload(file); } }}>
    <h3>{labels.title}</h3><p>{labels.help}</p>
    <div className="omi-matter-frame-actions">
      <button type="button" disabled={readOnly || frames.length >= limitFrames} onClick={() => add('text')}>{copy.addText}</button>
      <button type="button" disabled={readOnly || frames.length >= limitFrames} onClick={() => add('graphic')}>{copy.addGraphic}</button>
      <label>{copy.selectFrame}<select aria-label={copy.selectFrame} value={selected?.id ?? ''} onChange={(event) => choose(event.target.value)}><option value="">{labels.base}</option>{frames.map((frame, index) => <option key={frame.id} value={frame.id}>{frame.name || `${copy.frame} ${index + 1}`}</option>)}</select></label>
    </div>
    {selected ? <fieldset className="omi-matter-frame-settings" disabled={readOnly}>
      <legend>{copy.frame}</legend>
      <label>{copy.name}<input value={selected.name} maxLength={256} onChange={(event) => patchFrame(selected.id, { name: event.target.value })} /></label>
      {(['xMm', 'yMm', 'widthMm', 'heightMm', 'rotation'] as const).map((key, index) => <MatterNumber unit={key === 'rotation' ? undefined : unit} key={key} label={[copy.x, copy.y, copy.width, copy.height, copy.rotation][index]!} value={selected[key]} min={key === 'rotation' ? -360 : key.endsWith('Mm') && !key.startsWith('width') && !key.startsWith('height') ? -2000 : 1} max={key === 'rotation' ? 360 : sheet && (key === 'xMm' || key === 'widthMm') ? 4000 : 2000} disabled={readOnly} onCommit={(value) => patchFrame(selected.id, { [key]: value })} />)}
      <label>{copy.shape}<select aria-label={copy.shape} value={selected.shape} onChange={(event) => patchFrame(selected.id, { shape: event.target.value as PublicationMatterFrame['shape'] })}><option value="rectangle">{copy.rectangle}</option><option value="ellipse">{copy.ellipse}</option><option value="polygon">{copy.polygon}</option></select></label>
      {selected.shape === 'polygon' ? <div><button type="button" disabled={selected.points.length >= 32} onClick={() => patchFrame(selected.id, { points: [...selected.points, { x: 50, y: 50 }] })}>{copy.addPoint}</button><button type="button" disabled={selected.points.length <= 3} onClick={() => patchFrame(selected.id, { points: selected.points.slice(0, -1) })}>{copy.removePoint}</button></div> : null}
      <label>{labels.transparent}<input type="checkbox" checked={selected.style.fill === 'none'} onChange={(event) => patchFrame(selected.id, { style: { ...selected.style, fill: event.target.checked ? 'none' : '#ffffff' } })} /></label>
      {(['fill', 'stroke', 'color'] as const).map((key) => <label key={key}>{copy[key]}<input type="color" value={selected.style[key] === 'none' ? '#ffffff' : selected.style[key]} onChange={(event) => patchFrame(selected.id, { style: { ...selected.style, [key]: event.target.value } })} /></label>)}
      <MatterNumber unit={unit} label={copy.strokeWidth} value={selected.style.strokeWidthMm} min={0} max={20} disabled={readOnly} onCommit={(value) => patchFrame(selected.id, { style: { ...selected.style, strokeWidthMm: value } })} />
      {selected.kind === 'text' ? <>
        <label>{pageCopy.vertical}<select aria-label={pageCopy.vertical} value={selected.vertical ?? 'top'} onChange={(event) => patchFrame(selected.id, { vertical: event.target.value as 'top' | 'center' | 'bottom' })}><option value="top">{pageCopy.top}</option><option value="center">{pageCopy.middle}</option><option value="bottom">{pageCopy.bottom}</option></select></label>
        <label>{copy.font}<input value={selected.style.fontFamily} maxLength={128} onChange={(event) => { if (event.target.value.trim()) patchFrame(selected.id, { style: { ...selected.style, fontFamily: event.target.value } }); }} /></label>
        {(['fontSizePt', 'lineHeightPt', 'paddingMm'] as const).map((key, index) => <MatterNumber unit={key === 'paddingMm' ? unit : undefined} key={key} label={[copy.size, copy.leading, copy.padding][index]!} value={selected.style[key]} min={key === 'paddingMm' ? 0 : 6} max={key === 'fontSizePt' ? 120 : key === 'paddingMm' ? 60 : 240} disabled={readOnly} onCommit={(value) => patchFrame(selected.id, { style: { ...selected.style, [key]: value } })} />)}
        <label>{copy.alignment}<select aria-label={copy.alignment} value={selected.style.alignment} onChange={(event) => patchFrame(selected.id, { style: { ...selected.style, alignment: event.target.value as 'left' | 'center' | 'right' } })}>{(['left', 'center', 'right'] as const).map((value) => <option key={value} value={value}>{copy[value]}</option>)}</select></label>
      </> : <>
        <label>{labels.image}<input type="file" disabled={busy} accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }} /></label>
        <p>{labels.paste}</p>
        {selected.image ? <>
          <label>{pageCopy.alt}<input maxLength={10000} value={selected.image.alt} onChange={(event) => patchFrame(selected.id, { image: { ...selected.image!, alt: event.target.value } })} /></label>
          <button type="button" onClick={() => { patchFrame(selected.id, { image: undefined, graphicTransform: undefined }); setEditImage(false); }}>{pageCopy.removeImage}</button>
          <button type="button" aria-pressed={editImage} onClick={() => setEditImage(!editImage)}>{editImage ? labels.editFrame : labels.editImage}</button>
          <label>{copy.keepAspectRatio}<input type="checkbox" checked={graphic!.keepAspectRatio} onChange={(event) => patchFrame(selected.id, { graphicTransform: { ...graphic!, keepAspectRatio: event.target.checked } })} /></label>
          {(['offsetXMm', 'offsetYMm', 'widthMm', 'heightMm', 'rotation'] as const).map((key, index) => <MatterNumber unit={key === 'rotation' ? undefined : unit} key={key} label={[copy.graphicX, copy.graphicY, copy.graphicWidth, copy.graphicHeight, copy.graphicRotation][index]!} value={graphic![key]} min={key === 'rotation' ? -360 : key.startsWith('offset') ? -20000 : .000001} max={key === 'rotation' ? 360 : 20000} disabled={readOnly} onCommit={(value) => patchFrame(selected.id, { graphicTransform: key === 'widthMm' || key === 'heightMm' ? resizePublicationMatterImage(graphic!, key, value) : { ...graphic!, [key]: value } })} />)}
          <button type="button" onClick={() => patchFrame(selected.id, { graphicTransform: fitPublicationMatterImage(selected, 'contain') })}>{copy.resetGraphic}</button>
          <button type="button" onClick={() => patchFrame(selected.id, { graphicTransform: fitPublicationMatterImage(selected, 'cover') })}>{copy.fillFrame}</button>
        </> : null}
      </>}
      <label>{labels.layer}<select aria-label={labels.layer} value={selectedIndex} onChange={(event) => reorder(Number(event.target.value))}>{Array.from({ length: frames.length }, (_, index) => <option key={index} value={index}>{index + 1}</option>)}</select></label>
      <div className="omi-matter-frame-layer-actions" role="group" aria-label={labels.order}>
        <button type="button" disabled={selectedIndex === frames.length - 1} onClick={() => reorder(frames.length - 1)}>{labels.front}</button>
        <button type="button" disabled={selectedIndex === frames.length - 1} onClick={() => reorder(selectedIndex + 1)}>{labels.forward}</button>
        <button type="button" disabled={selectedIndex === 0} onClick={() => reorder(selectedIndex - 1)}>{labels.backward}</button>
        <button type="button" disabled={selectedIndex === 0} onClick={() => reorder(0)}>{labels.back}</button>
      </div>
      <button type="button" onClick={() => { onChange({ frames: frames.filter((frame) => frame.id !== selected.id) }); choose(''); }}>{copy.deleteFrame}</button>
    </fieldset> : null}
    {error ? <p role="alert">{error}</p> : null}
    {overflow ? <p role="status">{labels.overflow}</p> : null}
    <div ref={setToolbarHost} />
    <div ref={paper} className={`omi-publication-matter-paper${sheet ? ' omi-cover-sheet-paper' : ''}`} data-cover-sheet={sheet ? page.kind : undefined} style={previewStyle}>
      {imageUrl ? <img src={imageUrl} alt={page.image?.alt ?? ''} style={{ objectFit: page.image?.fit }} /> : null}
      <div className="omi-matter-base-text">{!selected && !readOnly ? <MatterRichText key="base" content={page.content} onChange={(content) => onChange({ content })} readOnly={readOnly} toolbarHost={toolbarHost} /> : <MatterPreview content={page.content} />}</div>
      {frames.map((frame, index) => <Fragment key={frame.id}><div className={`omi-matter-frame${selected?.id === frame.id ? ' is-selected' : ''}`} data-matter-frame-id={frame.id} data-frame-kind={frame.kind}
        style={{ ...matterFrameBoxStyle(frame, widthMm, heightMm), zIndex: index + 2 }} tabIndex={readOnly ? undefined : 0} aria-label={frame.name || `${copy.frame} ${index + 1}`}
        onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); choose(frame.id); } }}
        onPointerDown={(event) => { event.stopPropagation(); if (selected?.id !== frame.id) choose(frame.id); }}>
        <div className="omi-matter-frame-outline" dangerouslySetInnerHTML={{ __html: frameShapeSvg(frame, { ...frame.style, strokeWidthMm: 0 }) }} />
        <div className={`omi-matter-frame-content${frame.kind === 'text' ? ' omi-matter-frame-text' : ''}`} style={{ clipPath: frameClipPath(frame), ...(frame.kind === 'text' ? { display: 'flex', flexDirection: 'column', justifyContent: { top: 'flex-start', center: 'center', bottom: 'flex-end' }[frame.vertical ?? 'top'], padding: `${frame.style.paddingMm * scale}mm`, fontFamily: frame.style.fontFamily, fontSize: `${frame.style.fontSizePt * scale}pt`, lineHeight: `${frame.style.lineHeightPt * scale}pt`, color: frame.style.color, fontWeight: frame.style.fontWeight, fontStyle: frame.style.fontStyle, textAlign: frame.style.alignment } : {}) }}>
          {frame.kind === 'text' ? selected?.id === frame.id && !readOnly ? <MatterRichText label={labels.frameText} content={frame.content!} onChange={(content) => patchFrame(frame.id, { content })} readOnly={readOnly} toolbarHost={toolbarHost} /> : <MatterPreview content={frame.content!} />
            : frame.image ? <div className="omi-matter-frame-image" style={matterImageStyle(frame)} {...pointer} onPointerDown={(event) => { if (selected?.id === frame.id && editImage) start(event, frame, 'image-move'); }}><MatterAssetImage manuscriptId={manuscript.id} assetId={frame.image.assetId} alt={frame.image.alt} fit={frame.image.fit} />{selected?.id === frame.id && editImage && !readOnly ? <button type="button" className="omi-matter-frame-resize" aria-label={copy.resizeGraphic} {...pointer} onPointerDown={(event) => start(event, frame, 'image-resize')}>↘</button> : null}</div> : <span>{labels.emptyImage}</span>}
        </div>
        {frame.style.strokeWidthMm > 0 ? <div className="omi-matter-frame-outline" dangerouslySetInnerHTML={{ __html: frameShapeSvg(frame, { ...frame.style, fill: 'none' }) }} /> : null}
        </div>
        {selected?.id === frame.id && !readOnly ? <div className="omi-matter-frame-selection" data-matter-frame-selection-id={frame.id} style={{ ...matterFrameBoxStyle(frame, widthMm, heightMm), zIndex: 10000 }}>
          <button type="button" className="omi-matter-frame-move" aria-label={labels.move} {...pointer} onPointerDown={(event) => start(event, frame, 'move')}>↔</button>
          <button type="button" className="omi-matter-frame-resize" aria-label={labels.resize} {...pointer} onPointerDown={(event) => start(event, frame, 'resize')}>↘</button>
          {frame.shape === 'polygon' ? frame.points.map((point, i) => <button type="button" key={i} className="omi-matter-frame-point" aria-label={`${copy.points} ${i + 1}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} {...pointer} onPointerDown={(event) => start(event, frame, 'point', i)} />) : null}
        </div> : null}
      </Fragment>)}
      {guides}
    </div>
  </section>;
}
function MatterPreview({ content }: { content: string }) { const html = useMemo(() => matterPreviewHtml(content), [content]); return <div className="omi-matter-rich-preview" dangerouslySetInnerHTML={{ __html: html }} />; }
function MatterAssetImage({ manuscriptId, assetId, alt, fit }: { manuscriptId: string; assetId: string; alt: string; fit?: 'contain' | 'cover' }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let disposed = false, objectUrl = ''; setUrl('');
    void getAssetPayload(manuscriptId, assetId).then((bytes) => { if (!bytes || disposed) return; objectUrl = URL.createObjectURL(new Blob([new Uint8Array(bytes)])); setUrl(objectUrl); }).catch(() => setUrl(''));
    return () => { disposed = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [manuscriptId, assetId]);
  return url ? <img src={url} alt={alt} draggable={false} style={{ objectFit: fit ?? 'fill' }} /> : null;
}
async function imageAspect(file: File): Promise<number> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 16 * 1024 * 1024) throw new Error('Invalid image.');
  const url = URL.createObjectURL(file);
  try { return await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => image.naturalWidth > 0 && image.naturalHeight > 0 ? resolve(image.naturalWidth / image.naturalHeight) : reject(new Error('Invalid image.')); image.onerror = () => reject(new Error('Invalid image.')); image.src = url; }); }
  finally { URL.revokeObjectURL(url); }
}
