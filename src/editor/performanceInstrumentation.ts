export interface EditorPerformanceSample {
  name: string;
  startTime: number;
  duration: number;
}

interface EditorPerformanceCollector {
  enabled: boolean;
  samples: EditorPerformanceSample[];
}

type GlobalWithEditorPerformance = typeof globalThis & {
  __OMI_EDITOR_PERF__?: EditorPerformanceCollector;
};

function collector(): EditorPerformanceCollector | undefined {
  const value = (globalThis as GlobalWithEditorPerformance).__OMI_EDITOR_PERF__;
  return value?.enabled ? value : undefined;
}

export function measureEditorPerformance<T>(
  name: string,
  operation: () => T,
): T {
  const active = collector();
  if (!active || typeof performance === 'undefined') {
    return operation();
  }

  const startTime = performance.now();
  try {
    return operation();
  } finally {
    active.samples.push({
      name,
      startTime,
      duration: performance.now() - startTime,
    });
  }
}

export function recordEditorPerformance(
  name: string,
  startTime: number,
): void {
  const active = collector();
  if (!active || typeof performance === 'undefined') return;
  active.samples.push({
    name,
    startTime,
    duration: performance.now() - startTime,
  });
}
