import type {
  OmiBlock,
  OmiChartBlockData,
  OmiEquationBlockData,
  OmiImageBlockData,
  OmiSection,
  OmiTableBlockData,
  OmiVisualBlockData,
} from '../types/omi';

export type OmiCaptionSequenceScope = 'document' | 'section';

/**
 * Semantic caption metadata attached to a structured manuscript object.
 *
 * `label` and `sequenceKey` are semantic identities, while the rendered number
 * is derived from document order. This mirrors Word's Caption/SEQ concept
 * without storing field-code strings in the OMI document model.
 */
export interface OmiCaption {
  id: string;
  label: string;
  sequenceKey: string;
  title: string;
  scope?: OmiCaptionSequenceScope;
  source?: {
    format?: string;
    instruction?: string;
  };
}

export interface OmiResolvedCaption extends OmiCaption {
  number: number;
  blockId: string;
  sectionId: string;
  objectKind: OmiVisualBlockData['kind'];
  renderedLabel: string;
}

const DEFAULT_LABELS: Record<OmiVisualBlockData['kind'], string> = {
  image: 'Figure',
  table: 'Table',
  chart: 'Figure',
  equation: 'Equation',
};

export function defaultCaptionLabel(kind: OmiVisualBlockData['kind']): string {
  return DEFAULT_LABELS[kind];
}

export function normalizeCaptionSequenceKey(label: string): string {
  return label.trim().toLocaleLowerCase().replace(/\s+/g, '-');
}

export function getLegacyCaptionTitle(visual: OmiVisualBlockData): string {
  if (visual.kind === 'image' || visual.kind === 'table' || visual.kind === 'chart' || visual.kind === 'equation') {
    return visual.caption?.trim() ?? '';
  }
  return '';
}

export function ensureSemanticCaption(
  visual: OmiVisualBlockData,
  previous?: OmiVisualBlockData,
): OmiVisualBlockData {
  const title = getLegacyCaptionTitle(visual);
  const existing = visual.semanticCaption ?? previous?.semanticCaption;

  if (!title) {
    if (!visual.semanticCaption) return visual;
    const { semanticCaption: _removed, ...rest } = visual;
    return rest as OmiVisualBlockData;
  }

  const label = existing?.label?.trim() || defaultCaptionLabel(visual.kind);
  const semanticCaption: OmiCaption = {
    id: existing?.id ?? crypto.randomUUID(),
    label,
    sequenceKey: existing?.sequenceKey?.trim() || normalizeCaptionSequenceKey(label),
    title,
    scope: existing?.scope ?? 'document',
    ...(existing?.source ? { source: existing.source } : {}),
  };

  return { ...visual, semanticCaption };
}

export function resolveSemanticCaptions(sections: readonly OmiSection[]): OmiResolvedCaption[] {
  const result: OmiResolvedCaption[] = [];
  const documentCounters = new Map<string, number>();

  for (const section of sections) {
    const sectionCounters = new Map<string, number>();
    for (const block of section.blocks) {
      const visual = block.visual;
      if (!visual) continue;

      const semantic = visual.semanticCaption;
      const title = semantic?.title?.trim() || getLegacyCaptionTitle(visual);
      if (!title) continue;

      const label = semantic?.label?.trim() || defaultCaptionLabel(visual.kind);
      const sequenceKey = semantic?.sequenceKey?.trim() || normalizeCaptionSequenceKey(label);
      const scope = semantic?.scope ?? 'document';
      const counters = scope === 'section' ? sectionCounters : documentCounters;
      const number = (counters.get(sequenceKey) ?? 0) + 1;
      counters.set(sequenceKey, number);

      result.push({
        id: semantic?.id ?? `caption:${block.id}`,
        label,
        sequenceKey,
        title,
        scope,
        ...(semantic?.source ? { source: semantic.source } : {}),
        number,
        blockId: block.id,
        sectionId: section.id,
        objectKind: visual.kind,
        renderedLabel: `${label} ${number}. ${title}`,
      });
    }
  }

  return result;
}

export function updateCaptionSemantics(
  visual: OmiVisualBlockData,
  input: Partial<Pick<OmiCaption, 'label' | 'sequenceKey' | 'scope'>>,
): OmiVisualBlockData {
  const normalized = ensureSemanticCaption(visual);
  if (!normalized.semanticCaption) return normalized;

  const label = input.label?.trim() || normalized.semanticCaption.label;
  return {
    ...normalized,
    semanticCaption: {
      ...normalized.semanticCaption,
      ...input,
      label,
      sequenceKey:
        input.sequenceKey?.trim() ||
        (input.label !== undefined
          ? normalizeCaptionSequenceKey(label)
          : normalized.semanticCaption.sequenceKey),
    },
  };
}

export function captionForBlock(block: OmiBlock): OmiCaption | undefined {
  if (!block.visual) return undefined;
  return ensureSemanticCaption(block.visual).semanticCaption;
}

declare module '../types/omi' {
  interface OmiImageBlockData {
    semanticCaption?: OmiCaption;
  }

  interface OmiTableBlockData {
    semanticCaption?: OmiCaption;
  }

  interface OmiChartBlockData {
    semanticCaption?: OmiCaption;
  }

  interface OmiEquationBlockData {
    semanticCaption?: OmiCaption;
  }
}

void (undefined as unknown as OmiImageBlockData | OmiTableBlockData | OmiChartBlockData | OmiEquationBlockData);
