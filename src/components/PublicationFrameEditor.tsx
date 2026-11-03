import { PublicationFramePagePanel } from './PublicationFramePagePanel';
import { createDefaultFlowFrameLayout, paginateAutomaticFrameLayout } from '../model/publicationAutoFlow';
import { framePages, framePageStyle, frameGraphicTransform, frameGraphicContentStyle, frameGraphicInnerStyle, frameRunningHeader, updateFrameGraphicSize, type FrameGraphicTransform } from '../model/publicationFramePages';
import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { useStudioStore } from '../app/useStudioStore';
import { stageFrameLayout } from '../app/publicationFrameActions';
import { getPublicationFramesCopy } from '../i18n/publicationFrames';
import { useTranslation } from '../i18n';
import {
  collectFrameSourceBlocks, flowFrameStories, frameDisplayText, frameStyle, getFrameLayout, linkFrames, removeFrame,
  unlinkFrames, RECTANGLE_POINTS, type FrameTextStyle, type PublicationFrame, type PublicationFrameLayout,
} from '../model/publicationFrames';
import { storedContentText } from '../model/proofing';
import {
  buildFrameExport, captureFrameGraphicSnapshots, createFrameTextMeasure, frameClipPath, frameShapeSvg, frameTypography,
} from '../services/publicationFrameRendering';
import type { PublicationStyle } from '../services/publicationStyleExport';
import { PublicationPreviewContext, usePublicationPreview } from './PublicationPreviewContext';
import { VisualBlockEditor } from './VisualBlockEditor';
import type { OmiBlock, OmiVisualBlockData } from '../types/omi';
import './PublicationFrameEditor.css';

