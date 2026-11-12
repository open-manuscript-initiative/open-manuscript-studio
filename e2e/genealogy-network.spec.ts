import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { installMockStudioApi, signInToStudio } from './support/mockStudioApi';

const gedcom = `0 HEAD
1 GEDC
2 VERS 5.5.1
1 CHAR UTF-8
0 @I1@ INDI
1 NAME János /Varga/
1 BIRT
2 DATE ABT 1620
2 PLAC Sárospatak
0 @I2@ INDI
1 NAME Judit /Balogh/
0 @I3@ INDI
1 NAME Anna /Varga/
1 FAMC @F1@
2 PEDI birth
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
0 TRLR
`;
for (const width of [1440, 390]) {
  test(`editable GEDCOM, shared views and durable backups at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await installMockStudioApi(page);
    await page.route('**/api/v1/modules/**', (route) =>
      route.fulfill({
        json: {
          workspaceId: 'default',
          revision: 1,
          enabledModuleIds: [
            'org.omi.genealogy',
            'org.omi.relationship-networks',
          ],
          activeModuleIds: [
            'org.omi.genealogy',
            'org.omi.relationship-networks',
          ],
        },
      }),
    );
    const failures: string[] = [];
    page.on('pageerror', (error) => failures.push(error.message));
    await signInToStudio(page);
    await page.getByRole('button', { name: /^New OMI study/ }).click();
    await page
      .getByRole('button', { name: 'Manuscript menu', exact: true })
      .click();
    await page.locator('[data-modules-navigation="true"]').click();
    let tree = page.getByRole('region', { name: 'Family tree', exact: true });
    let network = page.getByRole('region', {
      name: 'Relationship network',
      exact: true,
    });
    await expect(
      tree.getByText('Saved on this device', { exact: true }),
    ).toBeVisible();
    await tree
      .getByLabel('Import GEDCOM / JSON', { exact: true })
      .setInputFiles({
        name: 'synthetic-family.ged',
        mimeType: 'text/plain',
        buffer: Buffer.from(gedcom),
      });
    await expect(
      tree.getByRole('heading', { name: /Import preview/ }),
    ).toBeVisible();
    await expect(tree.locator('.genealogy-node')).toHaveCount(0);
    await tree
      .getByRole('button', { name: 'Add to this project', exact: true })
      .click();
    await expect(tree.locator('.genealogy-node')).toHaveCount(3);
    await expect(network.locator('.genealogy-node')).toHaveCount(3);
    await expect(tree.getByLabel('Birth date', { exact: true })).toHaveValue(
      'ABT 1620',
    );
    await tree
      .getByLabel('Display name', { exact: true })
      .fill('János Varga edited');
    await tree.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(
      network
        .locator('.genealogy-node')
        .filter({ hasText: 'János Varga edited' }),
    ).toHaveCount(1);
    await tree
      .getByRole('button', { name: 'Add relationship', exact: true })
      .click();
    const relation = tree.locator('form').last();
    await relation
      .getByRole('combobox', { name: 'From / parent', exact: true })
      .selectOption({ label: 'Anna Varga' });
    await relation
      .getByRole('combobox', { name: 'To / child', exact: true })
      .selectOption({ label: 'János Varga edited' });
    await relation.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(tree.getByRole('alert')).toContainText('their own ancestor');
    await relation.getByRole('button', { name: 'Cancel', exact: true }).click();
    const node = tree
      .locator('.genealogy-node')
      .filter({ hasText: 'János Varga edited' });
    await node.scrollIntoViewIfNeeded();
    const before = await node.getAttribute('transform');
    const box = await node.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width / 2 + 30,
      box!.y + box!.height / 2 + 18,
      { steps: 5 },
    );
    await page.mouse.up();
    await expect(node).not.toHaveAttribute('transform', before!);
    await tree
      .getByRole('button', {
        name: 'Insert diagram into manuscript',
        exact: true,
      })
      .click();
    await expect(
      tree.getByText('Diagram inserted.', { exact: true }),
    ).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await tree
      .getByRole('button', { name: 'Export editable JSON', exact: true })
      .click();
    const download = await downloadPromise;
    const data = JSON.parse(await readFile((await download.path())!, 'utf8'));
    expect(data.nodes).toHaveLength(3);
    expect(data.edges).toHaveLength(3);
    expect(data.nodes[0].treePosition).toBeDefined();
    expect(
      Buffer.from(data.imports[0].originalBase64, 'base64').toString('utf8'),
    ).toBe(gedcom);
    const overflow = await tree.evaluate((el) => ({
      width: el.clientWidth,
      scroll: el.scrollWidth,
    }));
    expect(overflow.scroll).toBeLessThanOrEqual(overflow.width + 1);
    await tree.locator('.genealogy-canvas').scrollIntoViewIfNeeded();
    await tree
      .locator('.genealogy-canvas')
      .screenshot({ path: testInfo.outputPath(`family-tree-${width}.png`) });
    await network.locator('.genealogy-canvas').scrollIntoViewIfNeeded();
    await network.locator('.genealogy-canvas').screenshot({
      path: testInfo.outputPath(`relationship-network-${width}.png`),
    });
    await page.reload();
    await page
      .getByRole('button', { name: 'Manuscript menu', exact: true })
      .click();
    await page.locator('[data-modules-navigation="true"]').click();
    tree = page.getByRole('region', { name: 'Family tree', exact: true });
    network = page.getByRole('region', {
      name: 'Relationship network',
      exact: true,
    });
    await expect(tree.locator('.genealogy-node')).toHaveCount(3);
    await expect(network.locator('.genealogy-node')).toHaveCount(3);
    await expect(tree.getByLabel('Display name', { exact: true })).toHaveValue(
      'János Varga edited',
    );
    await tree
      .getByLabel('Import GEDCOM / JSON', { exact: true })
      .setInputFiles({
        name: 'invalid.ged',
        mimeType: 'text/plain',
        buffer: Buffer.from('not GEDCOM'),
      });
    await expect(tree.getByRole('alert')).toContainText('Invalid GEDCOM');
    await expect(tree.locator('.genealogy-node')).toHaveCount(3);
    expect(failures).toEqual([]);
  });
}
