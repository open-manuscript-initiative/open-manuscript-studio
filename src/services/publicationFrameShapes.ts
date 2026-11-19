import type { FrameTextStyle, PublicationFrame } from '../model/publicationFrames';

export function frameClipPath(frame: Pick<PublicationFrame, 'shape' | 'points'>): string {
  return frame.shape === 'ellipse' ? 'ellipse(50% 50% at 50% 50%)' : frame.shape === 'polygon'
    ? `polygon(evenodd, ${frame.points.map((point) => `${point.x}% ${point.y}%`).join(', ')})` : 'none';
}
export function frameShapeSvg(frame: Pick<PublicationFrame, 'shape' | 'points' | 'widthMm' | 'heightMm'>, style: FrameTextStyle): string {
  const attrs = `fill="${style.fill}" stroke="${style.stroke}" stroke-width="${style.strokeWidthMm}"`;
  const shape = frame.shape === 'ellipse' ? `<ellipse cx="${frame.widthMm / 2}" cy="${frame.heightMm / 2}" rx="${frame.widthMm / 2}" ry="${frame.heightMm / 2}" ${attrs}/>`
    : `<polygon points="${(frame.shape === 'rectangle' ? [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] : frame.points).map((p) => `${p.x * frame.widthMm / 100},${p.y * frame.heightMm / 100}`).join(' ')}" fill-rule="evenodd" ${attrs}/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="omi-frame-outline" viewBox="0 0 ${frame.widthMm} ${frame.heightMm}" preserveAspectRatio="none" aria-hidden="true">${shape}</svg>`;
}
