import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)
  test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });

test.skip(process.env.OMI_PUBLICATION_BENCHMARK !== '1', 'Opt-in publication performance benchmark; not a machine-dependent CI gate.');

const workloads = [
  { blocks: 0, facing: false, input: 'title' },
  { blocks: 100, facing: false, input: 'body' },
  { blocks: 400, facing: false, input: 'body' },
  { blocks: 400, facing: true, input: 'body' },
  { blocks: 1000, facing: true, input: 'body' },
  { blocks: 1000, facing: true, input: 'title' },
];

function percentile(samples: number[], fraction: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

for (const workload of workloads) {
  test(`publication input benchmark: ${workload.blocks} blocks, ${workload.facing ? 'facing' : 'single'} pages, ${workload.input}`, async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await installMockStudioApi(page);
    await signInToStudio(page);
    await page.getByRole('button', { name: /^New OMI study/ }).click();
    const fixture = await page.evaluateHandle((config) => ({ ready: (async () => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      const { clonePublicationStyleTemplate, PUBLICATION_STYLE_STORAGE_KEY } = await import('/src/services/publicationStyleExport.ts');
      const style = clonePublicationStyleTemplate();
      style.page.facingPages = config.facing;
      localStorage.setItem(PUBLICATION_STYLE_STORAGE_KEY, JSON.stringify(style));
      const current = useStudioStore.getState().manuscript;
      const blocks = Array.from({ length: Math.max(1, config.blocks) }, (_, index) => ({
        id: 'benchmark-' + index, type: 'paragraph' as const,
        content: config.blocks === 0 ? '' : 'Synthetic scholarly text for publication layout measurement. '.repeat(5),
      }));
      useStudioStore.getState().loadManuscript({ ...current, title: 'Benchmark', subtitle: '', abstract: '', motto: '', keywords: [], sections: [{ id: 'benchmark-section', title: '', blocks }] });
    })() }), workload);
    try { await fixture.evaluate(({ ready }) => ready); } finally { await fixture.dispose(); }

    await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
    const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
    const openStart = await page.evaluate(() => performance.now());
    await menu.getByRole('button', { name: 'Publication editor', exact: true }).click();
    const canvas = menu.locator('.publication-document-canvas');
    const editingTitle = workload.input === 'title';
    const target = editingTitle
      ? canvas.locator('textarea.publication-document-title')
      : canvas.locator('.omi-continuous-tiptap-editor [data-block-id="benchmark-0"]');
    await expect(target).toBeVisible();
    await target.click();
    // Body targets are paragraphs, not focusable controls. locator.press()
    // focuses the paragraph and blurs its enclosing contenteditable editor.
    await page.keyboard.press('End');
    await expect(editingTitle ? target : canvas.locator('.omi-continuous-tiptap-editor')).toBeFocused();
    const openToCaretMs = await page.evaluate((start) => performance.now() - start, openStart);

    const probe = await canvas.evaluateHandle((element) => {
      const samples: number[] = [], longTasks: number[] = [];
      const observer = typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes.includes('longtask')
        ? new PerformanceObserver((list) => { for (const entry of list.getEntries()) longTasks.push(entry.duration); }) : null;
      observer?.observe({ entryTypes: ['longtask'] });
      const onKey = (event: Event) => {
        if (!(event instanceof KeyboardEvent) || event.key !== 'x') return;
        const start = performance.now();
        requestAnimationFrame(() => { requestAnimationFrame(() => { samples.push(performance.now() - start); }); });
      };
      element.addEventListener('keydown', onKey, true);
      return { samples, longTasks, supportedLongTasks: observer !== null, stop: () => {
        element.removeEventListener('keydown', onKey, true);
        if (observer) {
          for (const entry of observer.takeRecords()) longTasks.push(entry.duration);
          observer.disconnect();
        }
      } };
    });
    try {
      const typed = 'x'.repeat(30);
      await page.keyboard.type(typed, { delay: 20 });
      await expect.poll(() => probe.evaluate((value) => value.samples.length), { timeout: 30_000 }).toBe(typed.length);
      if (editingTitle) await expect(target).toHaveValue('Benchmark' + typed);
      else await expect(target).toContainText(typed);
      await probe.evaluate((value) => value.stop());
      const data = await probe.evaluate(({ samples, longTasks, supportedLongTasks }) => ({ samples, longTasks, supportedLongTasks }));
      const browser = await canvas.evaluate((element) => ({
        userAgent: navigator.userAgent,
        viewport: { width: innerWidth, height: innerHeight },
        domNodes: element.querySelectorAll('*').length,
        jsHeapBytes: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null,
      }));
      const report = {
        workload, openToCaretMs, browser,
        doubleAnimationFrameLatencyMs: { median: percentile(data.samples, 0.5), p95: percentile(data.samples, 0.95), max: Math.max(...data.samples), samples: data.samples },
        longTasks: data.supportedLongTasks ? { count: data.longTasks.length, totalMs: data.longTasks.reduce((sum, duration) => sum + duration, 0), durations: data.longTasks } : null,
      };
      await testInfo.attach('publication-performance.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
    } finally {
      await probe.evaluate((value) => value.stop());
      await probe.dispose();
    }
  });
}
