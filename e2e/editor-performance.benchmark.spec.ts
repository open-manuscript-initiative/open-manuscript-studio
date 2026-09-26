import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test, type CDPSession, type Page } from '@playwright/test';

import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';
import {
  resolveEditorBenchmarkWorkload,
  type EditorBenchmarkWorkload,
} from './support/editorPerformanceWorkload';

interface SummaryStats {
  count: number;
  median: number;
  p95: number;
  max: number;
  total: number;
}

interface BrowserBenchmarkState {
  loadStart: number;
  longTasks: number[];
  inputPaintMs: number[];
}

const workload = resolveEditorBenchmarkWorkload(
  process.env.OMI_EDITOR_BENCHMARK_SCALE,
);

test('measures a large continuous manuscript in the real browser editor', async ({ page }, testInfo) => {
  test.setTimeout(workload.scale === 'reference' ? 240_000 : 120_000);

  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await installBenchmarkObservers(page);
  const api = await installMockStudioApi(page);
  await signInToStudio(page);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');

  await loadStressManuscript(page, workload);

  const editor = page.locator('.omi-study-editor .omi-continuous-tiptap-editor').first();
  await expect(editor).toBeVisible();
  await expect.poll(
    () => editor.locator(':scope > *').count(),
    { timeout: workload.scale === 'reference' ? 150_000 : 60_000 },
  ).toBeGreaterThanOrEqual(workload.textBlockCount);

  await settleTwoFrames(page);
  const openToEditableMs = await page.evaluate(() => {
    const benchmark = (globalThis as typeof globalThis & {
      __OMI_BROWSER_BENCH__: BrowserBenchmarkState;
    }).__OMI_BROWSER_BENCH__;
    return performance.now() - benchmark.loadStart;
  });

  const firstCaretMs = await focusFirstCaret(page);
  const heapAfterOpen = await readHeapUsage(cdp);
  const dom = await readDomMetrics(page);

  const scrollFrameMs = await measureScrollFrames(page);

  await page.evaluate(() => {
    const benchmark = (globalThis as typeof globalThis & {
      __OMI_BROWSER_BENCH__: BrowserBenchmarkState;
    }).__OMI_BROWSER_BENCH__;
    benchmark.inputPaintMs = [];
  });

  const lastParagraph = editor.locator('p').last();
  await lastParagraph.scrollIntoViewIfNeeded();
  await lastParagraph.click();
  await page.keyboard.press('End');

  for (let index = 0; index < workload.inputSamples; index += 1) {
    await page.keyboard.insertText(index % 2 === 0 ? 'x' : ' ');
    await page.waitForFunction(
      (minimum) => {
        const benchmark = (globalThis as typeof globalThis & {
          __OMI_BROWSER_BENCH__: BrowserBenchmarkState;
        }).__OMI_BROWSER_BENCH__;
        return benchmark.inputPaintMs.length >= minimum;
      },
      index + 1,
    );
  }

  await settleTwoFrames(page);
  const heapAfterEdits = await readHeapUsage(cdp);

  const browserMetrics = await page.evaluate(() => {
    const benchmark = (globalThis as typeof globalThis & {
      __OMI_BROWSER_BENCH__: BrowserBenchmarkState;
      __OMI_EDITOR_PERF__?: {
        enabled: boolean;
        samples: Array<{ name: string; startTime: number; duration: number }>;
      };
    });
    return {
      longTasks: benchmark.__OMI_BROWSER_BENCH__.longTasks,
      inputPaintMs: benchmark.__OMI_BROWSER_BENCH__.inputPaintMs,
      editorSamples: benchmark.__OMI_EDITOR_PERF__?.samples ?? [],
      environment: {
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemoryGiB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
        },
      },
    };
  });

  const internalPhases = Object.fromEntries(
    [...new Set(browserMetrics.editorSamples.map((sample) => sample.name))]
      .sort()
      .map((name) => [
        name,
        stats(
          browserMetrics.editorSamples
            .filter((sample) => sample.name === name)
            .map((sample) => sample.duration),
        ),
      ]),
  );

  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    commit: process.env.GITHUB_SHA ?? null,
    workload,
    environment: browserMetrics.environment,
    metrics: {
      openToEditableMs,
      firstCaretMs,
      inputToPaintMs: stats(browserMetrics.inputPaintMs),
      longTasks: stats(browserMetrics.longTasks),
      scrollFrameMs: stats(scrollFrameMs),
      dom,
      heap: {
        afterOpenUsedBytes: heapAfterOpen.usedSize,
        afterOpenTotalBytes: heapAfterOpen.totalSize,
        afterEditsUsedBytes: heapAfterEdits.usedSize,
        afterEditsTotalBytes: heapAfterEdits.totalSize,
      },
      internalPhases,
    },
  };

  const outputDirectory = resolve('test-results/editor-performance');
  mkdirSync(outputDirectory, { recursive: true });
  const outputPath = resolve(outputDirectory, 'metrics.json');
  const serialized = JSON.stringify(result, null, 2);
  writeFileSync(outputPath, serialized);

  await testInfo.attach('editor-performance-metrics', {
    body: Buffer.from(serialized),
    contentType: 'application/json',
  });

  expect(dom.tiptapHosts).toBe(1);
  expect(dom.noteAnchors).toBe(workload.noteCount);
  expect(browserMetrics.inputPaintMs).toHaveLength(workload.inputSamples);
  expect(internalPhases['continuous.project']?.count ?? 0).toBeGreaterThanOrEqual(
    workload.inputSamples,
  );
  expect(pageErrors).toEqual([]);
  expect(api.unhandledRequests).toEqual([]);
});

