import { expect, test, type Page } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } });

async function openPublication(page: Page) {
  await page.getByRole('button', { name: 'Manuscript menu', exact: true }).first().click();
  const menu = page.getByRole('dialog', { name: 'Manuscript menu' });
  await menu.getByRole('button', { name: 'Publication editor', exact: true }).click();
  return menu.locator('.publication-style-editor');
}

test('icon-only section warnings, optional checker navigation, study order and inserted pages persist and reflow', async ({ page }) => {
  test.setTimeout(120_000);
  await installMockStudioApi(page); await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  // A successful click can precede the editor's mount on loaded CI runners.
  await expect(page.locator('section.editor[aria-label="Manuscript editor"]')).toBeVisible();
  // Run the import-and-mutate fixture in a normal page module, not in an
  // inspector evaluation whose returned Promise Chromium may garbage collect.
  // Keep the state-changing setup single-shot: only poll a synchronous status.
  await page.addScriptTag({
    type: 'module',
    content: `
      void (async () => {
        try {
          const { useStudioStore } = await import('/src/app/useStudioStore.ts');
          const { clonePublicationStyleTemplate, PUBLICATION_STYLE_STORAGE_KEY } = await import('/src/services/publicationStyleExport.ts');
          const style = clonePublicationStyleTemplate();
          style.page.width = 120; style.page.height = 170;
          style.page.margins = { top: 20, bottom: 20, inner: 20, outer: 20 };
          localStorage.setItem(PUBLICATION_STYLE_STORAGE_KEY, JSON.stringify(style));
          const current = useStudioStore.getState().manuscript;
          const rich = (text) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
          useStudioStore.getState().loadManuscript({ ...current, title: 'Flow control trial',
            sections: [{ id: 'study-a', title: 'Study A', blocks: [
              { id: 'long-a', type: 'paragraph', content: rich('A long paragraph continues across pages with its original text. '.repeat(100)) },
              { id: 'last-a', type: 'paragraph', content: rich('END_OF_A') },
            ] }, { id: 'study-b', title: 'Study B', blocks: [{ id: 'body-b', type: 'paragraph', content: rich('BODY_OF_B') }] }],
          });
          window.__omiPublicationFlowStore = useStudioStore;
          window.__omiPublicationFlowSetup = { status: 'ready' };
        } catch (error) {
          window.__omiPublicationFlowSetup = {
            status: 'error',
            message: error instanceof Error ? (error.stack || error.message) : String(error),
          };
        }
      })();
    `,
  });
  await expect.poll(() => page.evaluate(() => {
    const setup = (window as Window & { __omiPublicationFlowSetup?: { status: string; message?: string } }).__omiPublicationFlowSetup;
    return setup?.status === 'error' ? `error: ${setup.message ?? 'unknown'}` : setup?.status ?? 'pending';
  }), { timeout: 30_000 }).toBe('ready');
  await page.evaluate(() => { Reflect.deleteProperty(window, '__omiPublicationFlowSetup'); });
  let editor = await openPublication(page);
  const heading = editor.locator(':is(h1,h2,h3,h4,h5,h6)[data-section-id="study-a"]').first();
  await expect.poll(() => heading.evaluate((element) => getComputedStyle(element, '::after').content)).toContain('⚠');
  await expect(editor.locator('.publication-layout-checker')).toHaveCount(0);
  await editor.getByRole('button', { name: 'Page styles and section headers', exact: true }).click();
  let panel = editor.locator('.publication-page-styles-panel');
  await expect(panel.locator('[data-layout-issue]')).toHaveCount(0);
  await panel.getByRole('checkbox', { name: 'Check layout', exact: true }).check();
  await panel.locator('[data-layout-issue="section:study-a"]').click();
  await expect(editor.locator('[data-layout-checker-target="true"]')).toHaveAttribute('data-layout-checker-section', 'study-a');
  await expect(heading).toBeInViewport();
  await editor.getByRole('button', { name: 'Page styles and section headers', exact: true }).click();
  await expect(panel.getByRole('checkbox', { name: 'Check layout', exact: true })).toBeChecked();
  await panel.getByRole('button', { name: 'Move study down: 1', exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const store = (window as Window & {
      __omiPublicationFlowStore?: {
        getState(): { manuscript: { sections: Array<{ id: string }> } };
      };
    }).__omiPublicationFlowStore;
    return store?.getState().manuscript.sections.map((item) => item.id) ?? [];
  })).toEqual(['study-b', 'study-a']);
  await panel.getByRole('button', { name: 'Save current page settings as a style', exact: true }).click();
  await panel.getByRole('textbox', { name: 'Page style name', exact: true }).fill('Inserted plate');
  const styleId = await panel.getByRole('combobox', { name: 'Page style', exact: true }).inputValue();
  await panel.getByRole('combobox', { name: 'Insert before paragraph', exact: true }).selectOption('long-a');
  await panel.getByRole('combobox', { name: 'Style for inserted page', exact: true }).selectOption(styleId);
  await panel.getByRole('button', { name: 'Insert page', exact: true }).click();
  await expect(editor.locator('[data-inserted-page]')).toHaveCount(1);
  await expect(editor.locator('[data-inserted-page]')).toHaveAttribute('data-page-style', styleId);
  // Persist from a page module as well; no dynamic-import Promise is returned
  // to the inspector when the test checkpoints the updated manuscript.
  await page.addScriptTag({
    type: 'module',
    content: `
      void (async () => {
        try {
          const { resumeLastSessionPersistence } = await import('/src/app/lastSessionPersistence.ts');
          window.__omiPublicationFlowStore.getState().checkpoint('manual');
          await resumeLastSessionPersistence();
          window.__omiPublicationFlowPersistence = { status: 'ready' };
        } catch (error) {
          window.__omiPublicationFlowPersistence = {
            status: 'error',
            message: error instanceof Error ? (error.stack || error.message) : String(error),
          };
        }
      })();
    `,
  });
  await expect.poll(() => page.evaluate(() => {
    const state = (window as Window & { __omiPublicationFlowPersistence?: { status: string; message?: string } }).__omiPublicationFlowPersistence;
    return state?.status === 'error' ? `error: ${state.message ?? 'unknown'}` : state?.status ?? 'pending';
  }), { timeout: 30_000 }).toBe('ready');
  await page.evaluate(() => {
    Reflect.deleteProperty(window, '__omiPublicationFlowPersistence');
    Reflect.deleteProperty(window, '__omiPublicationFlowStore');
  });
  await page.reload(); editor = await openPublication(page);
  await expect(editor.locator('[data-inserted-page]')).toHaveCount(1);
  await editor.getByRole('button', { name: 'Page styles and section headers', exact: true }).click();
  panel = editor.locator('.publication-page-styles-panel');
  await panel.getByRole('button', { name: 'Delete inserted page: 1', exact: true }).click();
  await expect(editor.locator('[data-inserted-page]')).toHaveCount(0);
  await expect(editor.locator('[data-block-id="last-a"]').first()).toContainText('END_OF_A');
});

