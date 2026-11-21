import { DEFAULT_FRAME_STYLE, RECTANGLE_POINTS, type FramePoint, type FrameTextStyle, type PublicationFrame } from './publicationFrames';
import { frameGraphicTransform, type FrameGraphicTransform } from './publicationFramePages';

export interface PublicationMatterFrame extends Pick<PublicationFrame, 'id' | 'name' | 'kind' | 'xMm' | 'yMm' | 'widthMm' | 'heightMm' | 'rotation' | 'shape' | 'points'> {
  style: FrameTextStyle;
  content?: string;
  vertical?: 'top' | 'center' | 'bottom';
  coverAnchor?: 'left' | 'spine' | 'right';
  image?: { assetId: string; alt: string; fit?: 'contain' | 'cover' };
  graphicTransform?: FrameGraphicTransform;
}

/** Array order is the persisted stacking order, from bottom to top. */
export function reorderPublicationMatterFrame(frames: readonly PublicationMatterFrame[], id: string, destination: number): PublicationMatterFrame[] {
  const source = frames.findIndex((frame) => frame.id === id);
  if (source < 0 || !Number.isInteger(destination) || destination < 0 || destination >= frames.length) throw new Error('Invalid frame layer.');
  const next = [...frames];
  const [frame] = next.splice(source, 1);
  next.splice(destination, 0, frame!);
  return next;
}

export function createPublicationMatterFrame(kind: 'text' | 'graphic', widthMm: number, heightMm: number): PublicationMatterFrame {
  const narrowText = kind === 'text' && widthMm < 60;
  const fontSizePt = narrowText ? Math.max(6, Math.min(20, widthMm * 1.1)) : 20;
  return { id: crypto.randomUUID(), name: '', kind, xMm: widthMm * .1, yMm: heightMm * .1,
    widthMm: Math.max(1, widthMm * .6), heightMm: heightMm * (kind === 'text' ? .2 : .35), rotation: 0,
    shape: 'rectangle', points: structuredClone(RECTANGLE_POINTS),
    style: { ...DEFAULT_FRAME_STYLE, fontSizePt, lineHeightPt: fontSizePt * 1.3, fill: 'none', ...(narrowText ? { paddingMm: Math.min(1, widthMm * .1) } : {}) },
    ...(narrowText ? { widthMm: heightMm * .8, heightMm: Math.max(1, widthMm * .8), xMm: (widthMm - heightMm * .8) / 2, yMm: (heightMm - Math.max(1, widthMm * .8)) / 2, rotation: 90 } : {}),
    ...(kind === 'text' ? { content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }) } : {}) };
}

/** Clamp both axes together when preserving the current image proportions. */
export function resizePublicationMatterImage(value: FrameGraphicTransform, axis: 'widthMm' | 'heightMm', size: number): FrameGraphicTransform {
  if (!Number.isFinite(size) || size <= 0) throw new Error('Invalid image size.');
  const bound = (n: number) => Math.max(.000001, Math.min(20000, n));
  if (!value.keepAspectRatio) return { ...value, [axis]: bound(size) };
  const factor = Math.max(.000001 / Math.min(value.widthMm, value.heightMm), Math.min(size / value[axis], 20000 / Math.max(value.widthMm, value.heightMm)));
  return { ...value, widthMm: bound(value.widthMm * factor), heightMm: bound(value.heightMm * factor) };
}

export function fitPublicationMatterImage(frame: PublicationMatterFrame, fit: 'contain' | 'cover'): FrameGraphicTransform {
  const value = frameGraphicTransform(frame);
  const ratio = value.intrinsicWidthMm / value.intrinsicHeightMm;
  const requestedWidth = fit === 'contain' ? Math.min(frame.widthMm, frame.heightMm * ratio) : Math.max(frame.widthMm, frame.heightMm * ratio);
  const fitted = resizePublicationMatterImage({ ...value, keepAspectRatio: true, widthMm: value.intrinsicWidthMm, heightMm: value.intrinsicHeightMm }, 'widthMm', requestedWidth);
  const { widthMm, heightMm } = fitted;
  return { ...value, widthMm, heightMm, offsetXMm: (frame.widthMm - widthMm) / 2, offsetYMm: (frame.heightMm - heightMm) / 2, rotation: 0 };
}

