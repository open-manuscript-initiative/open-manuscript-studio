import { refreshPublicationTables, renamePublicationTablePreset, renamePublicationTableBindings, normalizePublicationTableStyles } from '../model/tableAppearancePresets';
import { useStudioStore } from './useStudioStore';
import { getAppliedPublicationTemplate, PUBLICATION_TEMPLATE_EXTENSION, type PublicationTemplate } from '../model/publicationTemplates';
import { prepareTemplatedPublication } from '../services/publicationTemplates';
import { safeOjsIssueTemplate } from '../model/ojsIssuePublication';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import type { PublicationStyle } from '../services/publicationStyleExport';
import type { OmiManuscriptState } from '../types/omi';

let checkpointTimer: ReturnType<typeof setTimeout> | undefined;

export async function stagePublicationTemplate(template: PublicationTemplate): Promise<PublicationStyle> {
  const original = useStudioStore.getState().manuscript;
  const next = await prepareTemplatedPublication(extractManuscriptState(original), safeOjsIssueTemplate(original, template));
  if (useStudioStore.getState().manuscript !== original) throw new Error('The document changed while preparing its template. Try again.');
  useStudioStore.getState().checkpoint('manual');
  stageTemplateState(next, 'Applied publication template');
  useStudioStore.getState().checkpoint('manual');
  return getAppliedPublicationTemplate(next)!.style;
}

/** Keep the template's working style inside the portable document. */
export function stageAppliedPublicationStyle(style: PublicationStyle,rename?:{from:string;to:string}): void {
  const manuscript = useStudioStore.getState().manuscript;
  const applied = getAppliedPublicationTemplate(manuscript) ?? {
    version: 1 as const, source: 'document-style' as const, id: 'publication-format', name: style.name, association: style.name, style: undefined,
  };
  if (JSON.stringify(applied.style) === JSON.stringify(style)) return;
  const profile = manuscript.embeddedPublicationProfile;
  let previousCatalog=applied.style?.tableStyles;
  let sections=manuscript.sections;
  if(rename){
    const original=previousCatalog?.items.find(p=>p.name===rename.from);
    const normalized=normalizePublicationTableStyles(previousCatalog);
    const renamed=normalized&&renamePublicationTablePreset(normalized,rename.from,rename.to);
    if(!original||!renamed||JSON.stringify(renamed)!==JSON.stringify(style.tableStyles))throw new Error('Invalid or stale table style rename.');
    sections=renamePublicationTableBindings(sections,rename.from,rename.to,original.kind);
    previousCatalog=renamed;
  }
  stageTemplateState({
    ...extractManuscriptState(manuscript),
    sections: refreshPublicationTables(sections, previousCatalog, style.tableStyles),
    embeddedPublicationProfile: profile ? { ...profile, publicationStyle: structuredClone(style) } : profile,
    extensions: { ...manuscript.extensions, [PUBLICATION_TEMPLATE_EXTENSION]: { ...applied, style: structuredClone(style) } },
  }, 'Changed publication template style');
  clearTimeout(checkpointTimer);
  checkpointTimer = setTimeout(() => {
    if (useStudioStore.getState().manuscript.id === manuscript.id) useStudioStore.getState().checkpoint('idle');
  }, 2500);
}

function stageTemplateState(next: OmiManuscriptState, summary: string): void {
  useStudioStore.setState((state) => {
    const previous = extractManuscriptState(state.manuscript);
    const timestamp = new Date().toISOString();
    const keys = ['publicationProfile', 'embeddedPublicationProfile', 'sectionNumberingStyle', 'citationStyle', 'crossReferenceNumbering', 'sections', 'title', 'subtitle', 'motto', 'titleMatter', 'documentStructure', 'assets', 'extensions'] as const;
    const events = keys.filter((key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key])).map((key) => ({
      operation: 'publication.template.set' as const, targetId: state.manuscript.id, path: `/${key}`, previousValue: previous[key], nextValue: next[key],
    }));
    if (!events.length) return state;
    return {
      manuscript: { ...state.manuscript, ...next, updatedAt: timestamp },
      pendingChangeSet: stagePendingChanges(state.pendingChangeSet, { baseRevisionId: state.manuscript.headRevisionId, summary, timestamp, events }),
    };
  });
}
