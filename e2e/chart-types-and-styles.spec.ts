import { expect, test } from '@playwright/test';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

test('editable chart families and publishing styles preserve their source data', async ({ page }) => {
  await installMockStudioApi(page);
  await signInToStudio(page);
  await page.getByRole('button', { name: /^New OMI study/ }).click();
  await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    const { createChartBlock } = await import('/src/model/visualBlocks.ts');
    const manuscript = useStudioStore.getState().manuscript;
    useStudioStore.getState().loadManuscript({
      ...manuscript,
      title: 'Chart variants',
      sections: [{
        id: 'charts',
        title: 'Figures',
        blocks: [createChartBlock(
          [['Year', 'Articles', 'Reviews'], ['2024', '12', '4'], ['2025', '18', '6'], ['2026', '23', '9']],
          {}, 'chart-variants',
        )],
      }],
    });
  });

  // The editor may add a caret paragraph before a visual block; identify the chart by its stable ID.
  const editor = page.locator('.omi-visual-block--chart[data-block-id="chart-variants"]');
  await expect(editor.locator('svg[data-chart-type="bar"]')).toBeVisible();
  const type = editor.locator('.omi-chart-settings select').first();
  const style = editor.locator('.omi-chart-settings select').nth(1);
  for (const chartType of ['horizontal-bar', 'stacked-bar', 'stacked-100', 'line', 'area', 'pie', 'donut', 'scatter', 'radar']) {
    await type.selectOption(chartType);
    await expect(editor.locator(`svg[data-chart-type="${chartType}"]`)).toBeVisible();
    await expect(editor.locator('svg path, svg rect, svg circle, svg polygon, svg polyline').first()).toBeAttached();
  }
  await style.selectOption('monochrome');
  await expect(editor.locator('svg[data-chart-style="monochrome"]')).toBeVisible();
  await editor.locator('input[type="checkbox"]').nth(2).check();

  const readVisual = () => page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    // Do not assume the first manuscript block remains the graphic: the editor
    // can insert text/caret blocks around structured visuals.
    return useStudioStore.getState().manuscript.sections
      .flatMap(section => section.blocks)
      .find(block => block.id === 'chart-variants')?.visual;
  });
  await expect.poll(async () => (await readVisual())?.kind).toBe('chart');
  const visual = await readVisual();
  if (visual?.kind !== 'chart') throw new Error('Chart block was not retained in manuscript state');
  expect(visual.chartType).toBe('radar');
  expect(visual.stylePreset).toBe('monochrome');
  expect(visual.showValues).toBe(true);
  expect(visual.cells).toEqual([['Year', 'Articles', 'Reviews'], ['2024', '12', '4'], ['2025', '18', '6'], ['2026', '23', '9']]);
});