type Copy = ReturnType<typeof getPublicationFramesCopy>;
interface Drag {
  kind: 'move' | 'resize' | 'point' | 'graphic-move' | 'graphic-resize'; point?: number; frame: PublicationFrame; graphic?: FrameGraphicTransform;
  layout: PublicationFrameLayout; x: number; y: number; pixelsPerMm: number;
}
export function PublicationFrameEditor({ publicationStyle }: { publicationStyle: PublicationStyle }) {
  const manuscript = useStudioStore((state) => state.manuscript);
  const { locale } = useTranslation(); const copy = getPublicationFramesCopy(locale);
  const preview = usePublicationPreview();
  const initial = useMemo(() => {
    const next = createDefaultFlowFrameLayout();
    next.styles[0]!.properties = { ...next.styles[0]!.properties, fontFamily: publicationStyle.fonts.body.family,
      fontSizePt: publicationStyle.styles.body.fontSize, lineHeightPt: publicationStyle.styles.body.lineHeight };
    return next;
  }, [publicationStyle]);
  const stored = getFrameLayout(manuscript) ?? initial;
  const [draft, setDraft] = useState<PublicationFrameLayout | null>(null);
  const [fontGeneration, setFontGeneration] = useState(0);
  const measure = useMemo(createFrameTextMeasure, []);
  const layout = useMemo(() => {
    void fontGeneration;
    return paginateAutomaticFrameLayout(draft ?? stored, measure);
  }, [draft, stored, measure, fontGeneration]);
  const [pageSelection, setPageSelection] = useState(0);
  const activePage = Math.min(Math.max(0, pageSelection), layout.page.count - 1);
  const [selectedId, setSelectedId] = useState('');
  const selected = layout.frames.find((frame) => frame.id === selectedId && frame.page === activePage) ?? layout.frames.find((frame) => frame.page === activePage);
  const [graphicAspects, setGraphicAspects] = useState<Record<string, number>>({});
  const [targetId, setTargetId] = useState(''); const [reuseStory, setReuseStory] = useState('');
  const [message, setMessage] = useState(''); const [exporting, setExporting] = useState(false);
  const flow = useMemo(() => flowFrameStories(layout, measure), [layout, measure]);
  const blocks = useMemo(() => collectFrameSourceBlocks(manuscript), [manuscript]);
  const graphics = blocks.filter((block) => block.visual);
  const sourceIds = new Set(graphics.map((block) => block.id));
  const missingSources = layout.frames.some((frame) => frame.kind === 'graphic' && !sourceIds.has(frame.sourceBlockId!));
  const story = layout.stories.find((item) => item.id === selected?.storyId);
  const effective = selected ? frameStyle(layout, selected) : undefined;
  const shared = layout.styles.find((style) => style.id === selected?.styleId);
  const stage = useRef<HTMLDivElement>(null); const [stageWidth, setStageWidth] = useState(500);
  const drag = useRef<Drag | null>(null); const dragDraft = useRef<PublicationFrameLayout | null>(null);
  const widestPage = Math.max(...framePages(layout).map((_, index) => framePageStyle(layout, index).widthMm));
  const scale = Math.min(1, Math.max(0.1, (stageWidth - 28) / (widestPage * 96 / 25.4)));
  function graphicAspect(frame: PublicationFrame): number | undefined {
    const visual = graphics.find((block) => block.id === frame.sourceBlockId)?.visual;
    if (frame.sourceBlockId && graphicAspects[frame.sourceBlockId]) return graphicAspects[frame.sourceBlockId];
    if (visual?.kind === 'chart') return 2;
    if (visual?.kind === 'image' && (visual.width ?? 0) > 0 && (visual.height ?? 0) > 0) return visual.width! / visual.height!;
    return undefined;
  }
  const graphicSettings = selected?.kind === 'graphic' ? frameGraphicTransform(selected, graphicAspect(selected)) : undefined;
  function updateGraphic(patch: Partial<FrameGraphicTransform>) { if (graphicSettings) updateFrame({ graphicTransform: { ...graphicSettings, ...patch } }); }
  useEffect(() => {
    const root = stage.current; if (!root) return;
    const observer = new ResizeObserver(() => setStageWidth(root.clientWidth)); observer.observe(root);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    stage.current?.querySelector<HTMLElement>(`[data-frame-page="${activePage}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activePage]);
  useEffect(() => {
    const changed = () => setFontGeneration((value) => value + 1);
    document.fonts.addEventListener('loadingdone', changed);
    return () => document.fonts.removeEventListener('loadingdone', changed);
  }, []);
  function commit(next: PublicationFrameLayout) {
    if (preview) return;
    try { stageFrameLayout(paginateAutomaticFrameLayout(next, measure)); setMessage(''); } catch (error) { setMessage(String(error instanceof Error ? error.message : error)); }
  }
  function updateFrame(patch: Partial<PublicationFrame>) {
    if (!selected) return;
    commit({ ...layout, frames: layout.frames.map((frame) => frame.id === selected.id ? { ...frame, ...patch } : frame) });
    if (patch.page !== undefined) setPageSelection(patch.page);
  }
  function addFrame(kind: 'text' | 'graphic') {
    const next = structuredClone(layout); const id = crypto.randomUUID();
    const storyId = reuseStory && !next.frames.some((frame) => frame.storyId === reuseStory) ? reuseStory : crypto.randomUUID();
    if (kind === 'text' && !next.stories.some((item) => item.id === storyId)) next.stories.push({ id: storyId, name: `${copy.story} ${next.stories.length + 1}`, text: '' });
    const pageStyle = framePageStyle(next, activePage);
    const frame: PublicationFrame = { id, name: `${copy.frame} ${next.frames.length + 1}`, kind, page: activePage,
      xMm: Math.min(pageStyle.margins.left + next.frames.length % 4 * 5, pageStyle.widthMm - 5), yMm: Math.min(pageStyle.margins.top + next.frames.length % 4 * 5, pageStyle.heightMm - 5),
      widthMm: Math.max(5, Math.min(65, pageStyle.widthMm - pageStyle.margins.left - pageStyle.margins.right)), heightMm: Math.max(5, Math.min(90, pageStyle.heightMm - pageStyle.margins.top - pageStyle.margins.bottom)),
      rotation: 0, shape: 'rectangle', points: structuredClone(RECTANGLE_POINTS), styleId: next.styles[0]!.id,
      ...(kind === 'text' ? { storyId } : { sourceBlockId: graphics[0]?.id ?? '' }) };
    next.frames.push(frame); commit(next); setSelectedId(id); setReuseStory('');
  }
  function changeStyle(patch: Partial<FrameTextStyle>, local: boolean) {
    if (!selected || !effective || !shared) return;
    if (patch.fontSizePt !== undefined && patch.fontSizePt > effective.lineHeightPt) patch.lineHeightPt = patch.fontSizePt;
    if (local) updateFrame({ overrides: { ...selected.overrides, ...patch } });
    else commit({ ...layout, styles: layout.styles.map((style) => style.id === shared.id ? { ...style, properties: { ...style.properties, ...patch } } : style) });
  }
  function startDrag(event: PointerEvent<HTMLElement>, frame: PublicationFrame, kind: Drag['kind'], point?: number) {
    if (preview) return;
    event.preventDefault(); event.stopPropagation(); setSelectedId(frame.id); setPageSelection(frame.page);
    const page = event.currentTarget.closest<HTMLElement>('.omi-frame-editor-page')!;
    drag.current = { frame: structuredClone(frame), kind, point, layout, x: event.clientX, y: event.clientY, pixelsPerMm: page.getBoundingClientRect().width / framePageStyle(layout, frame.page).widthMm, graphic: frame.kind === 'graphic' ? frameGraphicTransform(frame, graphicAspect(frame)) : undefined };
    dragDraft.current = layout; event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event: PointerEvent<HTMLElement>) {
    const current = drag.current; if (!current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const dx = (event.clientX - current.x) / current.pixelsPerMm, dy = (event.clientY - current.y) / current.pixelsPerMm;
    const radians = current.frame.rotation * Math.PI / 180;
    const localX = dx * Math.cos(radians) + dy * Math.sin(radians), localY = -dx * Math.sin(radians) + dy * Math.cos(radians);
    const next = structuredClone(current.layout); const frame = next.frames.find((item) => item.id === current.frame.id)!;
    if (current.kind === 'move') { frame.xMm = clamp(frame.xMm + dx, -1200, 2400); frame.yMm = clamp(frame.yMm + dy, -1200, 2400); }
    else if (current.kind === 'resize') { frame.widthMm = clamp(frame.widthMm + localX, 5, 2000); frame.heightMm = clamp(frame.heightMm + localY, 5, 2000); }
    else if (current.kind === 'graphic-move' || current.kind === 'graphic-resize') {
      const graphic = { ...current.graphic! };
      if (current.kind === 'graphic-move') { graphic.offsetXMm = clamp(graphic.offsetXMm + localX, -20000, 20000); graphic.offsetYMm = clamp(graphic.offsetYMm + localY, -20000, 20000); }
      else {
        const radians = graphic.rotation * Math.PI / 180;
        const x = localX * Math.cos(radians) + localY * Math.sin(radians), y = -localX * Math.sin(radians) + localY * Math.cos(radians);
        if (graphic.keepAspectRatio) {
          const delta = Math.abs(x / graphic.widthMm) >= Math.abs(y / graphic.heightMm) ? x / graphic.widthMm : y / graphic.heightMm;
          const factor = Math.max(Math.max(0.1 / graphic.widthMm, 0.1 / graphic.heightMm), Math.min(1 + delta, 20000 / graphic.widthMm, 20000 / graphic.heightMm));
          graphic.widthMm *= factor; graphic.heightMm *= factor;
        } else { graphic.widthMm = clamp(graphic.widthMm + x, 0.1, 20000); graphic.heightMm = clamp(graphic.heightMm + y, 0.1, 20000); }
      }
      frame.graphicTransform = graphic;
    }
    else {
      const point = frame.points[current.point!]!;
      point.x = clamp(point.x + localX / frame.widthMm * 100, 0, 100); point.y = clamp(point.y + localY / frame.heightMm * 100, 0, 100);
    }
    dragDraft.current = next; setDraft(next);
  }
  function finishDrag() {
    if (!drag.current) return;
    const next = dragDraft.current; drag.current = null; dragDraft.current = null;
    if (next) commit(next); setDraft(null);
  }
  const dragEvents = { onPointerMove: moveDrag, onPointerUp: finishDrag, onLostPointerCapture: finishDrag,
    onPointerCancel: () => { drag.current = null; dragDraft.current = null; setDraft(null); } };
  async function exportLayout(print: boolean) {
    if (exporting) return;
    const target = print ? window.open('', '_blank') : null;
    if (print && !target) { setMessage('The browser blocked the print window.'); return; }
    if (target) target.opener = null;
    setExporting(true);
    try {
      const snapshot = structuredClone(layout);
      const html = await buildFrameExport(manuscript, snapshot, stage.current ? captureFrameGraphicSnapshots(stage.current, snapshot) : new Map());
      useStudioStore.getState().checkpoint('export');
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      if (target) {
        target.addEventListener('load', () => { target.focus(); target.print(); URL.revokeObjectURL(url); }, { once: true });
        target.location.replace(url);
      } else {
        const link = document.createElement('a'); link.href = url; link.download = 'publication-frames.html'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setMessage('');
    } catch (error) { target?.close(); setMessage(`${copy.exportFailed} ${error instanceof Error ? error.message : ''}`); }
    finally { setExporting(false); }
  }
  return <section className={`omi-frame-editor${preview ? ' omi-frame-editor--preview' : ''}`} aria-label={copy.mode}>
    <p>{copy.description}</p>
    {!preview ? <div className="omi-frame-tools">
      <button type="button" onClick={() => addFrame('text')}>{copy.addText}</button>
      <button type="button" disabled={!graphics.length} title={!graphics.length ? copy.missingGraphic : undefined} onClick={() => addFrame('graphic')}>{copy.addGraphic}</button>
      {layout.stories.some((item) => !layout.frames.some((frame) => frame.storyId === item.id)) ? <label>{copy.unusedStory}<select value={reuseStory} onChange={(event) => setReuseStory(event.target.value)}><option value="">{copy.freshStory}</option>{layout.stories.filter((item) => !layout.frames.some((frame) => frame.storyId === item.id)).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label> : null}
      <button type="button" disabled={exporting || !!flow.overflow.length || missingSources} onClick={() => void exportLayout(true)}>{copy.print}</button>
      <button type="button" disabled={exporting || !!flow.overflow.length || missingSources} onClick={() => void exportLayout(false)}>{copy.exportHtml}</button>
    </div> : null}
    {flow.overflow.length ? <p className="omi-frame-overflow" role="status">{copy.overflow} {flow.overflow.map((item) => `${layout.stories.find((story) => story.id === item.storyId)?.name}: ${item.text.length}`).join(' · ')}</p> : null}
    {missingSources ? <p role="alert">{copy.missingGraphic}</p> : null}
    {message ? <p role="alert">{message}</p> : null}
    <div className="omi-frame-workspace">
      <div ref={stage} className="omi-frame-stage">
        {!layout.frames.length ? <p>{copy.empty}</p> : null}
        {framePages(layout).map((page, pageIndex) => {
          const pageStyle = framePageStyle(layout, pageIndex), header = frameRunningHeader(layout, pageIndex, manuscript.title), headerStyle = pageStyle.runningHeader;
          return <div key={page.id} className="omi-frame-editor-page" data-frame-page={pageIndex} data-page-style={pageStyle.id} aria-label={`${copy.page} ${pageIndex + 1}`} style={{ width: `${pageStyle.widthMm}mm`, height: `${pageStyle.heightMm}mm`, background: pageStyle.background, zoom: scale }}>
          {header ? <header className="omi-frame-running-header" style={{ top: `${headerStyle.topMm}mm`, height: `${headerStyle.heightMm}mm`, left: `${pageStyle.margins.left}mm`, right: `${pageStyle.margins.right}mm`, fontFamily: headerStyle.fontFamily, fontSize: `${headerStyle.fontSizePt}pt`, color: headerStyle.color }}><span>{header.left}</span><span>{header.center}</span><span>{header.right}</span></header> : null}
          {!preview ? <div className="omi-frame-margin-guide" style={{ top: `${pageStyle.margins.top}mm`, right: `${pageStyle.margins.right}mm`, bottom: `${pageStyle.margins.bottom}mm`, left: `${pageStyle.margins.left}mm` }} /> : null}
          {layout.frames.filter((frame) => frame.page === pageIndex).map((frame) => {
            const properties = frameStyle(layout, frame), placed = flow.frames.find((item) => item.frameId === frame.id);
            const graphic = graphics.find((block) => block.id === frame.sourceBlockId);
            return <div key={frame.id} className={`omi-frame-object${selected?.id === frame.id && !preview ? ' omi-frame-object--selected' : ''}`} data-frame-id={frame.id}
              style={{ position: 'absolute', left: `${frame.xMm}mm`, top: `${frame.yMm}mm`, width: `${frame.widthMm}mm`, height: `${frame.heightMm}mm`, transform: `rotate(${frame.rotation}deg)`, ...frameTypography(properties) }}
              onPointerDown={() => { if (!preview) { setSelectedId(frame.id); setPageSelection(frame.page); } }}>
              <div className="omi-frame-shape" dangerouslySetInnerHTML={{ __html: frameShapeSvg(frame, properties) }} />
              {frame.kind === 'text' ? placed?.lines.map((line, index) => <div key={index} className="omi-frame-line" data-frame-line="true" data-text-start={line.start} data-text-end={line.end} style={{ left: `${line.x}mm`, top: `${line.y}mm`, width: `${line.width}mm`, height: `${properties.lineHeightPt}pt` }}>{frameDisplayText(line.text) || '\u00a0'}</div>)
                : <div className="omi-frame-graphic-content" style={{ clipPath: frameClipPath(frame) }} onLoadCapture={(event) => {
                  const image = event.target;
                  if (image instanceof HTMLImageElement && image.naturalWidth > 0 && image.naturalHeight > 0 && frame.sourceBlockId) {
                    const ratio = image.naturalWidth / image.naturalHeight;
                    setGraphicAspects((current) => current[frame.sourceBlockId!] === ratio ? current : { ...current, [frame.sourceBlockId!]: ratio });
                  }
                }}><div className="omi-frame-graphic-position" style={frameGraphicContentStyle(frame)}><div className="omi-frame-graphic-inner" style={frameGraphicInnerStyle(frame)}><PublicationPreviewContext.Provider value={true}>{graphic?.visual ? <VisualBlockEditor block={graphic as OmiBlock & { visual: OmiVisualBlockData }} sectionId="" blockIndex={0} /> : null}</PublicationPreviewContext.Provider></div></div></div>}
              {!preview && selected?.id === frame.id ? <>
                <button type="button" className="omi-frame-move" aria-label={`${copy.name}: ${frame.name}`} onPointerDown={(event) => startDrag(event, frame, 'move')} {...dragEvents}
                  onKeyDown={(event) => { const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }; const delta = moves[event.key]; if (delta) { event.preventDefault(); updateFrame({ xMm: frame.xMm + delta[0], yMm: frame.yMm + delta[1] }); } }}>{frame.name}</button>
                <button type="button" className="omi-frame-resize" aria-label={`${copy.width} / ${copy.height}`} onPointerDown={(event) => startDrag(event, frame, 'resize')} {...dragEvents} />
                {frame.kind === 'graphic' ? <><button type="button" className="omi-frame-graphic-pan" aria-label={copy.moveGraphic} onPointerDown={(event) => startDrag(event, frame, 'graphic-move')} {...dragEvents}>{copy.moveGraphic}</button><button type="button" className="omi-frame-graphic-resize" aria-label={copy.resizeGraphic} onPointerDown={(event) => startDrag(event, frame, 'graphic-resize')} {...dragEvents} /></> : null}
                {frame.shape === 'polygon' ? frame.points.map((point, index) => <button key={index} type="button" className="omi-frame-point" aria-label={`${copy.points} ${index + 1}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} onPointerDown={(event) => startDrag(event, frame, 'point', index)} {...dragEvents} />) : null}
              </> : null}
            </div>;
          })}
        </div>;
        })}
      </div>
      {!preview ? <aside className="omi-frame-inspector" aria-label={copy.mode}>
        <PublicationFramePagePanel layout={layout} pageIndex={activePage} onChange={commit} onSelect={(index) => { setPageSelection(index); setSelectedId(''); }} />
        <label>{copy.selectFrame}<select value={selected?.id ?? ''} onChange={(event) => { setSelectedId(event.target.value); const frame = layout.frames.find((item) => item.id === event.target.value); if (frame) setPageSelection(frame.page); }}><option value="" disabled>{copy.selectFrame}</option>{layout.frames.map((frame) => <option key={frame.id} value={frame.id}>{frame.name}</option>)}</select></label>
        {selected && shared && effective ? <>
          <label>{copy.name}<input value={selected.name} onChange={(event) => updateFrame({ name: event.target.value })} /></label>
          <NumberInput label={copy.page} value={selected.page + 1} min={1} max={layout.page.count} onChange={(value) => updateFrame({ page: Math.round(value) - 1 })} />
          <div className="omi-frame-fields">{(['xMm', 'yMm', 'widthMm', 'heightMm', 'rotation'] as const).map((key) => <NumberInput key={key} label={copy[({ xMm: 'x', yMm: 'y', widthMm: 'width', heightMm: 'height', rotation: 'rotation' } as const)[key]]} value={selected[key]} min={key === 'rotation' ? -36000 : key === 'xMm' || key === 'yMm' ? -1200 : 5} max={key === 'rotation' ? 36000 : 2000} onChange={(value) => updateFrame({ [key]: value })} />)}</div>
          <label>{copy.shape}<select value={selected.shape} onChange={(event) => updateFrame({ shape: event.target.value as PublicationFrame['shape'] })}>{(['rectangle', 'ellipse', 'polygon'] as const).map((shape) => <option key={shape} value={shape}>{copy[shape]}</option>)}</select></label>
          {selected.shape === 'polygon' ? <details open><summary>{copy.points}</summary>{selected.points.map((point, index) => <div className="omi-frame-point-fields" key={index}><NumberInput label={`X ${index + 1} (%)`} value={point.x} min={0} max={100} onChange={(x) => updateFrame({ points: selected.points.map((p, i) => i === index ? { ...p, x } : p) })} /><NumberInput label={`Y ${index + 1} (%)`} value={point.y} min={0} max={100} onChange={(y) => updateFrame({ points: selected.points.map((p, i) => i === index ? { ...p, y } : p) })} /><button type="button" disabled={selected.points.length <= 3} onClick={() => updateFrame({ points: selected.points.filter((_, i) => i !== index) })}>{copy.removePoint}</button></div>)}<button type="button" disabled={selected.points.length >= 128} onClick={() => { const a = selected.points.at(-1)!, b = selected.points[0]!; updateFrame({ points: [...selected.points, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }] }); }}>{copy.addPoint}</button></details> : null}
          <label>{copy.style}<select value={selected.styleId} onChange={(event) => updateFrame({ styleId: event.target.value })}>{layout.styles.map((style) => <option value={style.id} key={style.id}>{style.name}</option>)}</select></label>
          <button type="button" onClick={() => { const id = crypto.randomUUID(); const next = { ...layout, styles: [...layout.styles, { id, name: `${copy.style} ${layout.styles.length + 1}`, properties: { ...effective } }], frames: layout.frames.map((frame) => frame.id === selected.id ? { ...frame, styleId: id, overrides: undefined } : frame) }; commit(next); }}>{copy.newStyle}</button>
          <details><summary>{copy.editShared}</summary><label>{copy.styleName}<input value={shared.name} onChange={(event) => commit({ ...layout, styles: layout.styles.map((style) => style.id === shared.id ? { ...style, name: event.target.value } : style) })} /></label><StyleFields copy={copy} value={shared.properties} onChange={(patch) => changeStyle(patch, false)} /></details>
          <label className="omi-frame-checkbox"><input type="checkbox" checked={!!selected.overrides} onChange={(event) => updateFrame({ overrides: event.target.checked ? {} : undefined })} />{copy.local}</label>
          {selected.overrides ? <StyleFields copy={copy} value={effective} onChange={(patch) => changeStyle(patch, true)} /> : null}
          {selected.kind === 'text' && story ? <>
            <label>{copy.text}<textarea rows={7} value={story.text} onChange={(event) => commit({ ...layout, stories: layout.stories.map((item) => item.id === story.id ? { ...item, text: event.target.value } : item) })} /></label>
            <button type="button" onClick={() => commit({ ...layout, stories: layout.stories.map((item) => item.id === story.id ? { ...item, text: item.text + blocks.filter((block) => !block.visual).map((block) => storedContentText(block.content)).filter(Boolean).join('\n\n') } : item) })}>{copy.importText}</button><small>{copy.importHelp}</small>
            {selected.nextFrameId ? <><p>{copy.linked}: {layout.frames.find((frame) => frame.id === selected.nextFrameId)?.name}</p><button type="button" onClick={() => { try { commit(unlinkFrames(layout, selected.id, flow.frames.find((item) => item.frameId === selected.id)?.end ?? 0, crypto.randomUUID())); } catch (error) { setMessage(String(error)); } }}>{copy.unlink}</button></> : <>
              <label>{copy.next}<select value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">—</option>{layout.frames.filter((frame) => frame.kind === 'text' && frame.storyId !== story.id && !layout.frames.some((other) => other.nextFrameId === frame.id)).map((frame) => <option key={frame.id} value={frame.id}>{frame.name}</option>)}</select></label><button type="button" disabled={!targetId} onClick={() => { try { commit(linkFrames(layout, selected.id, targetId)); setTargetId(''); } catch (error) { setMessage(String(error)); } }}>{copy.link}</button>
            </>}
          </> : <><label>{copy.source}<select value={selected.sourceBlockId} onChange={(event) => updateFrame({ sourceBlockId: event.target.value, graphicTransform: undefined })}>{graphics.map((block) => <option value={block.id} key={block.id}>{block.visual?.kind}: {block.visual && 'caption' in block.visual ? block.visual.caption || block.id : block.id}</option>)}</select></label>
            {graphicSettings ? <details open><summary>{copy.graphicSettings}</summary>
              <label className="omi-frame-checkbox"><input type="checkbox" checked={graphicSettings.keepAspectRatio} onChange={(event) => updateGraphic({ keepAspectRatio: event.target.checked })} />{copy.keepAspectRatio}</label>
              <NumberInput label={copy.graphicX} value={graphicSettings.offsetXMm} min={-20000} max={20000} onChange={(offsetXMm) => updateGraphic({ offsetXMm })} />
              <NumberInput label={copy.graphicY} value={graphicSettings.offsetYMm} min={-20000} max={20000} onChange={(offsetYMm) => updateGraphic({ offsetYMm })} />
              <NumberInput label={copy.graphicWidth} value={graphicSettings.widthMm} min={0.1} max={20000} onChange={(value) => updateFrame({ graphicTransform: updateFrameGraphicSize(graphicSettings, 'widthMm', value) })} />
              <NumberInput label={copy.graphicHeight} value={graphicSettings.heightMm} min={0.1} max={20000} onChange={(value) => updateFrame({ graphicTransform: updateFrameGraphicSize(graphicSettings, 'heightMm', value) })} />
              <NumberInput label={copy.graphicRotation} value={graphicSettings.rotation} min={-36000} max={36000} onChange={(rotation) => updateGraphic({ rotation })} />
              <button type="button" onClick={() => updateFrame({ graphicTransform: undefined })}>{copy.resetGraphic}</button>
              <button type="button" onClick={() => { const value = frameGraphicTransform({ ...selected, graphicTransform: undefined }, graphicAspect(selected)); const factor = Math.max(selected.widthMm / value.intrinsicWidthMm, selected.heightMm / value.intrinsicHeightMm); value.widthMm = value.intrinsicWidthMm * factor; value.heightMm = value.intrinsicHeightMm * factor; value.offsetXMm = (selected.widthMm - value.widthMm) / 2; value.offsetYMm = (selected.heightMm - value.heightMm) / 2; updateFrame({ graphicTransform: value }); }}>{copy.fillFrame}</button>
            </details> : null}
          </>}
          <button type="button" onClick={() => { commit(removeFrame(layout, selected.id)); setSelectedId(''); }}>{copy.deleteFrame}</button>
        </> : null}
        <small>{copy.saved}</small>
      </aside> : null}
    </div>
  </section>;
}
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
function NumberInput({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label>{label}<input type="number" step="0.1" min={min} max={max} value={Math.round(value * 100) / 100} onChange={(event) => { const next = event.target.valueAsNumber; if (Number.isFinite(next)) onChange(clamp(next, min, max)); }} /></label>;
}
function StyleFields({ copy, value, onChange }: { copy: Copy; value: FrameTextStyle; onChange: (patch: Partial<FrameTextStyle>) => void }) {
  return <div className="omi-frame-style-fields">
    <label>{copy.font}<input value={value.fontFamily} onChange={(event) => onChange({ fontFamily: event.target.value || 'serif' })} /></label>
    <NumberInput label={copy.size} min={1} max={300} value={value.fontSizePt} onChange={(fontSizePt) => onChange({ fontSizePt })} />
    <NumberInput label={copy.leading} min={value.fontSizePt} max={600} value={value.lineHeightPt} onChange={(lineHeightPt) => onChange({ lineHeightPt })} />
    <NumberInput label={copy.padding} min={0} max={100} value={value.paddingMm} onChange={(paddingMm) => onChange({ paddingMm })} />
    <label>{copy.alignment}<select value={value.alignment} onChange={(event) => onChange({ alignment: event.target.value as FrameTextStyle['alignment'] })}>{(['left', 'center', 'right'] as const).map((alignment) => <option key={alignment} value={alignment}>{copy[alignment]}</option>)}</select></label>
    <label className="omi-frame-checkbox"><input type="checkbox" checked={value.fontWeight === 700} onChange={(event) => onChange({ fontWeight: event.target.checked ? 700 : 400 })} />{copy.weight}</label>
    <label className="omi-frame-checkbox"><input type="checkbox" checked={value.fontStyle === 'italic'} onChange={(event) => onChange({ fontStyle: event.target.checked ? 'italic' : 'normal' })} />{copy.italic}</label>
    {(['color', 'fill', 'stroke'] as const).map((key) => <label key={key}>{copy[key]}<input type="color" value={value[key]} onChange={(event) => onChange({ [key]: event.target.value })} /></label>)}
    <NumberInput label={copy.strokeWidth} min={0} max={10} value={value.strokeWidthMm} onChange={(strokeWidthMm) => onChange({ strokeWidthMm })} />
  </div>;
}
