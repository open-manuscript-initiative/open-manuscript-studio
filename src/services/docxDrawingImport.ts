import type { DocxImportWarning } from "../model/docxImport";
import type { OmiImageBlockData, OmiTextBox } from "../types/omi";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const WP =
  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const MC = "http://schemas.openxmlformats.org/markup-compatibility/2006";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const EMU = 9525; // 96 CSS pixels per inch

export type WordDrawingImage = Omit<OmiImageBlockData, "kind"> & {
  sourcePart: string;
  textBox?: OmiTextBox;
};
type ImageData = WordDrawingImage;
interface Archive {
  has(name: string): boolean;
  bytes(name: string): Promise<Uint8Array>;
  text(name: string): Promise<string>;
}
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface Picture extends Rect {
  blip: Element;
  container: Element;
  paragraph: Element;
  labels: Label[];
  crop?: { left: number; top: number; right: number; bottom: number };
}
interface Label extends Rect {
  anchor: Element;
  content: Element;
  order: number;
}
interface Font {
  family: string;
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
  shift: string;
  underline?: boolean;
  strike?: boolean;
  smallCaps?: boolean;
}
interface Run {
  text: string;
  font: Font;
}

/** Resolve alternate drawings and keep semantic labels independent of artwork. */
export async function prepareWordDrawings(
  xml: string,
  archive: Archive,
  relationships: ReadonlyMap<string, { target: string; targetMode?: string }>,
): Promise<{
  xml: string;
  images: Map<string, ImageData>;
  warnings: DocxImportWarning[];
}> {
  const images = new Map<string, ImageData>();
  const warnings: DocxImportWarning[] = [];
  // Keep the monograph fast path allocation-free for ordinary documents.
  if (!/(?:AlternateContent|txbxContent|srcRect)\b/.test(xml))
    return { xml, images, warnings };
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length)
    return { xml, images, warnings };
  selectAlternateDrawings(doc);
  normalizeVmlTextBoxes(doc);
  const anchors = [
    ...elements(doc, WP, "anchor"),
    ...elements(doc, WP, "inline"),
  ].filter((anchor) => elements(anchor, W, "txbxContent").length);
  if (!anchors.length && !elements(doc, A, "srcRect").length)
    return { xml: serialize(doc), images, warnings };

  const theme = await readTheme(archive);
  const styleDocument = archive.has("word/styles.xml")
    ? new DOMParser().parseFromString(
        await archive.text("word/styles.xml"),
        "application/xml",
      )
    : undefined;
  const styles = new Map<string, Element>();
  if (styleDocument)
    for (const style of elements(styleDocument, W, "style")) {
      const id = style.getAttributeNS(W, "styleId");
      if (id) styles.set(id, style);
    }
  const defaultProperties = styleDocument
    ? elements(styleDocument, W, "rPrDefault")[0]
    : undefined;
  let defaultFont = readFont(
    defaultProperties,
    {
      family: "Times New Roman",
      size: (11 * 4) / 3,
      color: "#000000",
      bold: false,
      italic: false,
      shift: "",
    },
    theme,
  );
  const defaultStyle = [...styles.entries()].find(
    ([, style]) =>
      style.getAttributeNS(W, "type") === "paragraph" &&
      style.getAttributeNS(W, "default") === "1",
  );
  if (defaultStyle)
    defaultFont = resolveStyleFont(defaultStyle[0], defaultFont, theme, styles);
  const pictures: Picture[] = [];
  for (const blip of elements(doc, A, "blip")) {
    const container = ancestor(blip, WP, ["inline", "anchor"]);
    const paragraph = ancestor(blip, W, ["p"]);
    if (!container || !paragraph || ancestor(blip, W, ["txbxContent"]))
      continue;
    const extent = child(container, WP, "extent");
    const width = number(extent, "cx") / EMU;
    const height = number(extent, "cy") / EMU;
    if (!(width > 0 && height > 0)) continue;
    const column = columnGeometry(paragraph);
    const properties = child(paragraph, W, "pPr");
    const align = value(child(properties, W, "jc"));
    const left = number(child(properties, W, "ind"), "left") / 15;
    const right = number(child(properties, W, "ind"), "right") / 15;
    const available = column.width - left - right;
    const x =
      container.localName === "inline"
        ? column.left +
          left +
          (align === "center"
            ? (available - width) / 2
            : align === "right"
              ? available - width
              : 0)
        : coordinate(container, "H", column);
    const y =
      container.localName === "inline" ? 0 : coordinate(container, "V", column);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const sourceRect = elements(container, A, "srcRect")[0];
    const crop = sourceRect
      ? {
          left: number(sourceRect, "l") / 100000,
          top: number(sourceRect, "t") / 100000,
          right: number(sourceRect, "r") / 100000,
          bottom: number(sourceRect, "b") / 100000,
        }
      : undefined;
    if (crop && (crop.left + crop.right >= 1 || crop.top + crop.bottom >= 1))
      continue;
    pictures.push({
      blip,
      container,
      paragraph,
      x,
      y,
      width,
      height,
      labels: [],
      crop,
    });
  }

  const standalone: Label[] = [];
  for (const anchor of anchors) {
    const paragraph = ancestor(anchor, W, ["p"]);
    if (!paragraph) continue;
    const column = columnGeometry(paragraph);
    const extent = child(anchor, WP, "extent");
    const label: Label = {
      anchor,
      content: elements(anchor, W, "txbxContent")[0]!,
      x: coordinate(anchor, "H", column),
      y: coordinate(anchor, "V", column),
      width: number(extent, "cx") / EMU,
      height: number(extent, "cy") / EMU,
      order: number(anchor, "relativeHeight"),
    };
    if (
      ![label.width, label.height].every(Number.isFinite) ||
      label.width <= 0 ||
      label.height <= 0
    )
      continue;
    // Unsupported transforms/tables/fields remain editable text instead of
    // silently losing content in a partial artwork conversion.
    const transform = elements(anchor, A, "xfrm")[0];
    const body = descendants(anchor, "bodyPr")[0];
    if (
      ["wgp", "grpSp", "wpc"].some(
        (name) => descendants(anchor, name).length,
      ) ||
      transform?.getAttribute("flipH") === "1" ||
      transform?.getAttribute("flipV") === "1" ||
      number(body, "rot") ||
      (body?.getAttribute("vert") && body.getAttribute("vert") !== "horz") ||
      anchor.getAttribute("simplePos") === "1" ||
      elements(label.content, W, "tbl").length ||
      elements(label.content, W, "fldChar").length ||
      elements(label.content, W, "fldSimple").length ||
      elements(label.content, W, "footnoteReference").length ||
      elements(label.content, W, "endnoteReference").length
    )
      continue;
    if (
      !Number.isFinite(label.x) ||
      !Number.isFinite(label.y) ||
      anchor.getAttribute("behindDoc") === "1" ||
      anchor.localName === "inline"
    ) {
      standalone.push(label);
      continue;
    }
    const same = pictures.filter(
      (picture) => picture.paragraph === paragraph && overlaps(label, picture),
    );
    let picture = same.length === 1 ? same[0] : undefined;
    let adjustedY = label.y;
    let approximate = false;
    if (!picture && same.length === 0) {
      // Word often anchors an annotation in the paragraph immediately before
      // the inline picture. Never cross captions, tables or section boundaries.
      const next = nextParagraph(paragraph);
      const candidates = pictures.filter(
        (item) =>
          item.paragraph === next && item.container.localName === "inline",
      );
      if (
        candidates.length === 1 &&
        child(anchor, WP, "positionV")?.getAttribute("relativeFrom") ===
          "paragraph"
      ) {
        const precedingHeight = paragraphHeight(
          paragraph,
          column.width,
          defaultFont,
          theme,
          styles,
        );
        adjustedY -= precedingHeight;
        const candidate = candidates[0]!;
        if (overlaps({ ...label, y: adjustedY }, candidate)) {
          picture = candidate;
          approximate = true;
        }
      }
    }
    if (!picture) {
      standalone.push(label);
      continue;
    }
    picture.labels.push({
      ...label,
      x: label.x - picture.x,
      y: adjustedY - picture.y,
    });
    if (
      approximate &&
      !warnings.some((item) => item.code === "picture-label-position-estimated")
    ) {
      warnings.push({
        code: "picture-label-position-estimated",
        severity: "warning",
        message:
          "Check annotations anchored in the preceding paragraph; their picture-relative positions were estimated.",
      });
    }
  }

  for (const picture of pictures.filter(
    (item) => item.labels.length || item.crop,
  )) {
    const relationId = picture.blip.getAttributeNS(R, "embed") ?? "";
    const relation = relationships.get(relationId);
    if (!relation || relation.targetMode === "External") continue;
    const path = wordTarget(relation.target);
    const mediaType = imageMediaType(path);
    // SVGs may contain external resources; only embed raster source data here.
    if (!mediaType || !archive.has(path)) continue;
    const bitmap = dataUrl(await archive.bytes(path), mediaType);
    const labels = picture.labels.sort(
      (first, second) => first.order - second.order,
    );
    const rendered = labels.map((label) =>
      renderLabel(label, defaultFont, theme, styles),
    );
    const minX = Math.min(0, ...rendered.map((item) => item.bounds.x));
    const minY = Math.min(0, ...rendered.map((item) => item.bounds.y));
    const width =
      Math.max(
        picture.width,
        ...rendered.map((item) => item.bounds.x + item.bounds.width),
      ) - minX;
    const height =
      Math.max(
        picture.height,
        ...rendered.map((item) => item.bounds.y + item.bounds.height),
      ) - minY;
    const bitmapMarkup = renderBitmap(picture, bitmap);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${fmt(width)}" height="${fmt(height)}" viewBox="${fmt(minX)} ${fmt(minY)} ${fmt(width)} ${fmt(height)}">${bitmapMarkup}</svg>`;
    let key = `omi-picture-${images.size}`;
    while (relationships.has(key) || images.has(key)) key += "-";
    const props = child(picture.container, WP, "docPr");
    images.set(key, {
      src: dataUrl(new TextEncoder().encode(svg), "image/svg+xml"),
      mediaType: "image/svg+xml",
      textBoxes: labels.map((label) => ({
        ...readTextBox(label, defaultFont, theme, styles),
        x: label.x - minX,
        y: label.y - minY,
      })),
      sourcePart: path,
      fileName: `${
        path
          .split("/")
          .pop()
          ?.replace(/\.[^.]+$/, "") ?? "picture"
      }-annotated.svg`,
      width,
      height,
      alt: props?.getAttribute("descr") || props?.getAttribute("name") || "",
    });
    picture.blip.setAttributeNS(R, "r:embed", key);
    for (const label of labels)
      label.anchor.parentNode?.removeChild(label.anchor);
  }
  for (const picture of pictures)
    for (const label of picture.labels) {
      if (label.anchor.parentNode)
        standalone.push({
          ...label,
          x: label.x + picture.x,
          y: label.y + picture.y,
        });
    }
  for (const label of standalone) {
    const textBox = readTextBox(label, defaultFont, theme, styles);
    const paragraph = ancestor(label.anchor, W, ["p"]);
    const column = paragraph ? columnGeometry(paragraph) : { left: 0 };
    textBox.x = Number.isFinite(label.x)
      ? Math.max(0, label.x - column.left)
      : 0;
    textBox.y = Number.isFinite(label.y) ? Math.max(0, label.y) : 0;
    if (!Number.isFinite(label.x) || !Number.isFinite(label.y))
      warnings.push({
        code: "text-box-position-estimated",
        severity: "warning",
        message:
          "Independent text box retained at its semantic paragraph anchor; original page positioning requires review.",
      });
    let key = `omi-text-box-${images.size}`;
    while (relationships.has(key) || images.has(key)) key += "-";
    images.set(key, {
      src: "",
      mediaType: "",
      alt: "",
      sourcePart: "word/document.xml",
      textBox,
    });
    const marker = doc.createElementNS(A, "a:blip");
    marker.setAttributeNS(R, "r:embed", key);
    label.anchor.parentNode?.replaceChild(marker, label.anchor);
  }
  return { xml: serialize(doc), images, warnings };
}

