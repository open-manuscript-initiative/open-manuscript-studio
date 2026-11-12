import { expect, test } from "@playwright/test";
import { installMockStudioApi, signInToStudio } from "./support/mockStudioApi";
for (const width of [1440, 393]) {
  test(`edit and reopen image overlays and standalone graphical text (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await installMockStudioApi(page);
    await signInToStudio(page);
    await page.getByRole("button", { name: /^New OMI study/ }).click();
    await page.evaluate(async () => {
      const { useStudioStore } = await import("/src/app/useStudioStore.ts");
      const { createImageBlock, createTextBoxBlock } =
        await import("/src/model/visualBlocks.ts");
      const { createTextBox } = await import("/src/model/textBoxes.ts");
      const box = {
        ...createTextBox("English label"),
        x: 20,
        y: 20,
        width: 200,
        height: 50,
      };
      const doc = JSON.parse(box.content);
      doc.content[0].content[0].marks = [
        {
          type: "textBoxStyle",
          attrs: { fontFamily: "Arial", fontSize: 16, color: "#EE0000" },
        },
        { type: "bold" },
      ];
      box.content = JSON.stringify(doc);
      const image = createImageBlock(
        {
          src:
            "data:image/svg+xml;base64," +
            btoa(
              '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#edf3ff"/><path d="M0 45H400M0 60H400" stroke="#222"/></svg>',
            ),
          mediaType: "image/svg+xml",
          alt: "Annotated diagram",
          width: 400,
          height: 200,
          textBoxes: [box],
        },
        "image-box-test",
      );
      const m = useStudioStore.getState().manuscript;
      useStudioStore.getState().loadManuscript({
        ...m,
        title: "Editable text boxes",
        abstract: "",
        sections: [
          {
            id: "textbox-section",
            title: "Diagrams",
            blocks: [
              image,
              createTextBoxBlock(
                createTextBox("Standalone semantic text"),
                "standalone-test",
              ),
            ],
          },
        ],
      });
    });
    const image = page.locator("section.editor .omi-visual-block--image");
    await expect(image.locator(".omi-text-box-rendered")).toHaveText(
      "English label",
    );
    await expect(image.locator(".omi-text-box-rendered span")).toHaveCSS(
      "color",
      "rgb(238, 0, 0)",
    );
    await image.getByRole("button", { name: /^Edit text box:/ }).click();
    const panel = page.getByRole("dialog", {
      name: "Edit text box",
      exact: true,
    });
    const rich = panel.getByRole("textbox", {
      name: "Text box content",
      exact: true,
    });
    await rich.click();
    await page.keyboard.press("ControlOrMeta+a");
    await panel
      .getByRole("spinbutton", { name: "Font size (pt)", exact: true })
      .fill("18");
    await panel.getByLabel("Text color", { exact: true }).fill("#0033cc");
    await expect(image.locator(".omi-text-box-rendered span")).toHaveCSS(
      "font-size",
      "24px",
    );
    await expect(image.locator(".omi-text-box-rendered span")).toHaveCSS(
      "color",
      "rgb(0, 51, 204)",
    );
    await rich.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Edited English label");
    await expect(image.locator(".omi-text-box-rendered")).toHaveText(
      "Edited English label",
    );
    await panel
      .getByRole("spinbutton", { name: "X (px)", exact: true })
      .fill("42");
    await panel
      .getByRole("spinbutton", { name: "Width", exact: true })
      .fill("230");
    await expect(image.locator("[data-text-box-id]")).toHaveCSS("left", "42px");
    await expect(image.locator("[data-text-box-id]")).toHaveCSS(
      "width",
      "230px",
    );
    await panel.getByRole("button", { name: "Close text box editor" }).click();
    const handle = image.getByRole("button", {
      name: "Move text box",
      exact: true,
    });
    if (width === 1440) {
      await image.getByRole("button", { name: /^Edit text box:/ }).click();
      await handle.evaluate((e) => e.scrollIntoView({ block: "center" }));
      const rect = await handle.boundingBox();
      expect(rect).not.toBeNull();
      await page.mouse.move(
        rect!.x + rect!.width / 2,
        rect!.y + rect!.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        rect!.x + rect!.width / 2 + 20,
        rect!.y + rect!.height / 2 + 10,
      );
      await page.mouse.up();
      await expect(
        panel.getByRole("spinbutton", { name: "X (px)", exact: true }),
      ).not.toHaveValue("42");
      await panel
        .getByRole("button", { name: "Close text box editor" })
        .click();
    }
    const standalone = page.locator(
      "section.editor .omi-visual-block--text-box",
    );
    await standalone.getByRole("button", { name: /^Edit text box:/ }).click();
    await rich.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("Standalone revised");
    await expect(standalone.locator(".omi-text-box-rendered")).toHaveText(
      "Standalone revised",
    );
    await panel.getByRole("button", { name: "Close text box editor" }).click();
    await page.evaluate(async () => {
      const { useStudioStore } = await import("/src/app/useStudioStore.ts");
      const { serializeOmiJson } = await import("/src/services/exportOmi.ts");
      const { parseOmiJson } =
        await import("/src/services/omiPortableFormat.ts");
      useStudioStore
        .getState()
        .loadManuscript(
          parseOmiJson(serializeOmiJson(useStudioStore.getState().manuscript)),
        );
    });
    await expect(image.locator(".omi-text-box-rendered")).toHaveText(
      "Edited English label",
    );
    await expect(image.locator(".omi-text-box-rendered span")).toHaveCSS(
      "font-size",
      "24px",
    );
    await expect(standalone.locator(".omi-text-box-rendered")).toHaveText(
      "Standalone revised",
    );
    await image
      .getByRole("button", { name: "Add text box", exact: true })
      .click();
    await expect(panel).toBeVisible();
    await rich.click();
    await page.keyboard.type("New diagram note");
    await expect(image.locator(".omi-text-box-rendered")).toHaveCount(2);
    await expect(
      image
        .locator(".omi-text-box-rendered")
        .filter({ hasText: "New diagram note" }),
    ).toHaveCount(1);
    await panel
      .getByRole("button", { name: "Delete text box", exact: true })
      .click();
    await expect(image.locator(".omi-text-box-rendered")).toHaveCount(1);
    await page.getByRole("button", { name: "Insert", exact: true }).click();
    await page
      .getByRole("menu", { name: "Insert", exact: true })
      .getByRole("button", { name: "Text box", exact: true })
      .click();
    await expect(standalone).toHaveCount(2);
    await standalone
      .last()
      .getByRole("button", { name: /^Edit text box:/ })
      .click();
    await rich.click();
    await page.keyboard.type("Inserted graphical text");
    await expect(
      standalone.last().locator(".omi-text-box-rendered"),
    ).toHaveText("Inserted graphical text");
    await panel.getByRole("button", { name: "Close text box editor" }).click();
    expect(errors).toEqual([]);
    await page.screenshot({
      path: test.info().outputPath(`text-boxes-${width}.png`),
      fullPage: true,
    });
  });
}
