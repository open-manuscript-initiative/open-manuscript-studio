import type { OmiManuscript } from '../types/omi';
import { walkManuscriptStructure } from './manuscriptTreeTraversal';
import { getNoteKind } from './notes';
import { isPublicPublicationNote } from './publicationAnnotations';
import { sourceAttributionLossDiagnostics } from './sourceAttributionExport';

type Format = 'DOCX' | 'IDML' | 'XTG' | 'MIF' | 'SLA' | 'LaTeX' | 'EPUB';
export interface PublicationSemanticLoss {
  code: string;
  severity: 'warning';
  targetId: string;
  message: string;
}

/** Describes current adapter losses without changing the portable source or copying private bodies. */
export function publicationSemanticLossDiagnostics(manuscript: OmiManuscript, format: Format): PublicationSemanticLoss[] {
  const losses: PublicationSemanticLoss[] = sourceAttributionLossDiagnostics(manuscript, format);
  const add = (code: string, targetId: string, message: string) => losses.push({ code, severity: 'warning', targetId, message: `${format} ${message}` });
  for (const citation of manuscript.citations ?? []) {
    add('citation-relationship-not-preserved', citation.id, 'output does not preserve the structured OMI citation-to-record relationship. A visible label is not an equivalent relationship.');
  }
  for (const reference of manuscript.crossReferences ?? []) {
    add('cross-reference-relationship-not-preserved', reference.id, 'output does not preserve the structured OMI cross-reference target relationship.');
  }
  const textProjection = format !== 'DOCX' && format !== 'IDML';
  for (const note of manuscript.annotations.filter(isPublicPublicationNote)) {
    if (format === 'EPUB') add('note-not-preserved', note.id, 'output omits this public note body and its semantic note relationship.');
    else if (textProjection) add('note-role-projected-as-text', note.id, 'output projects this public note into ordinary note-list text; its native note role and anchor relationship are not preserved.');
    else if (format === 'DOCX' && getNoteKind(note) === 'author-note') add('note-role-projected-as-footnote', note.id, 'output projects the author-note role into a native footnote.');
  }
  if (textProjection) for (const item of walkManuscriptStructure(manuscript.sections)) {
    if (item.kind === 'block' && item.block.visual) add('visual-object-projected-as-text', item.block.id, 'output projects this structured visual object into descriptive text; object structure is not preserved.');
  }
  return losses;
}

export function semanticLossWarnings(losses: readonly PublicationSemanticLoss[]): string[] {
  return losses.map(item => `${item.code}: ${item.message}`);
}
