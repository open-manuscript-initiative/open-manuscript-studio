import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DOMParser as XmlDomParser,
  XMLSerializer as XmlSerializer,
} from '@xmldom/xmldom';
import { parseDocxManuscript } from '../src/services/docxManuscriptImport.ts';
import { parseDocxMonograph } from '../src/services/docxMonographImport.ts';
import { createStoreZip, textZipEntry } from '../src/services/simpleZip.ts';

// Share the browser DOM compatibility used by the existing fidelity tests.
const globals = globalThis as unknown as Record<string, unknown>;
globals.DOMParser = XmlDomParser;
globals.XMLSerializer = XmlSerializer;
const probe = new XmlDomParser().parseFromString('<root/>', 'application/xml');
if (
  !Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(probe.documentElement),
    'children',
  )
)
  Object.defineProperty(
    Object.getPrototypeOf(probe.documentElement),
    'children',
    {
      configurable: true,
      get(this: { childNodes: ArrayLike<{ nodeType: number }> }) {
        return Array.from(this.childNodes).filter(
          (node) => node.nodeType === 1,
        );
      },
    },
  );
if (
  !Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(probe),
    'querySelector',
  )
)
  Object.defineProperty(Object.getPrototypeOf(probe), 'querySelector', {
    configurable: true,
    value(
      this: { getElementsByTagName(name: string): ArrayLike<unknown> },
      name: string,
    ) {
      return Array.from(this.getElementsByTagName(name))[0] ?? null;
    },
  });

