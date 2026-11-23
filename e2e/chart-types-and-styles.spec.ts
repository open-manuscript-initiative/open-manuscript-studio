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

  const editor = page.locator('.omi-visual-block--chart');
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

  const visual = await page.evaluate(async () => {
    const { useStudioStore } = await import('/src/app/useStudioStore.ts');
    return useStudioStore.getState().manuscript.sections[0].blocks[0].visual;
  });
  expect(visual?.kind).toBe('chart');
  if (visual?.kind !== 'chart') return;
  expect(visual.chartType).toBe('radar');
  expect(visual.stylePreset).toBe('monochrome');
  expect(visual.showValues).toBe(true);
  expect(visual.cells).toEqual([['Year', 'Articles', 'Reviews'], ['2024', '12', '4'], ['2025', '18', '6'], ['2026', '23', '9']]);
});
