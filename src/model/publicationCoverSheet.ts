import type { PublicationMatter, PublicationMatterPage, PublicationMatterPageKind } from './publicationMatter';
import { createPublicationMatterFrame, type PublicationMatterFrame } from './publicationMatterFrames';
import { DEFAULT_FRAME_STYLE, RECTANGLE_POINTS } from './publicationFrames';
import { publicationSpineWidth } from './publicationSpine';

export type PublicationCoverSheetKind = 'cover-outside' | 'cover-inside';
export const EMPTY_COVER_TEXT = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] });
export function isPublicationCoverSheet(kind: PublicationMatterPageKind): kind is PublicationCoverSheetKind {
  return kind === 'cover-outside' || kind === 'cover-inside';
}

export function publicationCoverPanels(kind: PublicationCoverSheetKind, trimWidth: number, spineWidth: number) {
  return kind === 'cover-outside'
    ? [{ kind: 'back-cover' as const, xMm: 0, widthMm: trimWidth },
      { kind: 'spine' as const, xMm: trimWidth, widthMm: spineWidth },
      { kind: 'front-cover' as const, xMm: trimWidth + spineWidth, widthMm: trimWidth }]
    : [{ kind: 'inside-front-cover' as const, xMm: 0, widthMm: trimWidth },
      { kind: 'inside-back-cover' as const, xMm: trimWidth + spineWidth, widthMm: trimWidth }];
}

/** Old panel drafts are projected into one sheet without mutating the manuscript.
 * The first sheet edit persists that projection; original panel drafts remain intact.
 * A saved sheet is authoritative, including an explicitly disabled sheet.
 */
export function getPublicationCoverSheet(model: PublicationMatter, kind: PublicationCoverSheetKind, trimWidth: number, height: number): PublicationMatterPage {
  const saved = model.pages.find((page) => page.kind === kind);
  if (saved) return saved;
  const frames: PublicationMatterFrame[] = [];
  let enabled = false;
  for (const panel of publicationCoverPanels(kind, trimWidth, publicationSpineWidth(model))) {
    const page = model.pages.find((item) => item.kind === panel.kind && item.enabled);
    if (!page || panel.widthMm === 0) continue;
    enabled = true;
    const make = (suffix: string, type: 'text' | 'graphic'): PublicationMatterFrame => ({
      id: `cover-${panel.kind}-${suffix}`, name: '', kind: type,
      xMm: panel.xMm, yMm: 0, widthMm: panel.widthMm, heightMm: height, rotation: 0,
      shape: 'rectangle', points: structuredClone(RECTANGLE_POINTS),
      style: { ...DEFAULT_FRAME_STYLE, strokeWidthMm: 0, fill: 'none', paddingMm: 0 },
      coverAnchor: panel.kind === 'spine' ? 'spine' : panel.xMm >= trimWidth ? 'right' : 'left',
      ...(type === 'text' ? { content: EMPTY_COVER_TEXT } : {}),
    });
    const background = make('background', 'text');
    background.style.fill = page.appearance.background;
    frames.push(background);
    if (page.image) frames.push({ ...make('image', 'graphic'), image: { ...page.image } });
    const text = make('text', 'text');
    text.content = page.content;
    text.vertical = page.appearance.vertical;
    text.style = { ...text.style, fontFamily: page.appearance.fontFamily, fontSizePt: page.appearance.fontSizePt,
      lineHeightPt: page.appearance.fontSizePt * 1.4, color: page.appearance.color,
      alignment: page.appearance.alignment, paddingMm: page.appearance.paddingMm };
    frames.push(text);
    for (const [index, frame] of (page.frames ?? []).entries()) {
      frames.push({ ...structuredClone(frame), id: `cover-${panel.kind}-${index}-${frame.id.slice(0, 150)}`, xMm: panel.xMm + frame.xMm, coverAnchor: panel.kind === 'spine' ? 'spine' : panel.xMm >= trimWidth ? 'right' : 'left' });
    }
  }
  return { kind, enabled, content: EMPTY_COVER_TEXT, frames,
    appearance: { fontFamily: 'Georgia', fontSizePt: 14, color: '#25282d', background: '#ffffff', alignment: 'center', vertical: 'center', paddingMm: 0 } };
}

/** All coordinates are relative to the full sheet, including region presets. */
export function createCoverSheetFrame(type: 'text' | 'graphic', area: PublicationMatterPageKind, kind: PublicationCoverSheetKind, trimWidth: number, height: number, spineWidth: number): PublicationMatterFrame {
  const panel = publicationCoverPanels(kind, trimWidth, spineWidth).find((item) => item.kind === area && item.widthMm > 0);
  const frame = createPublicationMatterFrame(type, panel?.widthMm ?? 2 * trimWidth + spineWidth, height);
  if (panel) frame.xMm += panel.xMm;
  if (panel) frame.coverAnchor = panel.kind === 'spine' ? 'spine' : panel.xMm >= trimWidth ? 'right' : 'left';
  return frame;
}
