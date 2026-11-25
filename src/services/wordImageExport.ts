import type { OmiImageBlockData } from '../types/omi';
import { normalizeWordPictureLayout } from '../model/wordPictureLayout';
import type { StoreZipEntry } from './simpleZip';

const MAX_BYTES = 25 * 1024 * 1024;
const EMU = 9525;
const NS = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
const xml = (value: string) => value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function raster(source: string): {bytes: Uint8Array; ext: string; type: string} | undefined {
  if (source.length > Math.ceil(MAX_BYTES / 3) * 4 + 64) return undefined;
  const match = /^data:(image\/(?:png|jpeg|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(source);
  if (!match) return undefined;
  try {
    const type = match[1]!, bytes = Uint8Array.from(atob(match[2]!), ch => ch.charCodeAt(0));
    if (!bytes.length || bytes.length > MAX_BYTES) return undefined;
    const png = type === 'image/png' && [137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n);
    const jpeg = type === 'image/jpeg' && bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
    const gif = type === 'image/gif' && ['GIF87a','GIF89a'].includes(String.fromCharCode(...bytes.subarray(0,6)));
    if (!png&&!jpeg&&!gif) return undefined;
    return {bytes,ext:png?'png':jpeg?'jpg':'gif',type};
  } catch { return undefined; }
}
function size(value: number | undefined, fallback: number): number {
  return typeof value==='number'&&Number.isFinite(value)&&value>0 ? Math.min(100000000,Math.max(1,Math.round(value*EMU))) : fallback;
}
export class WordImageRegistry {
  private readonly parts: {id:string;path:string;type:string;bytes:Uint8Array}[]=[];
  constructor(private readonly warnings:string[]) {}
  render(image: OmiImageBlockData, suffix=''): string | undefined {
    const layout=normalizeWordPictureLayout(image.wordPicture);
    // Composed SVG previews may contain separate editable labels. Never export
    // the original raster alone when doing so would silently drop those labels.
    if (image.textBoxes?.length) return undefined;
    const data=raster(layout?.originalRaster && image.src.startsWith('data:image/svg+xml;') ? layout.originalRaster : image.src);
    if (!data) return undefined;
    const id=this.parts.length+1, relationship=id===1?'rIdImage':'rIdImage'+id;
    const path='media/omi-picture-'+id+'.'+data.ext;
    this.parts.push({id:relationship,path,type:data.type,bytes:data.bytes});
    const cx=size(image.width,layout?.cx??4572000),cy=size(image.height,layout?.cy??3048000);
    const alt=xml(image.alt??''),name='Picture '+id;
    const extent='<wp:extent cx="'+cx+'" cy="'+cy+'"/>';
    const effect='<wp:effectExtent l="0" t="0" r="0" b="0"/>';
    const properties='<wp:docPr id="'+id+'" name="'+name+'" descr="'+alt+'"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>';
    const c=layout?.crop;
    const crop=c?'<a:srcRect l="'+c.l+'" t="'+c.t+'" r="'+c.r+'" b="'+c.b+'"/>':'';
    const graphic='<a:graphic><a:graphicData uri="'+NS+'"><pic:pic><pic:nvPicPr><pic:cNvPr id="'+id+'" name="'+name+'" descr="'+alt+'"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="'+relationship+'"/>'+crop+'<a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="'+cx+'" cy="'+cy+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>';
    const f=layout?.floating;
    const position=(axis:'H'|'V',p:{relativeFrom:string;align?:string;offset?:number})=>'<wp:position'+axis+' relativeFrom="'+p.relativeFrom+'">'+(p.align?'<wp:align>'+p.align+'</wp:align>':'<wp:posOffset>'+p.offset+'</wp:posOffset>')+'</wp:position'+axis+'>';
    let drawing:string;
    if(f){
      drawing='<wp:anchor distT="'+f.distT+'" distB="'+f.distB+'" distL="'+f.distL+'" distR="'+f.distR+'" simplePos="0" relativeHeight="0" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="0"><wp:simplePos x="0" y="0"/>'+position('H',f.horizontal)+position('V',f.vertical)+extent+effect+'<wp:wrapSquare wrapText="'+f.wrapText+'"/>'+properties+graphic+'</wp:anchor>';
      this.warnings.push('Floating Word image uses its OMI image block as the anchor paragraph; exact rendered wrapping may differ from the source.');
    }else drawing='<wp:inline distT="0" distB="0" distL="0" distR="0">'+extent+effect+properties+graphic+'</wp:inline>';
    return '<w:p><w:r><w:drawing xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="'+NS+'">'+drawing+'</w:drawing></w:r>'+suffix+'</w:p>';
  }
  contentTypes():string {return this.parts.map(p=>'<Override PartName="/word/'+p.path+'" ContentType="'+p.type+'"/>').join('');}
  relationships():string {return this.parts.map(p=>'<Relationship Id="'+p.id+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="'+p.path+'"/>').join('');}
  entries():StoreZipEntry[] {return this.parts.map(p=>({name:'word/'+p.path,bytes:p.bytes}));}
}
