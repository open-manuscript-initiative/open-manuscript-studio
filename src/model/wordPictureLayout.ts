/** Bounded Word picture geometry. All stored native dimensions are EMU;
 * crop fractions use DrawingML's integer thousandths of a percent. */
export interface WordPictureLayout {
  cx: number;
  cy: number;
  crop?: { l: number; t: number; r: number; b: number };
  floating?: {
    wrapText: 'bothSides' | 'left' | 'right' | 'largest';
    distL: number; distR: number; distT: number; distB: number;
    horizontal: { relativeFrom: 'column' | 'page' | 'margin'; align?: 'left' | 'center' | 'right'; offset?: number };
    vertical: { relativeFrom: 'paragraph' | 'page' | 'margin'; align?: 'top' | 'center' | 'bottom'; offset?: number };
  };
  /** Original raster when the visible image is a generated cropped SVG preview. */
  originalRaster?: string;
}
const EMU_LIMIT = 100000000;
function integer(value: unknown, min = 0, max = EMU_LIMIT): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
export function normalizeWordPictureLayout(value: unknown): WordPictureLayout | undefined {
  if (!record(value) || !integer(value.cx,1) || !integer(value.cy,1)) return undefined;
  const result: WordPictureLayout = {cx:value.cx,cy:value.cy};
  if (value.crop !== undefined) {
    const c=value.crop;
    if (!record(c) || !integer(c.l,0,99999) || !integer(c.t,0,99999) || !integer(c.r,0,99999) || !integer(c.b,0,99999) || c.l+c.r>=100000 || c.t+c.b>=100000) return undefined;
    result.crop={l:c.l,t:c.t,r:c.r,b:c.b};
  }
  if (value.floating !== undefined) {
    const f=value.floating;
    if (!record(f) || !['bothSides','left','right','largest'].includes(String(f.wrapText)) || !integer(f.distL) || !integer(f.distR) || !integer(f.distT) || !integer(f.distB)) return undefined;
    const h=f.horizontal,v=f.vertical;
    if (!record(h)||!record(v)||!['column','page','margin'].includes(String(h.relativeFrom))||!['paragraph','page','margin'].includes(String(v.relativeFrom))) return undefined;
    if (!(h.align!==undefined ? ['left','center','right'].includes(String(h.align)) && h.offset===undefined : integer(h.offset,-EMU_LIMIT))) return undefined;
    if (!(v.align!==undefined ? ['top','center','bottom'].includes(String(v.align)) && v.offset===undefined : integer(v.offset,-EMU_LIMIT))) return undefined;
    result.floating={wrapText:f.wrapText,distL:f.distL,distR:f.distR,distT:f.distT,distB:f.distB,horizontal:h,vertical:v} as WordPictureLayout['floating'];
  }
  if (value.originalRaster !== undefined) {
    if (typeof value.originalRaster !== 'string' || !/^data:image\/(?:png|jpeg|gif);base64,/.test(value.originalRaster) || value.originalRaster.length>35000050) return undefined;
    result.originalRaster=value.originalRaster;
  }
  return result;
}
const direct=(element:Element|undefined,name:string)=>element&&Array.from(element.children).find(child=>child.localName===name);
const n=(element:Element|undefined,name:string,fallback=0)=>{const raw=element?.getAttribute(name);return raw ? Number(raw) : fallback;};
export function readWordPictureLayout(container:Element, originalRaster?:string):WordPictureLayout|undefined {
  const extent=direct(container,'extent');
  const raw:Record<string,unknown>={cx:n(extent,'cx'),cy:n(extent,'cy')};
  const crop=Array.from(container.getElementsByTagName('*')).find(el=>el.localName==='srcRect');
  if(crop)raw.crop={l:n(crop,'l'),t:n(crop,'t'),r:n(crop,'r'),b:n(crop,'b')};
  if(container.localName==='anchor'){
    const wrap=direct(container,'wrapSquare');
    const position=(name:string,fallback:string)=>{
      const p=direct(container,name), align=direct(p,'align')?.textContent;
      return {relativeFrom:p?.getAttribute('relativeFrom')||fallback,...(align?{align}:{offset:Number(direct(p,'posOffset')?.textContent??0)})};
    };
    if(wrap)raw.floating={wrapText:wrap.getAttribute('wrapText')||'bothSides',distL:n(container,'distL'),distR:n(container,'distR'),distT:n(container,'distT'),distB:n(container,'distB'),horizontal:position('positionH','column'),vertical:position('positionV','paragraph')};
  }
  if(originalRaster)raw.originalRaster=originalRaster;
  return normalizeWordPictureLayout(raw);
}