async function installBenchmarkObservers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const root = globalThis as typeof globalThis & {
      __OMI_EDITOR_PERF__?: {
        enabled: boolean;
        samples: Array<{ name: string; startTime: number; duration: number }>;
      };
      __OMI_BROWSER_BENCH__?: BrowserBenchmarkState;
    };

    root.__OMI_EDITOR_PERF__ = {
      enabled: true,
      samples: [],
    };
    root.__OMI_BROWSER_BENCH__ = {
      loadStart: 0,
      longTasks: [],
      inputPaintMs: [],
    };

    if (
      typeof PerformanceObserver !== 'undefined'
      && PerformanceObserver.supportedEntryTypes.includes('longtask')
    ) {
      const observer = new PerformanceObserver((entries) => {
        root.__OMI_BROWSER_BENCH__?.longTasks.push(
          ...entries.getEntries().map((entry) => entry.duration),
        );
      });
      observer.observe({ entryTypes: ['longtask'] });
    }

    document.addEventListener('beforeinput', (event) => {
      const target = event.target;
      if (
        !(target instanceof Element)
        || !target.closest('.omi-continuous-tiptap-editor')
      ) {
        return;
      }

      const start = performance.now();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          root.__OMI_BROWSER_BENCH__?.inputPaintMs.push(
            performance.now() - start,
          );
        });
      });
    }, true);
  });
}

async function loadStressManuscript(
  page: Page,
  benchmarkWorkload: EditorBenchmarkWorkload,
): Promise<void> {
  await page.evaluate((input) => {
    const root = globalThis as typeof globalThis & {
      __OMI_BROWSER_BENCH__: BrowserBenchmarkState;
      __OMI_EDITOR_PERF__?: {
        enabled: boolean;
        samples: Array<{ name: string; startTime: number; duration: number }>;
      };
    };
    root.__OMI_BROWSER_BENCH__.longTasks = [];
    root.__OMI_BROWSER_BENCH__.inputPaintMs = [];
    if (root.__OMI_EDITOR_PERF__) root.__OMI_EDITOR_PERF__.samples = [];

    const vocabulary = (
      'scholarly manuscript semantic publication history source analysis argument '
      + 'evidence archive reference methodology interpretation paragraph author editor '
      + 'research document annotation structure citation context'
    ).trim().split(/\s+/);

    const paragraphText = (blockIndex: number) =>
      Array.from(
        { length: input.wordsPerBlock },
        (_value, wordIndex) => vocabulary[(blockIndex + wordIndex) % vocabulary.length],
      ).join(' ');

    const sections = Array.from({ length: input.sectionCount }, (_value, sectionIndex) => ({
      id: `benchmark-section-${sectionIndex}`,
      title: sectionIndex === 0
        ? 'Large manuscript benchmark'
        : `Benchmark subsection ${sectionIndex}`,
      ...(sectionIndex > 0 ? { parentSectionId: 'benchmark-section-0' } : {}),
      blocks: [] as Array<Record<string, unknown>>,
    }));

    const annotations: Array<Record<string, unknown>> = [];
    let noteNumber = 0;

    for (let blockIndex = 0; blockIndex < input.textBlockCount; blockIndex += 1) {
      const notesForBlock =
        Math.floor(input.noteCount / input.textBlockCount)
        + (blockIndex < input.noteCount % input.textBlockCount ? 1 : 0);
      const inlineContent: Array<Record<string, unknown>> = [{
        type: 'text',
        text: `${paragraphText(blockIndex)} `,
      }];

      for (let localNote = 0; localNote < notesForBlock; localNote += 1) {
        const noteId = `benchmark-note-${noteNumber}`;
        const anchorId = `benchmark-note-anchor-${noteNumber}`;
        inlineContent.push({
          type: 'omiNote',
          attrs: {
            noteId,
            anchorId,
            label: String(noteNumber + 1),
            noteType: 'footnote',
          },
        });
        inlineContent.push({
          type: 'text',
          text: localNote + 1 === notesForBlock ? ' ' : ', ',
        });
        annotations.push({
          id: noteId,
          type: 'note',
          noteKind: 'footnote',
          anchorId,
          targetBlockId: `benchmark-block-${blockIndex}`,
          body: `Benchmark footnote ${noteNumber + 1}. Contextual note text for editor performance measurement.`,
          renderingHint: 'footnote',
          createdAt: '2026-09-26T00:00:00.000Z',
          modifiedAt: '2026-09-26T00:00:00.000Z',
        });
        noteNumber += 1;
      }

      const sectionIndex = Math.min(
        input.sectionCount - 1,
        Math.floor(blockIndex * input.sectionCount / input.textBlockCount),
      );
      sections[sectionIndex]!.blocks.push({
        id: `benchmark-block-${blockIndex}`,
        type: 'paragraph',
        content: JSON.stringify({
          type: 'doc',
          content: [{
            type: 'paragraph',
            content: inlineContent,
          }],
        }),
      });
    }

    for (let visualIndex = 0; visualIndex < input.visualBlockCount; visualIndex += 1) {
      const sectionIndex = visualIndex % input.sectionCount;
      sections[sectionIndex]!.blocks.push({
        id: `benchmark-table-${visualIndex}`,
        type: 'table',
        content: '',
        visual: {
          kind: 'table',
          caption: `Benchmark table ${visualIndex + 1}`,
          cells: [
            ['Measure', 'Value'],
            ['Rows', String(visualIndex + 1)],
            ['Mode', input.scale],
          ],
        },
      });
    }

    return import('/src/app/useStudioStore.ts').then(({ useStudioStore }) => {
      const base = useStudioStore.getState().manuscript;
      root.__OMI_BROWSER_BENCH__.loadStart = performance.now();
      useStudioStore.getState().loadManuscript({
        ...base,
        id: 'editor-performance-benchmark',
        title: 'Large manuscript editor performance benchmark',
        subtitle: undefined,
        abstract: undefined,
        keywords: ['benchmark'],
        sections,
        annotations,
        agents: [],
        contributions: [],
        tombstones: [],
        citations: [],
        citationClusters: [],
        crossReferences: [],
        bibliographicRecords: [],
        updatedAt: '2026-09-26T00:00:00.000Z',
      });
    });
  }, benchmarkWorkload);
}

