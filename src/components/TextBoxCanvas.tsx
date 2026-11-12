import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { EditorContent, useEditor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { useTranslation } from "../i18n";
import { getTextBoxCopy } from "../i18n/textBoxes";
import {
  createTextBox,
  boxColor,
  boxNumber,
  renderTextBoxContent,
  textBoxDocument,
  textBoxPlainText,
  textBoxStyle,
} from "../model/textBoxes";
import type { OmiTextBox } from "../types/omi";
import {
  TextBoxParagraphStyle,
  TextBoxStyle,
} from "../editor/extensions/TextBoxFormatting";
import {
  OmiSuperscriptExtension,
  OmiSubscriptExtension,
  OmiSmallCapsExtension,
  OmiUnderlineExtension,
} from "../editor/extensions/OmiRichTextExtensions";
import { RecentLocalEditorContentHistory } from "../editor/recentLocalEditorContentHistory";

interface Props {
  boxes: OmiTextBox[];
  width: number;
  height: number;
  readOnly: boolean;
  onChange(boxes: OmiTextBox[]): void;
  children?: ReactNode;
  standalone?: boolean;
}
export function TextBoxCanvas({
  boxes,
  width,
  height,
  readOnly,
  onChange,
  children,
  standalone,
}: Props) {
  const { locale } = useTranslation();
  const copy = getTextBoxCopy(locale);
  const [selected, setSelected] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [draft, setDraft] = useState<OmiTextBox | null>(null);
  const drag = useRef<{
    x: number;
    y: number;
    box: OmiTextBox;
    resize: boolean;
    draft?: OmiTextBox;
  } | null>(null);
  width = boxNumber(width, 600, 1);
  height = boxNumber(height, 300, 1);
  useLayoutEffect(() => {
    if (!root.current) return;
    const resize = () =>
      setScale(Math.min(1, (root.current?.clientWidth || width) / width));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [width]);
  useEffect(() => {
    const close = () => setSelected(null);
    window.addEventListener("omi:open-text-box-editor", close);
    return () => window.removeEventListener("omi:open-text-box-editor", close);
  }, []);
  function select(id: string) {
    window.dispatchEvent(new Event("omi:open-text-box-editor"));
    setSelected(id);
  }
  function close() {
    const trigger = Array.from(
      root.current?.querySelectorAll<HTMLElement>("[data-text-box-id]") ?? [],
    )
      .find((e) => e.dataset.textBoxId === selected)
      ?.querySelector<HTMLButtonElement>(".omi-text-box-hit");
    setSelected(null);
    trigger?.focus({ preventScroll: true });
  }
  const active = boxes.find((b) => b.id === selected);
  function update(box: OmiTextBox) {
    onChange(boxes.map((b) => (b.id === box.id ? box : b)));
  }
  function start(
    e: PointerEvent<HTMLButtonElement>,
    box: OmiTextBox,
    resize: boolean,
  ) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelected(box.id);
    drag.current = { x: e.clientX, y: e.clientY, box, resize };
  }
  function move(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const element = root.current?.querySelector(".omi-text-box-stage");
    const s = element ? element.getBoundingClientRect().width / width : scale;
    const dx = (e.clientX - d.x) / s,
      dy = (e.clientY - d.y) / s;
    d.draft = d.resize
      ? {
          ...d.box,
          width: Math.max(16, d.box.width + dx),
          height: Math.max(16, d.box.height + dy),
        }
      : { ...d.box, x: d.box.x + dx, y: d.box.y + dy };
    setDraft(d.draft);
  }
  function finish(cancel = false) {
    const d = drag.current;
    drag.current = null;
    setDraft(null);
    if (!cancel && d?.draft) update(d.draft);
  }
  function keyMove(
    e: React.KeyboardEvent<HTMLButtonElement>,
    box: OmiTextBox,
    resize: boolean,
  ) {
    const delta = (
      {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      } as Record<string, number[]>
    )[e.key];
    if (!delta) return;
    e.preventDefault();
    e.stopPropagation();
    const step = e.shiftKey ? 10 : 1;
    update(
      resize
        ? {
            ...box,
            width: Math.max(16, box.width + delta[0] * step),
            height: Math.max(16, box.height + delta[1] * step),
          }
        : { ...box, x: box.x + delta[0] * step, y: box.y + delta[1] * step },
    );
  }
  return (
    <div
      className="omi-text-box-canvas"
      ref={root}
      onMouseDown={(e) => e.stopPropagation()}
      onDragStart={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div
        className="omi-text-box-viewport"
        style={{ height: height * scale, width: width * scale }}
      >
        <div
          className="omi-text-box-stage"
          style={{
            width,
            height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
          {boxes.map((original) => {
            const box = draft?.id === original.id ? draft : original;
            return (
              <div
                key={box.id}
                className={`omi-text-box${selected === box.id && !readOnly ? " is-selected" : ""}`}
                data-text-box-id={box.id}
                style={textBoxStyle(box)}
              >
                <div
                  className="omi-text-box-rendered"
                  dangerouslySetInnerHTML={{
                    __html: renderTextBoxContent(box),
                  }}
                />
                {!readOnly ? (
                  <>
                    <button
                      className="omi-text-box-hit"
                      type="button"
                      aria-label={`${copy.edit}: ${textBoxPlainText(box).slice(0, 40)}`}
                      onClick={() => select(box.id)}
                    />
                    {selected === box.id ? (
                      <>
                        <button
                          type="button"
                          className="omi-text-box-move"
                          aria-label={copy.move}
                          onPointerDown={(e) => start(e, box, false)}
                          onPointerMove={move}
                          onPointerUp={() => finish()}
                          onPointerCancel={() => finish(true)}
                          onKeyDown={(e) => keyMove(e, box, false)}
                        >
                          ✥
                        </button>
                        <button
                          type="button"
                          className="omi-text-box-resize"
                          aria-label={copy.resize}
                          onPointerDown={(e) => start(e, box, true)}
                          onPointerMove={move}
                          onPointerUp={() => finish()}
                          onPointerCancel={() => finish(true)}
                          onKeyDown={(e) => keyMove(e, box, true)}
                        >
                          ↘
                        </button>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {!readOnly && !standalone ? (
        <button
          type="button"
          className="omi-text-box-add"
          onClick={() => {
            const box = {
              ...createTextBox(),
              x: 10,
              y: 10,
              width: Math.max(16, Math.min(240, width - 10)),
            };
            onChange([...boxes, box]);
            select(box.id);
          }}
        >
          {copy.add}
        </button>
      ) : null}
      {!readOnly && active
        ? createPortal(
            <TextBoxProperties
              key={active.id}
              box={active}
              onChange={update}
              onClose={close}
              onDelete={
                standalone
                  ? undefined
                  : () => {
                      onChange(boxes.filter((b) => b.id !== selected));
                      setSelected(null);
                    }
              }
            />,
            document.body,
          )
        : null}
    </div>
  );
}
/** A separate editor surface prevents the containing manuscript from owning its selection. */
function TextBoxProperties({
  box,
  onChange,
  onClose,
  onDelete,
}: {
  box: OmiTextBox;
  onChange(box: OmiTextBox): void;
  onClose(): void;
  onDelete?: () => void;
}) {
  const { locale } = useTranslation();
  const copy = getTextBoxCopy(locale);
  const latest = useRef({ box, onChange });
  latest.current = { box, onChange };
  const history = useRef(new RecentLocalEditorContentHistory());
  const [, refresh] = useState(0);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: false,
        underline: false,
      }),
      OmiUnderlineExtension,
      OmiSuperscriptExtension,
      OmiSubscriptExtension,
      OmiSmallCapsExtension,
      TextBoxStyle,
      TextBoxParagraphStyle,
    ],
    content: textBoxDocument(box.content),
    editorProps: {
      attributes: {
        class: "omi-text-box-rich-editor",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": copy.text,
        spellcheck: "false",
      },
      handleKeyDown: (view, e) => {
        e.stopPropagation();
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
          e.preventDefault();
          view.focus();
          view.dispatch(
            view.state.tr.setSelection(
              TextSelection.create(
                view.state.doc,
                1,
                view.state.doc.content.size - 1,
              ),
            ),
          );
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => {
      const content = JSON.stringify(
        textBoxDocument(JSON.stringify(e.getJSON())),
      );
      history.current.record(content);
      latest.current.onChange({ ...latest.current.box, content });
    },
    onSelectionUpdate: () => {
      requestAnimationFrame(() => refresh((n) => n + 1));
    },
  });
  useEffect(() => {
    if (!editor) return;
    if (history.current.has(box.content)) {
      history.current.acknowledge(box.content);
      return;
    }
    const incoming = textBoxDocument(box.content);
    if (
      JSON.stringify(incoming) !==
      JSON.stringify(textBoxDocument(JSON.stringify(editor.getJSON())))
    ) {
      const { from, to } = editor.state.selection;
      editor
        .chain()
        .setContent(incoming, { emitUpdate: false })
        .setTextSelection({ from, to })
        .run();
    }
  }, [box.content, editor]);
  const attrs = editor?.getAttributes("textBoxStyle") ?? {};
  function format(next: Record<string, unknown>) {
    const chain = editor?.chain().setMark("textBoxStyle", next);
    if (next.fontSize)
      chain?.updateAttributes("paragraph", { fontSize: next.fontSize });
    chain?.run();
  }
  return (
    <section
      className="omi-text-box-properties"
      role="dialog"
      aria-label={copy.edit}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        e.stopPropagation();
      }}
    >
      <header>
        <strong>{copy.edit}</strong>
        <button type="button" aria-label={copy.close} onClick={onClose}>
          ×
        </button>
      </header>
      <div className="omi-text-box-toolbar">
        {(
          ["bold", "italic", "underline", "superscript", "subscript"] as const
        ).map((k) => {
          const mark =
            k === "superscript"
              ? "omiSuperscript"
              : k === "subscript"
                ? "omiSubscript"
                : k;
          return (
            <button
              type="button"
              key={k}
              aria-pressed={editor?.isActive(mark) ?? false}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor?.chain().focus().toggleMark(mark).run()}
            >
              {copy[k]}
            </button>
          );
        })}
        <label>
          {copy.font}
          <input
            value={attrs.fontFamily ?? ""}
            placeholder="Times New Roman"
            onChange={(e) => format({ fontFamily: e.target.value })}
          />
        </label>
        <label>
          {copy.size}
          <input
            type="number"
            min="1"
            max="300"
            step="0.5"
            value={attrs.fontSize ? Math.round(attrs.fontSize * 75) / 100 : ""}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n > 0) format({ fontSize: (n * 4) / 3 });
            }}
          />
        </label>
        <label>
          {copy.color}
          <input
            type="color"
            value={boxColor(attrs.color, "#000000")}
            onChange={(e) => format({ color: e.target.value })}
          />
        </label>
        <label>
          {copy.align}
          <select
            value={editor?.getAttributes("paragraph").textAlign ?? "left"}
            onChange={(e) =>
              editor
                ?.chain()
                .updateAttributes("paragraph", { textAlign: e.target.value })
                .run()
            }
          >
            {(["left", "center", "right"] as const).map((a) => (
              <option key={a} value={a}>
                {copy[a]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <EditorContent editor={editor} />
      <div className="omi-text-box-geometry">
        {(["x", "y", "width", "height", "rotation"] as const).map((k) => (
          <label key={k}>
            {k === "x" || k === "y" ? k.toUpperCase() + " (px)" : copy[k]}
            <input
              type="number"
              step="1"
              min={k === "width" || k === "height" ? 1 : undefined}
              value={Math.round(box[k] ?? 0)}
              onChange={(e) =>
                onChange({
                  ...box,
                  [k]: boxNumber(
                    Number(e.target.value),
                    box[k],
                    k === "width" || k === "height" ? 1 : -100000,
                  ),
                })
              }
            />
          </label>
        ))}
        <label>
          {copy.padding}
          <input
            type="number"
            min="0"
            value={box.padding?.[0] ?? 0}
            onChange={(e) => {
              const n = boxNumber(Number(e.target.value), 0, 0, 1000);
              onChange({ ...box, padding: [n, n, n, n] });
            }}
          />
        </label>
        <label>
          {copy.background}
          <input
            type="color"
            value={boxColor(box.background, "#ffffff")}
            onChange={(e) => onChange({ ...box, background: e.target.value })}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={!box.background || box.background === "transparent"}
            onChange={(e) =>
              onChange({
                ...box,
                background: e.target.checked ? undefined : "#ffffff",
              })
            }
          />
          {copy.transparent}
        </label>
        {onDelete ? (
          <button type="button" onClick={onDelete}>
            {copy.remove}
          </button>
        ) : null}
      </div>
    </section>
  );
}
