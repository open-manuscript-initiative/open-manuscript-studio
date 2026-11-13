import assert from "node:assert/strict";
import test from "node:test";
import {
  createTextBox,
  renderTextBoxContent,
  renderTextBoxGraphic,
  textBoxPlainText,
} from "../src/model/textBoxes.ts";
import {
  createImageBlock,
  createTextBoxBlock,
} from "../src/model/visualBlocks.ts";
import { serializeOmiJson } from "../src/services/exportOmi.ts";
import { parseOmiJson } from "../src/services/omiPortableFormat.ts";
import { renderHtmlArticle } from "../src/services/exportHtml.ts";
import { renderJatsArticle } from "../src/services/exportJats.ts";
import { blockPlainText } from "../src/services/exportTextUtils.ts";
import { createVersionedTestManuscript } from "./testManuscriptFixture.ts";
function formattedBox() {
  const legacy = createTextBox();
  delete legacy.contentProfile;
  return {
    ...legacy,
    x: 20,
    y: 30,
    width: 210,
    height: 50,
    content: JSON.stringify({
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "right" },
          content: [
            {
              type: "text",
              text: "English label Ő & <1>",
              marks: [
                { type: "bold" },
                {
                  type: "textBoxStyle",
                  attrs: {
                    fontFamily: "Arial",
                    fontSize: 12,
                    color: "#EE0000",
                  },
                },
              ],
            },
            { type: "text", text: "2", marks: [{ type: "omiSuperscript" }] },
          ],
        },
      ],
    }),
  };
}
test("independent and overlaid semantic text boxes survive OMI save and reopening", () => {
  const m = createVersionedTestManuscript();
  const box = formattedBox();
  const image = createImageBlock({
    src: "data:image/png;base64,AA==",
    mediaType: "image/png",
    alt: "Score",
    width: 400,
    height: 200,
    textBoxes: [box],
  });
  const standalone = createTextBoxBlock({
    ...box,
    id: "standalone-box",
    rotation: 25,
  });
  m.sections[0].blocks.push(image, standalone);
  assert.deepEqual(
    parseOmiJson(serializeOmiJson(m)).sections[0].blocks.slice(-2),
    [image, standalone],
  );
  assert.equal(
    blockPlainText(standalone),
    "[Text-box]\nEnglish label Ő & <1>2",
  );
  assert.match(blockPlainText(image), /English label Ő & <1>2/);
});
test("HTML publication preserves responsive picture overlays and independent boxes", () => {
  const m = createVersionedTestManuscript();
  const box = formattedBox();
  m.sections[0].blocks.push(
    createImageBlock({
      src: "data:image/png;base64,AA==",
      mediaType: "image/png",
      alt: "Score",
      width: 400,
      height: 200,
      textBoxes: [box],
    }),
    createTextBoxBlock({ ...box, id: "standalone-box" }),
  );
  const output = renderHtmlArticle(m);
  assert.equal(
    (output.html.match(/English label Ő &amp; &lt;1&gt;/g) ?? []).length,
    2,
  );
  for (const pattern of [
    /viewBox="0 0 400 200"/,
    /translate\(20 30\)/,
    /font-family:Arial;font-size:12px;color:#EE0000/,
    /background:#ffffff/,
    /<strong>/,
    /<sup>2<\/sup>/,
  ])
    assert.match(output.html, pattern);
});
test("text box rendering escapes scholarly text and rejects executable HTML and CSS", () => {
  const box = formattedBox();
  const doc = JSON.parse(box.content);
  doc.content[0].attrs = { textAlign: "left;position:fixed" };
  doc.content[0].content[0].text = "<img src=x onerror=alert(1)>";
  doc.content[0].content[0].marks.push({
    type: "link",
    attrs: { href: "javascript:alert(1)" },
  });
  doc.content[0].content[0].marks[1].attrs = {
    fontFamily: "Arial;position:fixed",
    fontSize: 99999,
    color: "url(https://attacker.invalid)",
  };
  box.content = JSON.stringify(doc);
  box.background = "url(https://attacker.invalid)";
  const html = renderTextBoxGraphic(400, 200, [box]);
  assert.doesNotMatch(html, /<img|javascript:|url\(|position:fixed|99999/);
  assert.match(html, /&lt;img/);
  assert.match(html, /font-size:400px/);
  assert.match(html, /text-align:left/);
});
test("empty and legacy plain text remain editable safe paragraphs", () => {
  const box = createTextBox();
  assert.equal(textBoxPlainText(box), "");
  delete box.contentProfile;
  box.content = "Literal <b>text</b> & Ő";
  assert.equal(textBoxPlainText(box), box.content);
  assert.match(
    renderTextBoxContent(box),
    /Literal &lt;b&gt;text&lt;\/b&gt; &amp; Ő/,
  );
  box.content =
    '{"type":"doc","content":[null,{"content":[null,{"type":"text","text":"safe","marks":[null]}]}]}';
  assert.equal(textBoxPlainText(box), "safe");
});
test("JATS retains text box content with an explicit layout fallback diagnostic", () => {
  const m = createVersionedTestManuscript();
  m.sections[0].blocks.push(createTextBoxBlock(formattedBox()));
  const result = renderJatsArticle(m);
  assert.match(
    result.xml,
    /<boxed-text[^>]*><p>English label Ő &amp; &lt;1&gt;2/,
  );
  assert.ok(
    result.diagnostics.some((d) => d.code === "text-box-layout-fallback"),
  );
});
test("portable schema refuses malformed text box geometry", () => {
  const m = createVersionedTestManuscript();
  m.sections[0].blocks.push(
    createTextBoxBlock({ ...formattedBox(), width: -20 }),
  );
  assert.throws(
    () => parseOmiJson(serializeOmiJson(m)),
    /schema|width|minimum/,
  );
});

test("portable asset containers retain editable labels independently of image bytes", async () => {
  const { externalizeImageBlock } = await import("../src/model/assets.ts");
  const { putAssetPayload } =
    await import("../src/services/assetRepository.ts");
  const { extractManuscriptState, commitManuscriptRevision } =
    await import("../src/model/versioning.ts");
  const { buildOmiContainer } = await import("../src/services/omiContainer.ts");
  const { inspectOmiContainer } =
    await import("../src/services/omiContainerImport.ts");
  const m = createVersionedTestManuscript(),
    box = formattedBox();
  const { encodeTextBoxContent, decodeTextBoxContent, TEXT_BOX_CONTENT_PROFILE } = await import('../src/model/textBoxContent.ts');
  box.content = encodeTextBoxContent(decodeTextBoxContent(box.content).document);
  box.contentProfile = TEXT_BOX_CONTENT_PROFILE;
  const image = await externalizeImageBlock(
    createImageBlock({
      src: "data:image/png;base64,ZmFrZS1wbmctcGF5bG9hZA==",
      mediaType: "image/png",
      alt: "Annotated score",
      width: 400,
      height: 200,
      textBoxes: [box],
    }),
  );
  assert.ok(image);
  const state = extractManuscriptState(m);
  state.assets = [image.asset];
  state.sections[0].blocks.push(
    image.block,
    createTextBoxBlock({ ...box, id: "standalone-portable" }),
  );
  const committed = commitManuscriptRevision(m, state, {
    summary: "Attach semantic graphical text",
    timestamp: "2026-08-07T12:01:00.000Z",
    events: [
      {
        operation: "asset.attach" as never,
        targetId: image.asset.id,
        path: "/assets/-",
        nextValue: image.asset,
      },
    ],
  });
  await putAssetPayload(committed.id, image.asset.id, image.bytes);
  const packed = await buildOmiContainer(committed),
    reopened = await inspectOmiContainer(packed.bytes);
  assert.equal(
    reopened.validForImport,
    true,
    JSON.stringify(reopened.diagnostics),
  );
  assert.equal(reopened.assets.length, 1);
  const visual = reopened.manuscript!.sections[0].blocks.find(
    (b) => b.id === image.block.id,
  )!.visual;
  assert.ok(visual?.kind === "image");
  assert.equal(visual.src, "");
  assert.deepEqual(visual.textBoxes, [box]);
  assert.equal(
    new TextDecoder().decode(reopened.assets[0].bytes),
    "fake-png-payload",
  );
});