test('a separately added text frame continues automatically and cursor page breaks can be removed', async ({ page }) => {
  await installMockStudioApi(page); await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  const editor = await openPublication(page);
  await editor.getByRole('button', { name: 'Frames and page styles', exact: true }).click();
  const frames = editor.locator('.omi-frame-editor');
  await frames.getByRole('button', { name: 'Add text frame', exact: true }).click();
  const text = frames.getByRole('textbox', { name: 'Story text', exact: true });
  await text.fill('Before After');
  await frames.getByRole('checkbox', { name: 'Continue this text flow on following pages', exact: true }).check();
  await text.focus(); await text.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(7, 7));
  await frames.getByRole('button', { name: 'Page break at cursor', exact: true }).click();
  await expect(frames.locator('[data-frame-page]')).toHaveCount(2);
  await expect(frames.locator('[data-frame-page="1"]')).toContainText('After');
  await frames.getByRole('button', { name: 'Remove breakpoint: 7', exact: true }).click();
  await expect(frames.locator('[data-frame-page]')).toHaveCount(1);
  await expect(text).toHaveValue('Before After');
  await frames.getByRole('button', { name: 'Add page', exact: true }).click();
  await frames.getByRole('button', { name: 'Add text frame', exact: true }).click();
  await text.fill('Overset text. '.repeat(2000));
  await expect(frames.getByRole('status').getByRole('img')).toHaveText('⚠');
  await frames.getByRole('combobox', { name: 'Selected page', exact: true }).selectOption('0');
  await editor.getByRole('button', { name: 'Page styles and section headers', exact: true }).click();
  const checker = editor.locator('.publication-layout-checker');
  await checker.getByRole('checkbox', { name: 'Check layout', exact: true }).check();
  await checker.locator('[data-layout-issue^="story:"]').first().click();
  await expect(frames.getByRole('combobox', { name: 'Selected page', exact: true })).toHaveValue('1');
});
