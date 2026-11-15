import {expect, test} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {installMockStudioApi, signInToStudio} from './support/mockStudioApi';

const examples = [
  {file: 'gephi-les-miserables.gexf', width: 1440, nodes: 77, edges: 254, label: 'Valjean'},
  {file: 'gephi-917-mixed.graphml', width: 390, nodes: 3, edges: 4, label: 'Sárospatak'},
] as const;

for (const example of examples) {
  test(`#917 browser example ${example.file} imports, edits, exports and reopens at ${example.width}px`, async ({page}) => {
    await page.setViewportSize({width: example.width, height: 900});
    await installMockStudioApi(page);
    await page.route('**/api/v1/modules/**', route => route.fulfill({
      json: {
        workspaceId: 'default', revision: 1,
        enabledModuleIds: ['org.omi.genealogy', 'org.omi.relationship-networks'],
        activeModuleIds: ['org.omi.genealogy', 'org.omi.relationship-networks'],
      },
    }));
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await signInToStudio(page);
    await page.getByRole('button', {name: /^New OMI study/}).click();
    await page.getByRole('button', {name: 'Manuscript menu', exact: true}).click();
    await page.locator('[data-modules-navigation="true"]').click();
    let network = page.getByRole('region', {name: 'Relationship network', exact: true});

    const buffer = await readFile(new URL(`../tests/fixtures/${example.file}`, import.meta.url));
    await network.getByLabel('Import GEDCOM / JSON', {exact: true}).setInputFiles({
      name: example.file, mimeType: 'application/xml', buffer,
    });
    const preview = network.locator('.genealogy-import-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText(example.file);
    await expect(preview).toContainText(`${example.nodes} / ${example.edges}`);
    await expect(network.locator('.genealogy-node')).toHaveCount(0);
    await network.getByRole('button', {name: 'Add to this project', exact: true}).click();
    await expect(preview).toHaveCount(0);
    await expect(network.locator('.genealogy-node')).toHaveCount(example.nodes);
    const target = network.locator('.genealogy-node').filter({hasText: example.label});
    await target.click();
    await network.getByLabel('Display name', {exact: true}).fill(example.label + ' edited');
    await network.getByRole('button', {name: 'Save', exact: true}).click();

    const jsonDownload = page.waitForEvent('download');
    await network.getByRole('button', {name: 'Export editable JSON', exact: true}).click();
    const jsonFile = await jsonDownload;
    const rawGraph = JSON.parse(await readFile((await jsonFile.path())!, 'utf8'));
    expect(rawGraph.nodes).toHaveLength(example.nodes);
    expect(rawGraph.edges).toHaveLength(example.edges);
    expect(rawGraph.nodes.some((n: {label: string}) => n.label === example.label + ' edited')).toBe(true);
    expect(rawGraph.imports[0].originalText).toBe(buffer.toString('utf8'));

    const projectDownload = page.waitForEvent('download');
    await network.getByRole('button', {name: 'Save portable project file', exact: true}).click();
    const projectFile = await projectDownload;
    const project = JSON.parse(await readFile((await projectFile.path())!, 'utf8'));
    expect(project.format).toBe('omi-research-project');
    const record = project.resources.find((r: {resourceType: string}) => r.resourceType === 'org.omi.genealogy');
    expect(record.inline.edges).toEqual(rawGraph.edges);
    expect(record.inline.nodes).toEqual(rawGraph.nodes);

    await page.reload();
    await page.getByRole('button', {name: 'Manuscript menu', exact: true}).click();
    await page.locator('[data-modules-navigation="true"]').click();
    network = page.getByRole('region', {name: 'Relationship network', exact: true});
    await expect(network.locator('.genealogy-node')).toHaveCount(example.nodes);
    await expect(network.locator('.genealogy-node').filter({hasText: example.label + ' edited'})).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}