export function matterFrameBoxStyle(frame: PublicationMatterFrame, widthMm: number, heightMm: number) {
  return { position: 'absolute' as const, left: `${frame.xMm / widthMm * 100}%`, top: `${frame.yMm / heightMm * 100}%`,
    width: `${frame.widthMm / widthMm * 100}%`, height: `${frame.heightMm / heightMm * 100}%`, transform: `rotate(${frame.rotation}deg)`, transformOrigin: 'center' };
}
export function matterImageStyle(frame: PublicationMatterFrame) {
  const image = frameGraphicTransform(frame);
  return { position: 'absolute' as const, left: `${image.offsetXMm / frame.widthMm * 100}%`, top: `${image.offsetYMm / frame.heightMm * 100}%`,
    width: `${image.widthMm / frame.widthMm * 100}%`, height: `${image.heightMm / frame.heightMm * 100}%`, transform: `rotate(${image.rotation}deg)`, transformOrigin: 'center', maxWidth: 'none', maxHeight: 'none', margin: 0, objectFit: frame.image?.fit ?? 'fill' as const };
}

export function validatePublicationMatterFrames(value: unknown, validateContent: (value: unknown) => void, sheet = false): void {
  const fail = (): never => { throw new Error('Invalid publication page frame.'); };
  if (!Array.isArray(value) || value.length > (sheet ? 512 : 128)) fail();
  const frames = value as PublicationMatterFrame[];
  const ids = new Set<string>();
  const finite = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  const color = (c: unknown) => typeof c === 'string' && /^#[a-f0-9]{6}$/i.test(c);
  for (const frame of frames) {
    if (!frame || typeof frame !== 'object' || typeof frame.id !== 'string' || !frame.id || frame.id.length > 200 || ids.has(frame.id)
      || typeof frame.name !== 'string' || frame.name.length > 256 || !['text', 'graphic'].includes(frame.kind)
      || !finite(frame.xMm, -2000, sheet ? 4000 : 2000) || !finite(frame.yMm, -2000, 2000)
      || !finite(frame.widthMm, 1, sheet ? 4000 : 2000) || !finite(frame.heightMm, 1, 2000) || !finite(frame.rotation, -360, 360)
      || (frame.vertical !== undefined && !['top', 'center', 'bottom'].includes(frame.vertical))
      || (frame.coverAnchor !== undefined && !['left', 'spine', 'right'].includes(frame.coverAnchor))
      || !['rectangle', 'ellipse', 'polygon'].includes(frame.shape) || !Array.isArray(frame.points)
      || frame.points.length < 3 || frame.points.length > 32 || frame.points.some((point: FramePoint) => !point || !finite(point.x, 0, 100) || !finite(point.y, 0, 100))) fail();
    ids.add(frame.id);
    const style = frame.style;
    if (!style || typeof style.fontFamily !== 'string' || !style.fontFamily.trim() || style.fontFamily.length > 128
      || !finite(style.fontSizePt, 6, 120) || !finite(style.lineHeightPt, 6, 240)
      || ![400, 700].includes(style.fontWeight) || !['normal', 'italic'].includes(style.fontStyle)
      || !color(style.color) || !(style.fill === 'none' || color(style.fill)) || !color(style.stroke)
      || (style.hyphenation !== undefined && typeof style.hyphenation !== 'boolean')
      || (style.language !== undefined && (typeof style.language !== 'string' || style.language.length > 85 || (style.language && !/^[a-z]{2,8}(?:-[a-z0-9]{1,8})*$/i.test(style.language))))
      || !finite(style.strokeWidthMm, 0, 20) || !finite(style.paddingMm, 0, 60) || !['left', 'center', 'right', 'justify'].includes(style.alignment)) fail();
    if (frame.kind === 'text') {
      validateContent(frame.content);
      if (frame.image !== undefined || frame.graphicTransform !== undefined) fail();
    } else if (frame.content !== undefined) fail();
    if (frame.image !== undefined && (!frame.image || typeof frame.image.assetId !== 'string' || !frame.image.assetId || frame.image.assetId.length > 256 || typeof frame.image.alt !== 'string' || frame.image.alt.length > 10000 || (frame.image.fit !== undefined && !['contain', 'cover'].includes(frame.image.fit)))) fail();
    const graphic = frame.graphicTransform;
    if (graphic !== undefined && (!graphic || !finite(graphic.offsetXMm, -20000, 20000) || !finite(graphic.offsetYMm, -20000, 20000)
      || !finite(graphic.widthMm, .000001, 20000) || !finite(graphic.heightMm, .000001, 20000) || !finite(graphic.rotation, -360, 360)
      || !finite(graphic.intrinsicWidthMm, .000001, 20000) || !finite(graphic.intrinsicHeightMm, .000001, 20000) || typeof graphic.keepAspectRatio !== 'boolean')) fail();
  }
}
