import { Extension, Mark } from "@tiptap/core";
import {
  boxColor,
  boxFont,
  boxNumber,
  textPresentation,
} from "../../model/textBoxes";
export const TextBoxStyle = Mark.create({
  name: "textBoxStyle",
  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: (e) =>
          e.style.fontFamily
            ? boxFont(e.style.fontFamily.replace(/["']/g, ""))
            : null,
      },
      fontSize: {
        default: null,
        parseHTML: (e) => {
          const n = parseFloat(e.style.fontSize);
          return n > 0
            ? boxNumber(
                n * (e.style.fontSize.endsWith("pt") ? 4 / 3 : 1),
                16,
                1,
                400,
              )
            : null;
        },
      },
      color: {
        default: null,
        parseHTML: (e) => {
          const rgb = e.style.color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
          return rgb
            ? "#" +
                rgb
                  .slice(1)
                  .map((v) => Number(v).toString(16).padStart(2, "0"))
                  .join("")
            : e.style.color
              ? boxColor(e.style.color, "#000000")
              : null;
        },
      },
    };
  },
  parseHTML() {
    return [
      { tag: "span", getAttrs: (e) => (e.hasAttribute("style") ? {} : false) },
    ];
  },
  renderHTML({ mark }) {
    return [
      "span",
      {
        style: Object.entries(textPresentation(mark.attrs))
          .map(([k, v]) => `${k}:${v}`)
          .join(";"),
      },
      0,
    ];
  },
});
export const TextBoxParagraphStyle = Extension.create({
  name: "textBoxParagraphStyle",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          fontSize: {
            default: 16,
            renderHTML: (a) => ({
              style: `font-size:${boxNumber(a.fontSize, 16, 1, 400)}px`,
            }),
          },
          textAlign: {
            default: "left",
            parseHTML: (e) =>
              ["left", "center", "right", "justify"].includes(e.style.textAlign)
                ? e.style.textAlign
                : "left",
            renderHTML: (a) => ({
              style: `text-align:${["left", "center", "right", "justify"].includes(a.textAlign) ? a.textAlign : "left"}`,
            }),
          },
          lineHeight: {
            default: 1.15,
            renderHTML: (a) => ({
              style: `line-height:${boxNumber(a.lineHeight, 1.15, 0.5, 10)}`,
            }),
          },
          spaceBefore: {
            default: 0,
            renderHTML: (a) => ({
              style: `margin-top:${boxNumber(a.spaceBefore, 0, 0, 1000)}px`,
            }),
          },
          spaceAfter: {
            default: 0,
            renderHTML: (a) => ({
              style: `margin-bottom:${boxNumber(a.spaceAfter, 0, 0, 1000)}px`,
            }),
          },
        },
      },
    ];
  },
});
