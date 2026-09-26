export type EditorBenchmarkScale = 'smoke' | 'reference';

export interface EditorBenchmarkWorkload {
  scale: EditorBenchmarkScale;
  sectionCount: number;
  textBlockCount: number;
  noteCount: number;
  visualBlockCount: number;
  wordsPerBlock: number;
  inputSamples: number;
}

const WORKLOADS: Record<EditorBenchmarkScale, EditorBenchmarkWorkload> = {
  smoke: {
    scale: 'smoke',
    sectionCount: 3,
    textBlockCount: 120,
    noteCount: 180,
    visualBlockCount: 4,
    wordsPerBlock: 70,
    inputSamples: 8,
  },
  reference: {
    scale: 'reference',
    sectionCount: 10,
    textBlockCount: 1500,
    noteCount: 3000,
    visualBlockCount: 30,
    wordsPerBlock: 150,
    inputSamples: 16,
  },
};

export function resolveEditorBenchmarkWorkload(
  value: string | undefined,
): EditorBenchmarkWorkload {
  return value === 'reference'
    ? WORKLOADS.reference
    : WORKLOADS.smoke;
}