const ns = `xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:v="urn:schemas-microsoft-com:vml"`;
// A real 1x1 transparent PNG. The content is intentionally synthetic.
const png = new Uint8Array(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
    'base64',
  ),
);
function picture(id = 'rImage') {
  return `<w:r><w:drawing><wp:inline><wp:extent cx="3810000" cy="1905000"/><wp:docPr id="1" name="Score" descr="Music example"/><a:graphic><a:graphicData><a:blip r:embed="${id}"/></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}
function label(
  options: {
    text?: string;
    x?: number;
    y?: number;
    z?: number;
    rot?: number;
    runs?: string;
    fill?: string;
  } = {},
) {
  return `<w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor relativeHeight="${options.z ?? 1}" behindDoc="0"><wp:positionH relativeFrom="column"><wp:posOffset>${options.x ?? 190500}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>${options.y ?? 95250}</wp:posOffset></wp:positionV><wp:extent cx="1905000" cy="476250"/><a:graphic><a:graphicData><wps:wsp><wps:spPr><a:xfrm rot="${options.rot ?? 0}"/><a:solidFill>${options.fill ?? '<a:schemeClr val="lt1"/>'}</a:solidFill></wps:spPr><wps:txbx><w:txbxContent><w:p><w:pPr><w:jc w:val="left"/></w:pPr>${options.runs ?? `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="24"/><w:color w:val="EE0000"/></w:rPr><w:t>${options.text ?? 'English annotation'}</w:t></w:r>`}</w:p></w:txbxContent></wps:txbx><wps:bodyPr lIns="0" tIns="0" rIns="0" bIns="0"/></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice><mc:Fallback><w:pict><v:shape><v:textbox><w:txbxContent><w:p><w:r><w:t>Legacy duplicate</w:t></w:r></w:p></w:txbxContent></v:textbox></v:shape></w:pict></mc:Fallback></mc:AlternateContent></w:r>`;
}
function file(
  body: string,
  options: { missing?: boolean; theme?: string; styles?: string } = {},
) {
  return new File(
    [
      createStoreZip([
        textZipEntry(
          'word/document.xml',
          `<w:document ${ns}><w:body>${body}<w:sectPr><w:pgSz w:w="8880"/><w:pgMar w:left="1440" w:right="1440"/></w:sectPr></w:body></w:document>`,
        ),
        textZipEntry(
          'word/_rels/document.xml.rels',
          '<Relationships><Relationship Id="rImage" Target="media/test.png"/></Relationships>',
        ),
        ...(!options.missing
          ? [{ name: 'word/media/test.png', bytes: png }]
          : []),
        ...(options.theme
          ? [textZipEntry('word/theme/theme1.xml', options.theme)]
          : []),
        ...(options.styles
          ? [textZipEntry('word/styles.xml', options.styles)]
          : []),
      ]),
    ],
    'synthetic-picture-labels.docx',
  );
}
const text = (blocks: Array<{ content: string }>) =>
  blocks.map((block) => block.content).join('');
function svg(src: string) {
  return Buffer.from(src.split(',')[1]!, 'base64').toString('utf8');
}

for (const parse of [parseDocxManuscript, parseDocxMonograph]) {
  test(`${parse.name}: preserves overlay coordinates, white masks, per-run color and point sizes without duplicate body text`, async () => {
    const runs =
      '<w:r><w:rPr><w:rFonts w:ascii="Arial"/><w:sz w:val="18"/><w:color w:val="EE0000"/><w:b/></w:rPr><w:t>Red nine </w:t></w:r><w:r><w:rPr><w:sz w:val="30"/><w:color w:val="0055CC"/><w:i/></w:rPr><w:t>Blue fifteen</w:t></w:r>';
    const plan = await parse(
      file(
        `<w:p>${label({ runs })}${picture()}</w:p><w:p><w:r><w:t>Body survives</w:t></w:r></w:p>`,
      ),
    );
    const blocks = plan.sections.flatMap((section) => section.blocks);
    const visual = blocks.find(
      (block) => block.visual?.kind === 'image',
    )?.visual;
    assert.equal(plan.stats.images, 1);
    assert.ok(visual?.kind === 'image');
    assert.equal(visual.width, 400);
    assert.equal(visual.height, 200);
    const artwork = svg(visual.src);
    assert.match(artwork, /translate\(20 10\)/);
    assert.match(artwork, /<rect[^>]*fill="#ffffff"/);
    assert.match(
      artwork,
      /font-family="Arial" font-size="12" fill="#EE0000" font-weight="bold"/,
    );
    assert.match(
      artwork,
      /font-size="20" fill="#0055CC"[^>]*font-style="italic"/,
    );
    assert.equal(artwork.match(/<image /g)?.length, 1);
    assert.equal(visual.alt, 'Music example');
    assert.doesNotMatch(text(blocks), /Red nine|Blue fifteen|Legacy duplicate/);
    assert.match(text(blocks), /Body survives/);
    assert.equal(
      plan.warnings.some((warning) => warning.code === 'text-boxes-flattened'),
      false,
    );
  });

  test(`${parse.name}: preserves drawing order, theme colors, Unicode and XML escaping`, async () => {
    const theme =
      '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:clrScheme><a:accent1><a:srgbClr val="008877"/></a:accent1></a:clrScheme></a:themeElements></a:theme>';
    const runs =
      '<w:r><w:rPr><w:sz w:val="20"/><w:color w:themeColor="accent1" w:val="123456"/></w:rPr><w:t>Ő &amp; &lt;English&gt;</w:t></w:r>';
    const plan = await parse(
      file(
        `<w:p>${picture()}${label({ text: 'Front label', z: 20 })}${label({ runs, z: 10 })}</w:p>`,
        { theme },
      ),
    );
    const block = plan.sections
      .flatMap((section) => section.blocks)
      .find((block) => block.visual?.kind === 'image');
    assert.ok(block?.visual?.kind === 'image');
    const artwork = svg(block.visual.src);
    assert.match(artwork, /fill="#008877"/);
    assert.match(artwork, /Ő &amp; &lt;English&gt;/);
    assert.ok(artwork.indexOf('Ő &amp;') < artwork.indexOf('Front label'));
    assert.equal(artwork.match(/<g /g)?.length, 2);
    assert.doesNotMatch(
      text(plan.sections.flatMap((section) => section.blocks)),
      /Legacy duplicate/,
    );
  });

  test(`${parse.name}: resolves inherited font size and style without changing explicit run overrides`, async () => {
    const styles = `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="character" w:styleId="BaseLabel"><w:rPr><w:sz w:val="21"/><w:color w:val="AA2200"/><w:rFonts w:ascii="Georgia"/></w:rPr></w:style><w:style w:type="character" w:styleId="EmphasisLabel"><w:basedOn w:val="BaseLabel"/><w:rPr><w:i/></w:rPr></w:style></w:styles>`;
    const runs =
      '<w:r><w:rPr><w:rStyle w:val="EmphasisLabel"/></w:rPr><w:t>Inherited</w:t></w:r><w:r><w:rPr><w:rStyle w:val="EmphasisLabel"/><w:sz w:val="36"/><w:color w:val="002288"/></w:rPr><w:t> Override</w:t></w:r>';
    const plan = await parse(
      file(`<w:p>${picture()}${label({ runs })}</w:p>`, { styles }),
    );
    const block = plan.sections
      .flatMap((section) => section.blocks)
      .find((block) => block.visual?.kind === 'image');
    assert.ok(block?.visual?.kind === 'image');
    const artwork = svg(block.visual.src);
    assert.match(
      artwork,
      /font-family="Georgia" font-size="14" fill="#AA2200"[^>]*font-style="italic"/,
    );
    assert.match(
      artwork,
      /font-family="Georgia" font-size="24" fill="#002288"/,
    );
  });

  test(`${parse.name}: keeps a label extending below the bitmap visible`, async () => {
    const plan = await parse(
      file(
        `<w:p>${picture()}${label({ y: 1809750, text: 'Below the edge' })}</w:p>`,
      ),
    );
    const block = plan.sections
      .flatMap((section) => section.blocks)
      .find((block) => block.visual?.kind === 'image');
    assert.ok(block?.visual?.kind === 'image');
    assert.equal(block.visual.height, 240);
    assert.match(svg(block.visual.src), /viewBox="0 0 400 240"/);
    assert.match(svg(block.visual.src), /<image width="400" height="200"/);
  });

  test(`${parse.name}: uses the picture's own section width for centered placement`, async () => {
    const smallerPicture = picture().replace('cx="3810000"', 'cx="1905000"');
    const body = `<w:p><w:pPr><w:jc w:val="center"/><w:sectPr><w:pgSz w:w="11880"/><w:pgMar w:left="1440" w:right="1440"/></w:sectPr></w:pPr>${smallerPicture}${label({ x: 2095500 })}</w:p>`;
    const plan = await parse(file(body));
    const block = plan.sections
      .flatMap((section) => section.blocks)
      .find((block) => block.visual?.kind === 'image');
    assert.ok(block?.visual?.kind === 'image');
    assert.equal(svg(block.visual.src).includes('translate(20 10)'), true);
  });

  test(`${parse.name}: retains the Word crop before painting annotations over the visible image`, async () => {
    const croppedPicture = picture().replace(
      '<a:blip r:embed="rImage"/>',
      '<a:blip r:embed="rImage"/><a:srcRect b="20000"/>',
    );
    for (const overlay of ['', label()]) {
      const plan = await parse(file(`<w:p>${croppedPicture}${overlay}</w:p>`));
      const block = plan.sections
        .flatMap((section) => section.blocks)
        .find((block) => block.visual?.kind === 'image');
      assert.ok(block?.visual?.kind === 'image');
      const artwork = svg(block.visual.src);
      assert.match(artwork, /viewBox="0 0 400 200" overflow="hidden"/);
      assert.match(artwork, /<image x="0" y="0" width="400" height="250"/);
      assert.equal((artwork.match(/<g /g) ?? []).length, overlay ? 1 : 0);
    }
  });

  test(`${parse.name}: retains unsupported or unresolvable labels once as editable text`, async () => {
    for (const source of [
      file(`<w:p>${label({ rot: 5400000 })}${picture()}</w:p>`),
      file(`<w:p>${label()}${picture()}</w:p>`, { missing: true }),
    ]) {
      const plan = await parse(source);
      const body = text(plan.sections.flatMap((section) => section.blocks));
      assert.equal((body.match(/English annotation/g) ?? []).length, 1);
      assert.doesNotMatch(body, /Legacy duplicate/);
      assert.ok(
        plan.warnings.some(
          (warning) => warning.code === 'text-boxes-flattened',
        ),
      );
    }
  });

  test(`${parse.name}: attaches the preceding paragraph's label without moving its body text`, async () => {
    const plan = await parse(
      file(
        `<w:p><w:pPr><w:spacing w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>Short body</w:t></w:r>${label({ y: 381000 })}</w:p><w:p>${picture()}</w:p>`,
      ),
    );
    const blocks = plan.sections.flatMap((section) => section.blocks);
    assert.match(text(blocks), /Short body/);
    assert.doesNotMatch(text(blocks), /English annotation/);
    assert.ok(
      plan.warnings.some(
        (warning) => warning.code === 'picture-label-position-estimated',
      ),
    );
    const block = blocks.find((block) => block.visual?.kind === 'image');
    assert.ok(block?.visual?.kind === 'image');
    assert.match(svg(block.visual.src), /translate\(20 24\)/);
  });

  test(`${parse.name}: never guesses across a caption or table`, async () => {
    const plan = await parse(
      file(
        `<w:p>${label()}</w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Table</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p>${picture()}</w:p>`,
      ),
    );
    const blocks = plan.sections.flatMap((section) => section.blocks);
    assert.match(text(blocks), /English annotation/);
    const block = blocks.find((block) => block.visual?.kind === 'image');
    assert.ok(block?.visual?.kind === 'image');
    assert.equal(block.visual.mediaType, 'image/png');
  });
}