async function focusFirstCaret(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const editor = document.querySelector<HTMLElement>(
      '.omi-study-editor .omi-continuous-tiptap-editor',
    );
    if (!editor) throw new Error('Benchmark editor is missing.');

    const start = performance.now();
    editor.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);

    await new Promise<void>((resolveFrame) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
    });
    return performance.now() - start;
  });
}

async function settleTwoFrames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolveFrame) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
  }));
}

async function readDomMetrics(page: Page) {
  return page.evaluate(() => {
    const editor = document.querySelector<HTMLElement>(
      '.omi-study-editor .omi-continuous-tiptap-editor',
    );
    return {
      elements: document.querySelectorAll('*').length,
      editorElements: editor?.querySelectorAll('*').length ?? 0,
      tiptapHosts: document.querySelectorAll(
        '.omi-study-editor .omi-continuous-tiptap-editor',
      ).length,
      topLevelNodes: editor?.children.length ?? 0,
      noteAnchors: editor?.querySelectorAll('[data-omi-note]').length ?? 0,
    };
  });
}

async function measureScrollFrames(page: Page): Promise<number[]> {
  return page.evaluate(async () => {
    const editor = document.querySelector<HTMLElement>(
      '.omi-study-editor .omi-continuous-tiptap-editor',
    );
    if (!editor) return [];

    let scroller: HTMLElement | null = editor.parentElement;
    while (scroller) {
      const style = getComputedStyle(scroller);
      if (
        /(auto|scroll)/.test(style.overflowY)
        && scroller.scrollHeight > scroller.clientHeight + 2
      ) {
        break;
      }
      scroller = scroller.parentElement;
    }

    const target = scroller ?? document.scrollingElement;
    if (!target) return [];
    const maximum = target.scrollHeight - target.clientHeight;
    if (maximum <= 0) return [];

    const samples: number[] = [];
    for (const ratio of [0.5, 1, 0]) {
      const start = performance.now();
      target.scrollTop = maximum * ratio;
      await new Promise<void>((resolveFrame) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
      });
      samples.push(performance.now() - start);
    }
    return samples;
  });
}

async function readHeapUsage(
  cdp: CDPSession,
): Promise<{ usedSize: number; totalSize: number }> {
  await cdp.send('HeapProfiler.collectGarbage');
  const usage = await cdp.send('Runtime.getHeapUsage');
  return {
    usedSize: Number(usage.usedSize ?? 0),
    totalSize: Number(usage.totalSize ?? 0),
  };
}

function stats(values: readonly number[]): SummaryStats {
  if (values.length === 0) {
    return { count: 0, median: 0, p95: 0, max: 0, total: 0 };
  }

  const ordered = [...values].sort((left, right) => left - right);
  const percentile = (fraction: number) =>
    ordered[Math.min(
      ordered.length - 1,
      Math.max(0, Math.ceil(ordered.length * fraction) - 1),
    )] ?? 0;

  return {
    count: ordered.length,
    median: percentile(0.5),
    p95: percentile(0.95),
    max: ordered[ordered.length - 1] ?? 0,
    total: ordered.reduce((sum, value) => sum + value, 0),
  };
}
