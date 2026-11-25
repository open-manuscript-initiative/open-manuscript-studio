import { tableCellDocument, tableCellPlainText, parseTableCellContent } from './tableLayout';
import type { OmiAnnotation, OmiManuscript } from '../types/omi';
import { publicManuscriptExtensions } from './manuscriptImportOrigin';
import { normalizeDirectValue } from './directFormatting';
import { noteBodyPlainText, type NoteJsonNode } from './noteRichText';
import { mapManuscriptBlocks } from './manuscriptTreeTraversal';

/** Workflow visibility and hidden provenance are never public publication notes. */
export function isPublicPublicationNote(annotation: OmiAnnotation): boolean {
  return annotation.type === 'note' && annotation.renderingHint !== 'hidden' && !annotation.visibility;
}

/**
 * Non-mutating publication projection. Portable save/history must use the original
 * manuscript: this view deliberately omits private annotation bodies and anchors.
 * Unresolved anchors remain for the renderer's existing diagnostics.
 */
export function publicPublicationManuscript(manuscript: OmiManuscript, options: { preserveHiddenText?: boolean } = {}): OmiManuscript {
  const extensions = publicManuscriptExtensions(manuscript.extensions);
  const privateIds = new Set(manuscript.annotations
    .filter((annotation) => !isPublicPublicationNote(annotation))
    .map((annotation) => annotation.id));
  if (options.preserveHiddenText && !privateIds.size) return extensions === manuscript.extensions ? manuscript : { ...manuscript, extensions };

  function contentView(content: string): string {
    type Node = { type?: string; attrs?: { noteId?: unknown }; marks?: {type?:string;attrs?:Record<string,unknown>}[]; content?: Node[] };
    let changed = false;
    function visit(node: Node): Node | undefined {
      if (!options.preserveHiddenText && node.marks?.some(mark=>mark.type==='omiHiddenText' && normalizeDirectValue('omiHiddenText',mark.attrs?.value)===true)) { changed=true; return undefined; }
      if (node.type === 'omiNote' && typeof node.attrs?.noteId === 'string'
        && privateIds.has(node.attrs.noteId)) { changed=true; return undefined; }
      return node.content ? { ...node, content: node.content.flatMap((child) => {
        const projected = visit(child);
        return projected ? [projected] : [];
      }) } : node;
    }
    try {
      const parsed = JSON.parse(content) as Node;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return content;
      const projected = visit(parsed);
      return changed ? JSON.stringify(projected ?? { type: 'doc', content: [] }) : content;
    } catch {
      // Legacy plain text has no structured annotation anchor to remove.
      return content;
    }
  }

  const annotations = manuscript.annotations.filter(isPublicPublicationNote).map(note=>{
    if (!note.bodyContent) return note;
    const bodyContent=contentView(note.bodyContent);
    if(bodyContent===note.bodyContent) return note;
    return {...note,bodyContent,body:noteBodyPlainText(JSON.parse(bodyContent) as NoteJsonNode)};
  });
  const sections=mapManuscriptBlocks(manuscript.sections,block=>{
    const content=contentView(block.content);
    const table=block.visual;
    if(table?.kind==='table'&&table.cellContent){
      const cells=table.cells.map(row=>[...row]);
      const cellContent:Record<string,string>={};
      for(let r=0;r<cells.length;r++) for(let c=0;c<cells[r]!.length;c++){
        const doc=tableCellDocument(table,r,c);
        if(!doc) continue;
        const projected=contentView(JSON.stringify(doc));
        const parsed=parseTableCellContent(projected);
        if(parsed){cells[r]![c]=tableCellPlainText(parsed);cellContent[r+':'+c]=projected;}
      }
      return {...block,content,visual:{...table,cells,cellContent}};
    }
    return content===block.content ? block : {...block,content};
  });
  if (extensions===manuscript.extensions && annotations.length===manuscript.annotations.length && annotations.every((note,i)=>note===manuscript.annotations[i]) && sections.every((section,i)=>section===manuscript.sections[i])) return manuscript;
  return {...manuscript,extensions,annotations,sections};
}
