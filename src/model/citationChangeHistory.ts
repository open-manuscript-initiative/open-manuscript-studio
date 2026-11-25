import type { OmiBlock, OmiSection } from '../types/omi';
import type { CreateChangeEventInput } from './versioning';
import { walkManuscriptStructure } from './manuscriptTreeTraversal';

/**
 * Record every derived citation-label change in the revision event log,
 * including edits inside embedded sections and child blocks. Author text is
 * never modified by this projection: callers compare old and new snapshots.
 */
export function collectCitationBlockContentChanges(
  previousSections: readonly OmiSection[],
  nextSections: readonly OmiSection[],
): Array<{
  operation: Extract<CreateChangeEventInput['operation'],'block.content.set'|'block.update'>;
  targetId: string;
  path: string;
  previousValue: string|OmiBlock;
  nextValue: string|OmiBlock;
}> {
  const previous = new Map<string, OmiBlock>();
  for (const entry of walkManuscriptStructure(previousSections)) {
    if (entry.kind === 'block') previous.set(entry.block.id, entry.block);
  }
  const changes: ReturnType<typeof collectCitationBlockContentChanges> = [];
  for (const entry of walkManuscriptStructure(nextSections)) {
    if (entry.kind !== 'block') continue;
    const old=previous.get(entry.block.id);
    if(!old)continue;
    if(JSON.stringify(old.visual)!==JSON.stringify(entry.block.visual)){
      changes.push({operation:'block.update',targetId:entry.block.id,path:'/blocks/'+entry.block.id,previousValue:old,nextValue:entry.block});
      continue;
    }
    const oldContent=old.content;
    if(oldContent===entry.block.content)continue;
    changes.push({
      operation: 'block.content.set',
      targetId: entry.block.id,
      path: `/blocks/${entry.block.id}/content`,
      previousValue: oldContent,
      nextValue: entry.block.content,
    });
  }
  return changes;
}