function renderBitmap(picture: Picture, source: string): string {
  const { width, height, crop } = picture;
  if (!crop)
    return `<image width="${fmt(width)}" height="${fmt(height)}" preserveAspectRatio="none" xlink:href="${source}"/>`;
  const imageWidth = width / (1 - crop.left - crop.right);
  const imageHeight = height / (1 - crop.top - crop.bottom);
  // A nested viewport clips the source image without clipping annotations
  // which intentionally extend outside the visible picture bounds.
  return `<svg width="${fmt(width)}" height="${fmt(height)}" viewBox="0 0 ${fmt(width)} ${fmt(height)}" overflow="hidden"><image x="${fmt(-crop.left * imageWidth)}" y="${fmt(-crop.top * imageHeight)}" width="${fmt(imageWidth)}" height="${fmt(imageHeight)}" preserveAspectRatio="none" xlink:href="${source}"/></svg>`;
}

function normalizeVmlTextBoxes(doc: Document): void {
  const V = "urn:schemas-microsoft-com:vml";
  function length(value: string | undefined): number {
    const m = value?.trim().match(/^(-?[\d.]+)(pt|px|in|cm|mm)?$/i);
    return m
      ? Number(m[1]) *
          ({ pt: 4 / 3, px: 1, in: 96, cm: 96 / 2.54, mm: 96 / 25.4 }[
            m[2]?.toLowerCase() || "px"
          ] ?? 1)
      : 0;
  }
  for (const shape of elements(doc, V, "shape")) {
    const textbox = elements(shape, V, "textbox")[0];
    const content = textbox && elements(textbox, W, "txbxContent")[0];
    if (!content || !shape.parentNode) continue;
    const css = new Map(
      (shape.getAttribute("style") ?? "").split(";").map((part) => {
        const i = part.indexOf(":");
        return [part.slice(0, i).trim(), part.slice(i + 1).trim()];
      }),
    );
    const width = length(css.get("width")),
      height = length(css.get("height"));
    if (!(width > 0 && height > 0)) continue;
    const x = length(css.get("margin-left") ?? css.get("left")),
      y = length(css.get("margin-top") ?? css.get("top"));
    const inset = (textbox?.getAttribute("inset") ?? "7.2pt,3.6pt,7.2pt,3.6pt")
      .split(",")
      .map((v) => length(v));
    const fill =
      shape.getAttribute("filled") === "f"
        ? undefined
        : (hex(shape.getAttribute("fillcolor")?.replace(/^#/, "")) ??
          "#ffffff");
    const markup = `<wp:anchor xmlns:wp="${WP}" xmlns:a="${A}" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" relativeHeight="${Number(css.get("z-index")) || 0}"><wp:positionH relativeFrom="${css.get("mso-position-horizontal-relative") === "page" ? "page" : "column"}"><wp:posOffset>${Math.round(x * EMU)}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="${css.get("mso-position-vertical-relative") === "page" ? "page" : "paragraph"}"><wp:posOffset>${Math.round(y * EMU)}</wp:posOffset></wp:positionV><wp:extent cx="${Math.round(width * EMU)}" cy="${Math.round(height * EMU)}"/><wps:wsp><wps:spPr><a:xfrm rot="${Math.round((Number(css.get("rotation")) || 0) * 60000)}"/>${fill ? `<a:solidFill><a:srgbClr val="${fill.slice(1)}"/></a:solidFill>` : ""}</wps:spPr><wps:txbx/><wps:bodyPr lIns="${Math.round((inset[0] ?? 0) * EMU)}" tIns="${Math.round((inset[1] ?? 0) * EMU)}" rIns="${Math.round((inset[2] ?? 0) * EMU)}" bIns="${Math.round((inset[3] ?? 0) * EMU)}"/></wps:wsp></wp:anchor>`;
    const anchor = doc.importNode(
      new DOMParser().parseFromString(markup, "application/xml")
        .documentElement,
      true,
    ) as Element;
    descendants(anchor, "txbx")[0]!.appendChild(content);
    shape.parentNode.replaceChild(anchor, shape);
  }
}

function selectAlternateDrawings(doc: Document): void {
  for (const alternate of elements(doc, MC, "AlternateContent")) {
    if (!alternate.parentNode) continue;
    // A Choice can require capabilities unrelated to pictures. Prefer only
    // drawing choices this importer understands; otherwise use the fallback.
    const choices = Array.from(alternate.childNodes).filter(
      (node): node is Element =>
        node.nodeType === 1 && (node as Element).localName === "Choice",
    );
    const supported = choices.find(
      (choice) =>
        elements(choice, WP, "anchor").length ||
        elements(choice, WP, "inline").length,
    );
    const selected =
      supported ?? child(alternate, MC, "Fallback") ?? choices[0];
    if (!selected) continue;
    while (selected.firstChild)
      alternate.parentNode.insertBefore(selected.firstChild, alternate);
    alternate.parentNode.removeChild(alternate);
  }
}

function readTextBox(
  label: Label,
  defaultFont: Font,
  theme: Map<string, string>,
  styles: ReadonlyMap<string, Element>,
): OmiTextBox {
  const body = descendants(label.anchor, "bodyPr")[0];
  const fill = child(descendants(label.anchor, "spPr")[0], A, "solidFill");
  const base = styledFont(
    child(ancestor(label.anchor, W, ["r"]), W, "rPr"),
    defaultFont,
    theme,
    styles,
  );
  const content = Array.from(label.content.childNodes)
    .filter(
      (n): n is Element => n.nodeType === 1 && (n as Element).localName === "p",
    )
    .map((paragraph) => {
      const pPr = child(paragraph, W, "pPr");
      const font = styledFont(pPr, base, theme, styles);
      const spacing = child(pPr, W, "spacing");
      const runs = elements(paragraph, W, "r").flatMap((run) => {
        const f = styledFont(child(run, W, "rPr"), font, theme, styles);
        const marks = [
          {
            type: "textBoxStyle",
            attrs: { fontFamily: f.family, fontSize: f.size, color: f.color },
          },
          ...(f.bold ? [{ type: "bold" }] : []),
          ...(f.italic ? [{ type: "italic" }] : []),
          ...(f.underline ? [{ type: "underline" }] : []),
          ...(f.strike ? [{ type: "strike" }] : []),
          ...(f.smallCaps ? [{ type: "omiSmallCaps" }] : []),
          ...(f.shift
            ? [
                {
                  type: f.shift === "super" ? "omiSuperscript" : "omiSubscript",
                },
              ]
            : []),
        ];
        return Array.from(run.childNodes).flatMap((node) => {
          if (node.nodeType !== 1 || (node as Element).namespaceURI !== W)
            return [];
          const name = (node as Element).localName;
          if (name === "br" || name === "cr") return [{ type: "hardBreak" }];
          const text =
            name === "t"
              ? (node.textContent ?? "")
              : name === "tab"
                ? "\t"
                : "";
          return text ? [{ type: "text", text, marks }] : [];
        });
      });
      const maxFont = Math.max(
        font.size,
        ...elements(paragraph, W, "r").map(
          (r) => styledFont(child(r, W, "rPr"), font, theme, styles).size,
        ),
      );
      const line = number(spacing, "line", W);
      return {
        type: "paragraph",
        attrs: {
          textAlign:
            value(child(pPr, W, "jc")) === "both"
              ? "justify"
              : (value(child(pPr, W, "jc")) ?? "left"),
          lineHeight: line
            ? spacing?.getAttributeNS(W, "lineRule") === "exact"
              ? line / 15 / maxFont
              : line / 240
            : 1.15,
          spaceBefore: number(spacing, "before", W) / 15,
          spaceAfter: number(spacing, "after", W) / 15,
        },
        content: runs,
      };
    });
  const vertical = body?.getAttribute("anchor");
  return {
    id: crypto.randomUUID(),
    content: JSON.stringify({ type: "doc", content }),
    x: label.x,
    y: label.y,
    width: label.width,
    height: label.height,
    rotation: number(elements(label.anchor, A, "xfrm")[0], "rot") / 60000,
    background: fill ? readColor(fill, theme, "#ffffff") : undefined,
    padding: [
      optionalNumber(body, "tIns", 45720),
      optionalNumber(body, "rIns", 91440),
      optionalNumber(body, "bIns", 45720),
      optionalNumber(body, "lIns", 91440),
    ].map((v) => v / EMU) as [number, number, number, number],
    verticalAlign:
      vertical === "ctr" ? "center" : vertical === "b" ? "bottom" : "top",
  };
}

function renderLabel(
  label: Label,
  defaultFont: Font,
  theme: Map<string, string>,
  styles: ReadonlyMap<string, Element>,
): { svg: string; bounds: Rect } {
  const { anchor, content, width, height } = label;
  defaultFont = styledFont(
    child(ancestor(anchor, W, ["r"]), W, "rPr"),
    defaultFont,
    theme,
    styles,
  );
  const properties = descendants(anchor, "spPr")[0];
  const fill = child(properties, A, "solidFill");
  const background = fill ? readColor(fill, theme, "#ffffff") : "none";
  const body = descendants(anchor, "bodyPr")[0];
  const left = optionalNumber(body, "lIns", 91440) / EMU;
  const right = optionalNumber(body, "rIns", 91440) / EMU;
  const top = optionalNumber(body, "tIns", 45720) / EMU;
  const bottom = optionalNumber(body, "bIns", 45720) / EMU;
  const available = Math.max(1, width - left - right);
  let y = top;
  const lines: Array<{ runs: Run[]; height: number; align: string }> = [];
  for (const paragraph of Array.from(content.childNodes).filter(
    (node): node is Element =>
      node.nodeType === 1 && (node as Element).localName === "p",
  )) {
    const pPr = child(paragraph, W, "pPr");
    const base = styledFont(pPr, defaultFont, theme, styles);
    const runs: Run[] = [];
    for (const run of elements(paragraph, W, "r")) {
      const font = styledFont(child(run, W, "rPr"), base, theme, styles);
      for (const node of Array.from(run.childNodes)) {
        if (node.nodeType !== 1) continue;
        const item = node as Element;
        if (item.namespaceURI !== W) continue;
        if (item.localName === "t")
          runs.push({ text: item.textContent ?? "", font });
        else if (item.localName === "tab") runs.push({ text: "    ", font });
        else if (item.localName === "br" || item.localName === "cr")
          runs.push({ text: "\n", font });
      }
    }
    const spacing = child(pPr, W, "spacing");
    const lineValue = number(spacing, "line", W);
    const fixed =
      spacing?.getAttributeNS(W, "lineRule") === "exact" ? lineValue / 15 : 0;
    const factor = !fixed && lineValue ? lineValue / 240 : 1;
    for (const line of wrapRuns(
      runs,
      available,
      body?.getAttribute("wrap") === "none",
    )) {
      lines.push({
        runs: line,
        height:
          fixed ||
          (line.length
            ? Math.max(...line.map((run) => run.font.size))
            : base.size) *
            1.15 *
            factor,
        align: value(child(pPr, W, "jc")) ?? "left",
      });
    }
  }
  const textHeight = lines.reduce((total, line) => total + line.height, 0);
  const vertical = body?.getAttribute("anchor");
  if (vertical === "ctr")
    y += Math.max(0, (height - top - bottom - textHeight) / 2);
  if (vertical === "b") y += Math.max(0, height - top - bottom - textHeight);
  let textRight = width;
  let textLeft = 0;
  const text = lines
    .map((line) => {
      const used = line.runs.reduce(
        (sum, run) => sum + measure(run.text, run.font),
        0,
      );
      const x =
        left +
        (line.align === "center"
          ? (available - used) / 2
          : line.align === "right"
            ? available - used
            : 0);
      textLeft = Math.min(textLeft, x);
      textRight = Math.max(textRight, x + used);
      const baseline = y + line.height * 0.8;
      y += line.height;
      return `<text x="${fmt(x)}" y="${fmt(baseline)}" xml:space="preserve">${line.runs.map((run) => `<tspan font-family="${escapeXml(run.font.family)}" font-size="${fmt(run.font.size)}" fill="${run.font.color}" font-weight="${run.font.bold ? "bold" : "normal"}" font-style="${run.font.italic ? "italic" : "normal"}"${run.font.shift ? ` baseline-shift="${run.font.shift}"` : ""}>${escapeXml(run.text)}</tspan>`).join("")}</text>`;
    })
    .join("");
  return {
    svg: `<g transform="translate(${fmt(label.x)} ${fmt(label.y)})"><rect width="${fmt(width)}" height="${fmt(height)}" fill="${background}"/>${text}</g>`,
    bounds: {
      x: label.x + textLeft,
      y: label.y,
      width: textRight - textLeft,
      height: Math.max(height, y),
    },
  };
}

function wrapRuns(runs: Run[], width: number, noWrap = false): Run[][] {
  const result: Run[][] = [[]];
  let used = 0;
  for (const run of runs) {
    for (const token of run.text.match(/\n|[^\S\n]+|[^\s]+/gu) ?? []) {
      if (token === "\n") {
        result.push([]);
        used = 0;
        continue;
      }
      const size = measure(token, run.font);
      if (!noWrap && used > 0 && used + size > width && token.trim()) {
        result.push([]);
        used = 0;
      }
      const previous = result.at(-1)!.at(-1);
      if (
        previous &&
        JSON.stringify(previous.font) === JSON.stringify(run.font)
      )
        previous.text += token;
      else result.at(-1)!.push({ text: token, font: run.font });
      used += size;
    }
  }
  return result;
}

let measurementContext: CanvasRenderingContext2D | null | undefined;
function measure(text: string, font: Font): number {
  if (measurementContext === undefined) {
    measurementContext =
      typeof document !== "undefined" &&
      typeof document.createElement === "function"
        ? document.createElement("canvas").getContext("2d")
        : null;
  }
  if (measurementContext) {
    measurementContext.font = `${font.italic ? "italic " : ""}${font.bold ? "bold " : ""}${font.size}px "${font.family.replace(/["\\]/g, "")}"`;
    return measurementContext.measureText(text).width;
  }
  return [...text].reduce(
    (sum, character) =>
      sum +
      (/\s/.test(character)
        ? 0.25
        : /[ilI.,:;'!]/.test(character)
          ? 0.28
          : /[MW@]/.test(character)
            ? 0.85
            : 0.5) *
        font.size,
    0,
  );
}

function styledFont(
  properties: Element | undefined,
  base: Font,
  theme: Map<string, string>,
  styles: ReadonlyMap<string, Element>,
): Font {
  if (!properties) return base;
  const styleId = value(
    child(properties, W, properties.localName === "pPr" ? "pStyle" : "rStyle"),
  );
  const inherited = styleId
    ? resolveStyleFont(styleId, base, theme, styles)
    : base;
  return readFont(
    properties.localName === "pPr" ? child(properties, W, "rPr") : properties,
    inherited,
    theme,
  );
}

function resolveStyleFont(
  id: string,
  base: Font,
  theme: Map<string, string>,
  styles: ReadonlyMap<string, Element>,
  seen = new Set<string>(),
): Font {
  const style = styles.get(id);
  if (!style || seen.has(id)) return base;
  seen.add(id);
  const parent = value(child(style, W, "basedOn"));
  const inherited = parent
    ? resolveStyleFont(parent, base, theme, styles, seen)
    : base;
  return readFont(child(style, W, "rPr"), inherited, theme);
}

function readFont(
  properties: Element | undefined,
  inherited: Font,
  theme: Map<string, string>,
): Font {
  if (!properties) return { ...inherited };
  const rPr =
    properties.localName === "rPr" ? properties : child(properties, W, "rPr");
  if (!rPr) return { ...inherited };
  const font = child(rPr, W, "rFonts");
  const size = Number(
    value(child(rPr, W, "sz")) ?? value(child(rPr, W, "szCs")),
  );
  const vertical = value(child(rPr, W, "vertAlign"));
  const themeFont =
    font?.getAttributeNS(W, "asciiTheme") ||
    font?.getAttributeNS(W, "hAnsiTheme");
  return {
    family:
      font?.getAttributeNS(W, "ascii") ||
      font?.getAttributeNS(W, "hAnsi") ||
      (themeFont
        ? theme.get(`font:${themeFont.startsWith("major") ? "major" : "minor"}`)
        : undefined) ||
      inherited.family,
    size: Number.isFinite(size) && size > 0 ? (size * 2) / 3 : inherited.size,
    color: child(rPr, W, "color")
      ? readColor(child(rPr, W, "color")!, theme, inherited.color)
      : inherited.color,
    underline: child(rPr, W, "u")
      ? value(child(rPr, W, "u")) !== "none"
      : inherited.underline,
    strike: toggle(child(rPr, W, "strike"), inherited.strike ?? false),
    smallCaps: toggle(child(rPr, W, "smallCaps"), inherited.smallCaps ?? false),
    bold: toggle(child(rPr, W, "b"), inherited.bold),
    italic: toggle(child(rPr, W, "i"), inherited.italic),
    shift:
      vertical === "superscript"
        ? "super"
        : vertical === "subscript"
          ? "sub"
          : vertical === "baseline"
            ? ""
            : inherited.shift,
  };
}

async function readTheme(archive: Archive): Promise<Map<string, string>> {
  const result = new Map<string, string>([
    ["lt1", "#ffffff"],
    ["dk1", "#000000"],
    ["bg1", "#ffffff"],
    ["tx1", "#000000"],
  ]);
  if (!archive.has("word/theme/theme1.xml")) return result;
  const doc = new DOMParser().parseFromString(
    await archive.text("word/theme/theme1.xml"),
    "application/xml",
  );
  for (const kind of ["major", "minor"]) {
    const font = elements(doc, A, `${kind}Font`)[0];
    const family = font
      ? child(font, A, "latin")?.getAttribute("typeface")
      : undefined;
    if (family) result.set(`font:${kind}`, family);
  }
  const scheme = elements(doc, A, "clrScheme")[0];
  if (scheme)
    for (const node of Array.from(scheme.childNodes)) {
      if (node.nodeType !== 1) continue;
      const item = node as Element;
      const color = readColor(item, result, "");
      if (color) result.set(item.localName, color);
    }
  result.set("bg1", result.get("lt1") ?? "#ffffff");
  result.set("tx1", result.get("dk1") ?? "#000000");
  result.set("bg2", result.get("lt2") ?? "#ffffff");
  result.set("tx2", result.get("dk2") ?? "#000000");
  return result;
}

function readColor(
  root: Element,
  theme: Map<string, string>,
  fallback: string,
): string {
  const direct = value(root) ?? root.getAttribute("val");
  const themeName = root.getAttributeNS(W, "themeColor");
  const scheme = elements(root, A, "schemeClr")[0];
  const rgb = elements(root, A, "srgbClr")[0];
  const system = elements(root, A, "sysClr")[0];
  const names: Record<string, string> = {
    light1: "lt1",
    dark1: "dk1",
    light2: "lt2",
    dark2: "dk2",
    background1: "bg1",
    text1: "tx1",
    background2: "bg2",
    text2: "tx2",
  };
  let color =
    (themeName ? theme.get(names[themeName] ?? themeName) : undefined) ??
    (scheme ? theme.get(scheme.getAttribute("val") ?? "") : undefined) ??
    hex(
      rgb?.getAttribute("val") ?? system?.getAttribute("lastClr") ?? direct,
    ) ??
    fallback;
  const tint = root.getAttributeNS(W, "themeTint");
  const shade = root.getAttributeNS(W, "themeShade");
  if (/^#[\da-f]{6}$/i.test(color) && (tint || shade)) {
    const channels = [1, 3, 5].map((offset) =>
      parseInt(color.slice(offset, offset + 2), 16),
    );
    const factor = parseInt(tint || shade!, 16) / 255;
    if (Number.isFinite(factor))
      color =
        "#" +
        channels
          .map((channel) =>
            Math.round(
              tint ? channel + (255 - channel) * factor : channel * factor,
            )
              .toString(16)
              .padStart(2, "0"),
          )
          .join("");
  }
  return color;
}

function columnGeometry(paragraph: Element): {
  left: number;
  width: number;
  top: number;
} {
  const body = ancestor(paragraph, W, ["body"]);
  let section: Element | undefined;
  let block: Node | null = paragraph;
  while (block?.parentNode && block.parentNode !== body)
    block = block.parentNode;
  for (
    let node: Node | null = block;
    node && !section;
    node = node.nextSibling
  ) {
    if (node.nodeType !== 1) continue;
    const element = node as Element;
    section =
      element.localName === "sectPr"
        ? element
        : child(child(element, W, "pPr"), W, "sectPr");
  }
  section ??= body ? elements(body, W, "sectPr").at(-1) : undefined;
  const page = child(section, W, "pgSz");
  const margin = child(section, W, "pgMar");
  const pageWidth = optionalNumber(page, "w", 11906, W) / 15;
  const left = optionalNumber(margin, "left", 1440, W) / 15;
  return {
    left,
    width: pageWidth - left - optionalNumber(margin, "right", 1440, W) / 15,
    top: optionalNumber(margin, "top", 1440, W) / 15,
  };
}

function coordinate(
  anchor: Element,
  axis: "H" | "V",
  column: { left: number; top: number },
): number {
  const position = child(anchor, WP, `position${axis}`);
  const offset = child(position, WP, "posOffset");
  if (!position || !offset) return NaN;
  const relative = position.getAttribute("relativeFrom");
  const value = Number(offset.textContent) / EMU;
  if (axis === "H")
    return relative === "page"
      ? value
      : relative === "column" || relative === "margin"
        ? column.left + value
        : NaN;
  return relative === "paragraph" ? value : NaN; // page-relative Y needs Word pagination
}

function paragraphHeight(
  paragraph: Element,
  width: number,
  base: Font,
  theme: Map<string, string>,
  styles: ReadonlyMap<string, Element>,
): number {
  // Pagination can split the anchor paragraph. Only its final rendered page
  // fragment precedes an inline picture on that page.
  base = styledFont(child(paragraph, W, "pPr"), base, theme, styles);
  const runs: Run[] = [];
  for (const run of Array.from(paragraph.childNodes).filter(
    (node): node is Element =>
      node.nodeType === 1 && (node as Element).localName === "r",
  )) {
    const font = styledFont(child(run, W, "rPr"), base, theme, styles);
    for (const node of Array.from(run.childNodes)) {
      if (node.nodeType !== 1) continue;
      const item = node as Element;
      if (item.localName === "lastRenderedPageBreak") runs.length = 0;
      if (item.localName === "t")
        runs.push({ text: item.textContent ?? "", font });
      if (item.localName === "br") runs.push({ text: "\n", font });
    }
  }
  const properties = child(paragraph, W, "pPr");
  const spacing = child(properties, W, "spacing");
  const line = number(spacing, "line", W);
  const rule = spacing?.getAttributeNS(W, "lineRule");
  const lineHeight =
    rule === "exact"
      ? line / 15
      : Math.max(base.size, ...runs.map((run) => run.font.size)) *
        (line ? line / 240 : 1.15);
  return (
    wrapRuns(runs, width).length * lineHeight + number(spacing, "after", W) / 15
  );
}

function nextParagraph(paragraph: Element): Element | undefined {
  let node = paragraph.nextSibling;
  while (node && node.nodeType !== 1) node = node.nextSibling;
  return node && (node as Element).localName === "p"
    ? (node as Element)
    : undefined;
}
function overlaps(first: Rect, second: Rect): boolean {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}
function elements(
  root: Document | Element,
  namespace: string,
  name: string,
): Element[] {
  return Array.from(root.getElementsByTagNameNS(namespace, name));
}
function descendants(root: Element, name: string): Element[] {
  return Array.from(root.getElementsByTagName("*")).filter(
    (item) => item.localName === name,
  );
}
function child(
  root: Element | undefined,
  namespace: string,
  name: string,
): Element | undefined {
  return root
    ? Array.from(root.childNodes).find(
        (node): node is Element =>
          node.nodeType === 1 &&
          (node as Element).namespaceURI === namespace &&
          (node as Element).localName === name,
      )
    : undefined;
}
function ancestor(
  root: Element,
  namespace: string,
  names: string[],
): Element | undefined {
  let node = root.parentNode;
  while (node?.nodeType === 1) {
    const element = node as Element;
    if (element.namespaceURI === namespace && names.includes(element.localName))
      return element;
    node = node.parentNode;
  }
  return undefined;
}
function value(element: Element | undefined): string | undefined {
  return element?.getAttributeNS(W, "val") || undefined;
}
function number(
  element: Element | undefined,
  name: string,
  namespace?: string,
): number {
  return (
    Number(
      namespace
        ? element?.getAttributeNS(namespace, name)
        : element?.getAttribute(name),
    ) || 0
  );
}
function optionalNumber(
  element: Element | undefined,
  name: string,
  fallback: number,
  namespace?: string,
): number {
  const raw = namespace
    ? element?.getAttributeNS(namespace, name)
    : element?.getAttribute(name);
  return raw ? Number(raw) : fallback;
}
function toggle(element: Element | undefined, fallback: boolean): boolean {
  return element ? !/^(?:0|false|off)$/i.test(value(element) ?? "") : fallback;
}
function hex(value: string | null | undefined): string | undefined {
  return value && /^[\da-f]{6}$/i.test(value) ? `#${value}` : undefined;
}
function wordTarget(target: string): string {
  const clean = target.replace(/\\/g, "/").replace(/^\.\//, "");
  return clean.startsWith("word/")
    ? clean
    : `word/${clean.replace(/^\.\.\//, "")}`;
}
function imageMediaType(path: string): string | undefined {
  return (
    {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
    } as Record<string, string>
  )[path.toLowerCase().split(".").pop() ?? ""];
}
function dataUrl(bytes: Uint8Array, type: string): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${type};base64,${btoa(binary)}`;
}
function serialize(doc: Document): string {
  return new XMLSerializer().serializeToString(doc);
}
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
function fmt(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}
