import type { JSONContent } from "@tiptap/core";
import type { OmiTextBox, OmiVisualBlockData } from "../types/omi";

export function createTextBox(text = ""): OmiTextBox {
  return {
    id: crypto.randomUUID(),
    x: 0,
    y: 0,
    width: 240,
    height: 90,
    background: "#ffffff",
    padding: [4, 4, 4, 4],
    content: JSON.stringify({
      type: "doc",
      content: [
        { type: "paragraph", content: text ? [{ type: "text", text }] : [] },
      ],
    }),
  };
}
export function boxNumber(
  value: unknown,
  fallback = 0,
  min = -100000,
  max = 100000,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}
export function boxColor(value: unknown, fallback = "transparent"): string {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value)
    ? value
    : fallback;
}
export function boxFont(value: unknown): string {
  return typeof value === "string" &&
    value.length < 150 &&
    /^[\p{L}\p{N} _,-]+$/u.test(value)
    ? value
    : "Times New Roman";
}
export function textPresentation(
  attrs: Record<string, unknown> = {},
): Record<string, string> {
  return {
    ...(attrs.fontFamily ? { "font-family": boxFont(attrs.fontFamily) } : {}),
    ...(attrs.fontSize
      ? { "font-size": `${boxNumber(attrs.fontSize, 16, 1, 400)}px` }
      : {}),
    ...(attrs.color ? { color: boxColor(attrs.color, "#000000") } : {}),
  };
}
const marks = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "omiSuperscript",
  "omiSubscript",
  "omiSmallCaps",
]);
/** Only a constrained rich-text vocabulary crosses the stored-content trust boundary. */
export function textBoxDocument(content: string): JSONContent {
  let input: JSONContent;
  try {
    input = JSON.parse(content) as JSONContent;
  } catch {
    input = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: content ? [{ type: "text", text: content }] : [],
        },
      ],
    };
  }
  const raw =
    input?.type === "doc" && Array.isArray(input.content)
      ? input.content.filter((p) => p && typeof p === "object")
      : [];
  return {
    type: "doc",
    content: (raw.length ? raw : [{ type: "paragraph" }])
      .slice(0, 10000)
      .map((p) => {
        const nodes: JSONContent[] = (
          Array.isArray(p.content) ? p.content : []
        ).flatMap((n): JSONContent[] => {
          if (!n || typeof n !== "object") return [];
          if (n.type === "hardBreak") return [{ type: "hardBreak" }];
          if (n.type !== "text" || typeof n.text !== "string" || !n.text)
            return [];
          return [
            {
              type: "text",
              text: n.text,
              marks: (Array.isArray(n.marks) ? n.marks : []).flatMap((m) => {
                if (!m || typeof m !== "object") return [];
                if (marks.has(m.type)) return [{ type: m.type }];
                return m.type === "textBoxStyle"
                  ? [
                      {
                        type: "textBoxStyle",
                        attrs: {
                          fontFamily: boxFont(m.attrs?.fontFamily),
                          fontSize: boxNumber(m.attrs?.fontSize, 16, 1, 400),
                          color: boxColor(m.attrs?.color, "#000000"),
                        },
                      },
                    ]
                  : [];
              }),
            },
          ];
        });
        const sizes = nodes
          .filter((n) => n.type === "text")
          .map(
            (n) =>
              n.marks?.find((m) => m.type === "textBoxStyle")?.attrs
                ?.fontSize ?? 16,
          );
        return {
          type: "paragraph",
          attrs: {
            fontSize: Math.max(1, ...sizes, ...(sizes.length ? [] : [16])),
            textAlign: ["left", "center", "right", "justify"].includes(
              p.attrs?.textAlign,
            )
              ? p.attrs?.textAlign
              : "left",
            lineHeight: boxNumber(p.attrs?.lineHeight, 1.15, 0.5, 10),
            spaceBefore: boxNumber(p.attrs?.spaceBefore, 0, 0, 1000),
            spaceAfter: boxNumber(p.attrs?.spaceAfter, 0, 0, 1000),
          },
          content: nodes,
        };
      }),
  };
}
export function textBoxPlainText(box: OmiTextBox): string {
  return textBoxDocument(box.content)
    .content!.map((p) =>
      p
        .content!.map((n) => (n.type === "hardBreak" ? "\n" : (n.text ?? "")))
        .join(""),
    )
    .join("\n");
}
function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
export function renderTextBoxContent(box: OmiTextBox): string {
  return textBoxDocument(box.content)
    .content!.map((p) => {
      const text = p
        .content!.map((n) => {
          if (n.type === "hardBreak") return "<br>";
          let html = escape(n.text ?? "");
          for (const m of n.marks ?? []) {
            const tag = (
              {
                bold: "strong",
                italic: "em",
                underline: "u",
                strike: "s",
                omiSuperscript: "sup",
                omiSubscript: "sub",
              } as Record<string, string>
            )[m.type];
            if (tag) html = `<${tag}>${html}</${tag}>`;
            else if (m.type === "omiSmallCaps")
              html = `<span style="font-variant:small-caps">${html}</span>`;
            else if (m.type === "textBoxStyle")
              html = `<span style="${escape(
                Object.entries(textPresentation(m.attrs))
                  .map(([k, v]) => `${k}:${v}`)
                  .join(";"),
              )}">${html}</span>`;
          }
          return html;
        })
        .join("");
      return `<p style="font-size:${p.attrs!.fontSize}px;margin:${p.attrs!.spaceBefore}px 0 ${p.attrs!.spaceAfter}px;text-align:${p.attrs!.textAlign};line-height:${p.attrs!.lineHeight}">${text || "<br>"}</p>`;
    })
    .join("");
}
export function textBoxStyle(box: OmiTextBox): Record<string, string | number> {
  return {
    position: "absolute",
    left: boxNumber(box.x),
    top: boxNumber(box.y),
    width: boxNumber(box.width, 240, 1),
    height: boxNumber(box.height, 90, 1),
    transform: `rotate(${boxNumber(box.rotation)}deg)`,
    transformOrigin: "center",
    background: boxColor(box.background),
    boxSizing: "border-box",
    padding: (box.padding ?? [0, 0, 0, 0])
      .map((v) => `${boxNumber(v, 0, 0, 1000)}px`)
      .join(" "),
    display: "flex",
    flexDirection: "column",
    justifyContent:
      box.verticalAlign === "center"
        ? "center"
        : box.verticalAlign === "bottom"
          ? "flex-end"
          : "flex-start",
    fontFamily: "Times New Roman",
    fontSize: 16,
    lineHeight: 1.15,
    color: "#000000",
    overflow: "visible",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    textAlign: "left",
  };
}
export function renderTextBox(box: OmiTextBox): string {
  const style = Object.entries(textBoxStyle(box))
    .map(
      ([k, v]) =>
        `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${typeof v === "number" && k !== "lineHeight" ? `${v}px` : v}`,
    )
    .join(";");
  return `<div class="omi-text-box" data-omi-text-box-id="${escape(String(box.id))}" style="${escape(style)}">${renderTextBoxContent(box)}</div>`;
}
export function visualTextBoxText(visual: OmiVisualBlockData): string {
  return (
    visual.kind === "text-box"
      ? [visual.textBox]
      : visual.kind === "image"
        ? (visual.textBoxes ?? [])
        : []
  )
    .map(textBoxPlainText)
    .join("\n");
}
export function renderTextBoxGraphic(
  width: number,
  height: number,
  boxes: OmiTextBox[],
  image?: { src: string; alt: string },
): string {
  width = boxNumber(width, 600, 1);
  height = boxNumber(height, 300, 1);
  const content = boxes
    .map(
      (b) =>
        `<g transform="translate(${boxNumber(b.x)} ${boxNumber(b.y)}) rotate(${boxNumber(b.rotation)} ${boxNumber(b.width, 240, 1) / 2} ${boxNumber(b.height, 90, 1) / 2})"><foreignObject width="${boxNumber(b.width, 240, 1)}" height="${boxNumber(b.height, 90, 1)}" overflow="visible"><div xmlns="http://www.w3.org/1999/xhtml">${renderTextBox({ ...b, x: 0, y: 0, rotation: 0 })}</div></foreignObject></g>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" role="group" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="display:block;width:100%;max-width:${width}px;height:auto;overflow:visible">${image ? `<title>${escape(image.alt)}</title><image href="${escape(image.src)}" width="${width}" height="${height}" preserveAspectRatio="none"/>` : ""}${content}</svg>`;
}
