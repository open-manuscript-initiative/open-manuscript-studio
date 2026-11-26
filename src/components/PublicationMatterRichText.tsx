import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { generateHTML } from '@tiptap/core';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { OMI_CONTINUOUS_RICH_TEXT_EXTENSIONS } from '../editor/extensions/OmiRichTextExtensions';
import { useFormattingEditor } from '../editor/useFormattingEditor';
import { getPublicationMatterCopy } from '../i18n/publicationMatter';
import { getRichTextCopy } from '../i18n/richText';
import { useTranslation } from '../i18n';
import { getPublicationShortcodeHelp } from '../i18n/helpPublicationShortcodes';

const extensions = () => [StarterKit.configure({ horizontalRule: false, link: false, underline: false }),
  ...OMI_CONTINUOUS_RICH_TEXT_EXTENSIONS.filter((extension) => extension.name !== 'omiBlockTypeMenu')];
export function matterPreviewHtml(content: string): string { return generateHTML(JSON.parse(content), extensions()); }

export function MatterRichText({ content, onChange, readOnly, toolbarHost, label }: {
  content: string; onChange(content: string): void; readOnly: boolean; toolbarHost: HTMLElement | null; label?: string;
}) {
  const { locale } = useTranslation();
  const copy = getPublicationMatterCopy(locale);
  const format = getRichTextCopy(locale);
  const change = useRef(onChange); change.current = onChange;
  const editor = useEditor({ editable: !readOnly, extensions: extensions(),
    content: JSON.parse(content), editorProps: { attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': label ?? copy.content } },
    onUpdate: ({ editor: current }) => change.current(JSON.stringify(current.getJSON())),
  });
  useFormattingEditor(editor);
  const marks = ['bold', 'italic', 'omiUnderline', 'omiSmallCaps', 'omiSuperscript', 'omiSubscript'];
  const active = useEditorState({ editor, selector: ({ editor: current }) => marks.map((mark) => current?.isActive(mark) ?? false) });
  useEffect(() => { editor?.setEditable(!readOnly); }, [editor, readOnly]);
  useEffect(() => {
    if (!editor) return;
    const next = editor.schema.nodeFromJSON(JSON.parse(content)).toJSON();
    if (JSON.stringify(next) === JSON.stringify(editor.getJSON())) return;
    const { from, to } = editor.state.selection;
    editor.commands.setContent(next, { emitUpdate: false });
    const max = editor.state.doc.content.size;
    editor.commands.setTextSelection({ from: Math.min(from, max), to: Math.min(to, max) });
  }, [editor, content]);
  const shortcodeHelp = getPublicationShortcodeHelp(locale);
  const shortcodeLabel = shortcodeHelp.insert;
  const toolbar = editor && !readOnly ? <div className="omi-publication-matter-format" role="group" aria-label={format.toolbar}>
    {[format.bold, format.italic, format.underline, format.smallCaps, format.superscript, format.subscript].map((label, index) => <button type="button" key={label} title={label} aria-label={label} aria-pressed={active?.[index] ?? false}
      onMouseDown={(event) => event.preventDefault()} onClick={() => editor.chain().focus().toggleMark(marks[index]!).run()}>{['B', 'I', 'U', 'Aa', 'x²', 'x₂'][index]}</button>)}
    <select aria-label={shortcodeLabel} value="" onChange={(event) => {
      const key = event.target.value;
      if (key) editor.chain().focus().insertContent('[omi:' + key + ']').run();
    }}>
      <option value="">{shortcodeLabel}</option>
      {shortcodeHelp.fields.map(({ key, label }) => <option key={key} value={key}>{label + ' — [omi:' + key + ']'}</option>)}
    </select>
  </div> : null;
  return <>{toolbarHost ? createPortal(toolbar, toolbarHost) : null}<EditorContent editor={editor} /></>;
}
