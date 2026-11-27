import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)
  test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });

for (const facing of [false, true]) {
  test(`front-matter input measures body layout only when geometry changes (${facing ? 'facing' : 'single'})`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await installMockStudioApi(page);
    await signInToStudio(page);
    await page.getByRole('button', { name: /^New OMI study/ }).click();
    await page.evaluate(async facingPages => {
      const { useStudioStore } = await import('/src/app/useStudioStore.ts');
      const { clonePublicationStyleTemplate, PUBLICATION_STYLE_STORAGE_KEY } = await import('/src/services/publicationStyleExport.ts');
      const style = clonePublicationStyleTemplate(); style.page.facingPages = facingPages;
      localStorage.setItem(PUBLICATION_STYLE_STORAGE_KEY, JSON.stringify(style));
      const source = useStudioStore.getState().manuscript;
      useStudioStore.getState().loadManuscript({ ...source, title: 'Short', subtitle: 'Short', motto: 'Short', abstract: 'Short',
        sections: [{ id: 'layout-section', title: '', blocks: Array.from({ length: 100 }, (_, index) => ({
          id: `layout-${index}`, type: 'paragraph', content: 'Synthetic scholarly text for publication layout measurement. '.repeat(5),
        })) }],
      });
    }, facing);
    await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publication editor', exact: true }).click();
    const canvas = page.locator('.publication-document-canvas');
    await expect(canvas.locator('.publication-document-title')).toBeVisible();
    await expect(canvas).toHaveAttribute('data-publication-layout-ready', 'true', { timeout: 30_000 });
    const probe = await canvas.evaluateHandle(root => {
      const content = root.querySelector<HTMLElement>('.publication-document-content')!;
      const state = { reads: 0, lastRead: performance.now(), mutations: [] as { type: string; name: string; attribute: string | null }[] };
      const original = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function () {
        if (this.hasAttribute('data-block-id') && content.contains(this)) {
          state.reads++; state.lastRead = performance.now();
        }
        return original.call(this);
      };
      const observer = new MutationObserver(records => {
        for (const record of records) {
          const target = record.target instanceof Element ? record.target : record.target.parentElement;
          if (target?.closest('.publication-document-front-matter textarea'))
            state.mutations.push({ type: record.type, name: target.tagName, attribute: record.attributeName });
        }
      });
      observer.observe(content, { childList: true, characterData: true, attributes: true, attributeFilter: ['style'], subtree: true });
      return { state, quiet: () => performance.now() - state.lastRead, reset: () => { state.reads = 0; state.mutations = []; },
        stop: () => { Element.prototype.getBoundingClientRect = original; observer.disconnect(); } };
    });
    try {
      await expect.poll(() => probe.evaluate(value => value.quiet()), { timeout: 30_000 }).toBeGreaterThan(300);
      const before = await page.evaluate(async () => {
        const { useStudioStore } = await import('/src/app/useStudioStore.ts');
        return JSON.stringify(useStudioStore.getState().manuscript.sections);
      });
      const first = canvas.locator('p[data-block-id="layout-0"]');
      const topInPaper = () => first.evaluate(element => element.getBoundingClientRect().top - element.closest('.publication-document-paper')!.getBoundingClientRect().top);
      const initialTop = await topInPaper();
      await probe.evaluate(value => value.reset());
      for (const field of ['title', 'subtitle', 'motto', 'abstract']) {
        const input = canvas.locator(`textarea.publication-document-${field}`);
        await input.click(); await page.keyboard.press('End'); await page.keyboard.type('xxx', { delay: 20 });
        await expect(input).toHaveValue('Shortxxx');
      }
      // Allow the observer and scheduled frames to drain before checking work.
      await page.evaluate(() => new Promise<void>(resolve => { requestAnimationFrame(() => { requestAnimationFrame(() => resolve()); }); }));
      await expect.poll(() => probe.evaluate(value => value.quiet())).toBeGreaterThan(300);
      const sameLineReads = await probe.evaluate(value => value.state.reads);
      await testInfo.attach('front-matter-observer.json', { body: JSON.stringify(await probe.evaluate(value => value.state)), contentType: 'application/json' });
      expect(sameLineReads).toBe(0);
      expect(await page.evaluate(async () => {
        const { useStudioStore } = await import('/src/app/useStudioStore.ts');
        const { serializeOmiJson } = await import('/src/services/exportOmi.ts');
        const { parseOmiJson } = await import('/src/services/omiPortableFormat.ts');
        const manuscript = parseOmiJson(serializeOmiJson(useStudioStore.getState().manuscript));
        return [manuscript.title, manuscript.subtitle, manuscript.motto, manuscript.abstract];
      })).toEqual(Array(4).fill('Shortxxx'));
      await probe.evaluate(value => value.reset());
      const title = canvas.locator('textarea.publication-document-title');
      await title.fill('A longer scholarly title with Hungarian őű, Ελληνικά and العربية. '.repeat(6));
      await expect.poll(() => probe.evaluate(value => value.state.reads)).toBeGreaterThan(0);
      await expect.poll(topInPaper).toBeGreaterThan(initialTop + 20);
      await expect.poll(() => probe.evaluate(value => value.quiet()), { timeout: 30_000 }).toBeGreaterThan(300);
      expect(await title.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
      await probe.evaluate(value => value.reset());
      await title.fill('Shortxxx');
      await expect.poll(() => probe.evaluate(value => value.state.reads)).toBeGreaterThan(0);
      await expect.poll(async () => Math.abs(await topInPaper() - initialTop)).toBeLessThan(1);
      expect(await page.evaluate(async () => {
        const { useStudioStore } = await import('/src/app/useStudioStore.ts');
        return JSON.stringify(useStudioStore.getState().manuscript.sections);
      })).toBe(before);
    } finally {
      await probe.evaluate(value => value.stop()); await probe.dispose();
    }
  });
}
