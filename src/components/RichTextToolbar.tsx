import type { Editor } from '@tiptap/core';
import { Bold, Italic, Underline, Superscript, Subscript, Link, Ellipsis, SlidersHorizontal, Pilcrow, Code, CodeXml, CornerDownLeft, Eraser, Grip, List, ListOrdered, MoveDiagonal2, Pin, PinOff, Quote, RotateCcw, Strikethrough } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { DirectFormattingPanel, directFormattingLabel, ParagraphFormattingPanel, paragraphFormattingLabel } from './DirectFormattingPanel';
import { useSelectionToolbarLayout } from './useSelectionToolbarLayout';
import { useFormattingStore } from '../editor/useFormattingEditor';

import { getRichTextCopy } from '../i18n/richText';
import type { SupportedLocale } from '../i18n/types';
import { useContentLanguagePreferences } from '../languages/languagePreferences';
import { getManuscriptLanguageDisplayName } from '../model/manuscriptLanguage';
import {
  normalizeExternalHref,
  normalizeInlineLanguageTag,
} from '../model/richText';

interface RichTextToolbarProps {
  editor: Editor;
  locale: SupportedLocale;
  manuscriptLanguage: string;
  children?: ReactNode;
  placement?: 'floating' | 'header';
  renderActions?: () => ReactNode;
}

interface ToolbarPosition {
  left: number;
  top: number;
  below: boolean;
}

const SPECIAL_CHARACTERS: ReadonlyArray<{
  label: string;
  value: string;
}> = [
  { label: '–', value: '–' },
  { label: '—', value: '—' },
  { label: '…', value: '…' },
  { label: 'NBSP', value: '\u00a0' },
  { label: '§', value: '§' },
  { label: '¶', value: '¶' },
  { label: '†', value: '†' },
  { label: '‡', value: '‡' },
  { label: '°', value: '°' },
  { label: '±', value: '±' },
  { label: '×', value: '×' },
  { label: '÷', value: '÷' },
  { label: '≈', value: '≈' },
  { label: '≠', value: '≠' },
  { label: '≤', value: '≤' },
  { label: '≥', value: '≥' },
  { label: '→', value: '→' },
  { label: '←', value: '←' },
  { label: 'α', value: 'α' },
  { label: 'β', value: 'β' },
  { label: 'γ', value: 'γ' },
  { label: 'δ', value: 'δ' },
  { label: 'μ', value: 'μ' },
  { label: 'π', value: 'π' },
  { label: 'Ω', value: 'Ω' },
];

const TOUCH_LONG_PRESS_DELAY = 650;
const TOUCH_MOVE_TOLERANCE = 12;

export function RichTextToolbar({
  editor,
  locale,
  manuscriptLanguage,
  children,
  placement = 'floating',
  renderActions,
}: RichTextToolbarProps) {
  const headerOpen = useFormattingStore((state) => state.open);
  const inHeader = placement === 'header';
  const copy = getRichTextCopy(locale);
  const { manuscriptLanguages } = useContentLanguagePreferences();
  const [position, setPosition] = useState<ToolbarPosition | null>(null);
  const [revision, setRevision] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [directOpen, setDirectOpen] = useState(false);
  const [paragraphOpen, setParagraphOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const [linkError, setLinkError] = useState(false);
  const defaultLanguage = normalizeInlineLanguageTag(manuscriptLanguage) ?? 'en';
  const [languageDraft, setLanguageDraft] = useState(defaultLanguage);
  const [languageError, setLanguageError] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const floating = useSelectionToolbarLayout(
    toolbarRef, position, `${editor.state.selection.from}:${editor.state.selection.to}`,
  );
  const { interactionRef } = floating;

  useEffect(() => {
    if (inHeader) {
      const update = () => setRevision((value) => value + 1);
      editor.on('transaction', update);
      return () => { editor.off('transaction', update); };
    }
    if (headerOpen) {
      setPosition(null);
      return;
    }
    const editorDom = editor.view.dom;
    const previousTouchCallout = editorDom.style.getPropertyValue('-webkit-touch-callout');
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let touchStart: { x: number; y: number } | null = null;
    let selectionTimer: ReturnType<typeof setTimeout> | null = null;
    let selecting = false;
    let dismissedSelection: string | null = null;
    let explicitMenu = false;
    const selectionKey = () => `${editor.state.selection.from}:${editor.state.selection.to}`;
    const toolbarHasFocus = () => Boolean(toolbarRef.current?.contains(document.activeElement));

    if (isTouchSelectionEnvironment()) {
      editorDom.style.setProperty('-webkit-touch-callout', 'none');
    }

    const closeToolbar = () => {
      setPosition(null);
      setMoreOpen(false);
    setDirectOpen(false);
    setParagraphOpen(false);
      setLinkOpen(false);
      setLinkError(false);
      setLanguageError(false);
    };

    const openToolbarAt = (left: number, top: number) => {
      const below = top < 110;
      setPosition({
        left: Math.max(16, Math.min(window.innerWidth - 16, left)),
        top: below ? top + 10 : top - 10,
        below,
      });
      setRevision((value) => value + 1);
    };

    const openToolbarAtSelection = () => {
      try {
        const { from, to } = editor.state.selection;
        const start = editor.view.coordsAtPos(from);
        const end = editor.view.coordsAtPos(to);
        openToolbarAt(
          (start.left + end.right) / 2,
          Math.min(start.top, end.top) < 110
            ? Math.max(start.bottom, end.bottom)
            : Math.min(start.top, end.top),
        );
      } catch {
        closeToolbar();
      }
    };

    // Native touch selection can settle after pointerup/pointercancel. Wait for
    // both DOM selection and ProseMirror state, and never open another editor's menu.
    const syncSelectionToolbar = () => {
      selectionTimer = null;
      if (editor.isDestroyed || selecting || toolbarHasFocus() || interactionRef.current) return;
      const selection = editorDom.ownerDocument.getSelection();
      const ownsSelection = Boolean(selection?.anchorNode && selection.focusNode
        && editorDom.contains(selection.anchorNode) && editorDom.contains(selection.focusNode));
      if (!ownsSelection || selection?.isCollapsed || editor.state.selection.empty) {
        if (!explicitMenu) closeToolbar();
        return;
      }
      if (dismissedSelection === selectionKey()) return;
      explicitMenu = false;
      openToolbarAtSelection();
    };
    const scheduleSelectionToolbar = () => {
      if (selectionTimer !== null) clearTimeout(selectionTimer);
      selectionTimer = setTimeout(syncSelectionToolbar, 100);
    };
    const handleSelectionUpdate = () => {
      if (dismissedSelection !== selectionKey()) dismissedSelection = null;
      explicitMenu = false;
      scheduleSelectionToolbar();
    };
    const handlePointerEnd = () => {
      cancelLongPress();
      selecting = false;
      scheduleSelectionToolbar();
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      explicitMenu = true;
      dismissedSelection = null;
      openToolbarAt(event.clientX, event.clientY);
    };

    const cancelLongPress = () => {
      if (longPressTimer !== null) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      touchStart = null;
    };

    const handlePointerDown = (event: PointerEvent) => {
      selecting = true;
      dismissedSelection = null;
      if (event.pointerType !== 'touch') return;
      cancelLongPress();
      touchStart = { x: event.clientX, y: event.clientY };
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        const point = touchStart;
        touchStart = null;
        if (!point) return;
        explicitMenu = true;
        openToolbarAt(point.x, point.y);
      }, TOUCH_LONG_PRESS_DELAY);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!touchStart) return;
      if (
        Math.abs(event.clientX - touchStart.x) > TOUCH_MOVE_TOLERANCE
        || Math.abs(event.clientY - touchStart.y) > TOUCH_MOVE_TOLERANCE
      ) {
        cancelLongPress();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // A navigation key starts a new selection interaction even if the
      // browser coalesces its selectionchange with a subsequent re-selection
      // of the same range that Escape dismissed.
      if (/^(Arrow(Left|Right|Up|Down)|Home|End|PageUp|PageDown)$/.test(event.key)) {
        dismissedSelection = null;
      }
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault();
        explicitMenu = true;
        dismissedSelection = null;
        openToolbarAtSelection();
        return;
      }
      if (event.key === 'Escape') {
        dismissedSelection = selectionKey();
        explicitMenu = false;
        closeToolbar();
      }
    };

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (toolbarRef.current?.contains(target)) return;
      dismissedSelection = editorDom.contains(target) ? null : selectionKey();
      explicitMenu = false;
      closeToolbar();
    };

    const handleScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && toolbarRef.current?.contains(target)) return;
      if (toolbarHasFocus()) return;
      if (editor.state.selection.empty) closeToolbar();
      else scheduleSelectionToolbar();
    };

    const handleTransaction = () => {
      setRevision((value) => value + 1);
    };

    editor.on('transaction', handleTransaction);
    editor.on('selectionUpdate', handleSelectionUpdate);
    document.addEventListener('selectionchange', scheduleSelectionToolbar);
    document.addEventListener('pointerup', handlePointerEnd);
    document.addEventListener('pointercancel', handlePointerEnd);
    editorDom.addEventListener('touchend', handlePointerEnd);
    editorDom.addEventListener('contextmenu', handleContextMenu);
    editorDom.addEventListener('pointerdown', handlePointerDown);
    editorDom.addEventListener('pointermove', handlePointerMove);
    editorDom.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleDocumentPointerDown, true);
    window.addEventListener('resize', handleScroll);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      cancelLongPress();
      if (selectionTimer !== null) clearTimeout(selectionTimer);
      editor.off('selectionUpdate', handleSelectionUpdate);
      document.removeEventListener('selectionchange', scheduleSelectionToolbar);
      document.removeEventListener('pointerup', handlePointerEnd);
      document.removeEventListener('pointercancel', handlePointerEnd);
      editorDom.removeEventListener('touchend', handlePointerEnd);
      editor.off('transaction', handleTransaction);
      editorDom.removeEventListener('contextmenu', handleContextMenu);
      editorDom.removeEventListener('pointerdown', handlePointerDown);
      editorDom.removeEventListener('pointermove', handlePointerMove);
      editorDom.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('scroll', handleScroll, true);
      if (previousTouchCallout) {
        editorDom.style.setProperty('-webkit-touch-callout', previousTouchCallout);
      } else {
        editorDom.style.removeProperty('-webkit-touch-callout');
      }
    };
  }, [editor, interactionRef, inHeader, headerOpen]);

  const currentLanguage = useMemo(() => {
    void revision;
    const value = editor.getAttributes('omiLanguage').lang;
    return typeof value === 'string' ? normalizeInlineLanguageTag(value) ?? '' : '';
  }, [editor, revision]);

  const languageOptions = useMemo(() => {
    const normalized = [
      currentLanguage,
      defaultLanguage,
      ...manuscriptLanguages,
    ]
      .map((language) => normalizeInlineLanguageTag(language))
      .filter((language): language is string => Boolean(language));

    return [...new Set(normalized)].map((tag) => ({
      tag,
      label: getManuscriptLanguageDisplayName(tag, locale),
    }));
  }, [currentLanguage, locale, defaultLanguage, manuscriptLanguages]);

  if ((!inHeader && (!position || headerOpen)) || editor.isDestroyed) {
    return null;
  }

  function keepEditorSelection(event: React.MouseEvent<HTMLButtonElement>): void {
    event.preventDefault();
  }

  function toggleMark(mark: 'omiSuperscript' | 'omiSubscript'): void {
    const other = mark === 'omiSuperscript' ? 'omiSubscript' : 'omiSuperscript';
    const chain = editor.chain().focus().unsetMark(other);

    if (editor.isActive(mark)) {
      chain.unsetMark(mark).run();
    } else {
      chain.setMark(mark).run();
    }
  }

  function openLinkEditor(): void {
    const href = editor.getAttributes('omiLink').href;
    setLinkDraft(typeof href === 'string' ? href : '');
    setLinkError(false);
    setMoreOpen(false);
    setDirectOpen(false);
    setParagraphOpen(false);
    setLinkOpen(true);
  }

  function closeExpandedMenu(): void {
    setMoreOpen(false);
    setDirectOpen(false);
    setParagraphOpen(false);
    setLinkOpen(false);
    setLinkError(false);
    setLanguageError(false);
    editor.commands.focus();
  }

  function applyLink(): void {
    const href = normalizeExternalHref(linkDraft);
    if (!href) {
      setLinkError(true);
      return;
    }

    if (editor.isActive('omiLink')) {
      editor
        .chain()
        .focus()
        .extendMarkRange('omiLink')
        .setMark('omiLink', { href })
        .run();
    } else {
      editor.chain().focus().setMark('omiLink', { href }).run();
    }

    setLinkOpen(false);
    setLinkError(false);
  }

  function removeLink(): void {
    editor
      .chain()
      .focus()
      .extendMarkRange('omiLink')
      .unsetMark('omiLink')
      .run();
    setLinkOpen(false);
  }

  function applyLanguage(): void {
    const lang = normalizeInlineLanguageTag(languageDraft);
    if (!lang) {
      setLanguageError(true);
      return;
    }

    editor.chain().focus().setMark('omiLanguage', { lang }).run();
    setLanguageDraft(lang);
    setLanguageError(false);
  }

  function removeLanguage(): void {
    editor.chain().focus().unsetMark('omiLanguage').run();
    setLanguageDraft(defaultLanguage);
    setLanguageError(false);
  }

  const expanded = moreOpen || linkOpen || directOpen || paragraphOpen;

  const toolbar = (
    <div
      ref={toolbarRef}
      className={`omi-rich-text-toolbar${
        position?.below && !inHeader ? ' omi-rich-text-toolbar--below' : ''
      }${expanded ? ' omi-rich-text-toolbar--expanded' : ''}${inHeader ? ' omi-rich-text-toolbar--header' : ''}`}
      style={inHeader ? undefined : floating.style}
      role="toolbar"
      aria-label={copy.toolbar}
      data-selection-length={editor.state.selection.to - editor.state.selection.from}
      data-pinned={floating.desktop && floating.pinned}
    >
      {floating.desktop && !inHeader ? (
        <div className="omi-rich-text-toolbar-placement">
          <button
            type="button"
            className="omi-rich-text-toolbar-move"
            aria-label={copy.moveToolbar}
            title={copy.moveToolbar}
            {...floating.moveHandle}
          >
            <Grip size={14} aria-hidden="true" />
            <span>{copy.toolbar}</span>
          </button>
          <button
            type="button"
            aria-label={copy.pinToolbar}
            title={floating.pinned ? copy.unpinToolbar : copy.pinToolbar}
            aria-pressed={floating.pinned}
            onMouseDown={keepEditorSelection}
            onClick={floating.togglePin}
          >
            {floating.pinned ? <PinOff size={14} aria-hidden="true" /> : <Pin size={14} aria-hidden="true" />}
          </button>
          <button
            type="button"
            aria-label={copy.resetToolbar}
            title={copy.resetToolbar}
            onMouseDown={keepEditorSelection}
            onClick={floating.reset}
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <div className="omi-rich-text-toolbar-row">
        <ToolbarButton
          label={copy.bold}
          active={editor.isActive('bold')}
          onMouseDown={keepEditorSelection}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={17} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label={copy.italic}
          active={editor.isActive('italic')}
          onMouseDown={keepEditorSelection}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={17} aria-hidden="true" />
        </ToolbarButton>
        <>
          <ToolbarButton label={copy.underline} active={editor.isActive('omiUnderline')}
            onMouseDown={keepEditorSelection}
            onClick={() => editor.chain().focus().toggleMark('omiUnderline').run()}><Underline size={17} aria-hidden="true" /></ToolbarButton>
          <ToolbarButton label={copy.strike} active={editor.isActive('strike')}
            onMouseDown={keepEditorSelection}
            onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough size={17} aria-hidden="true" /></ToolbarButton>
          <ToolbarButton label={copy.smallCaps} active={editor.isActive('omiSmallCaps')}
            onMouseDown={keepEditorSelection}
            onClick={() => editor.chain().focus().toggleMark('omiSmallCaps').run()}><span style={{ fontVariant: 'small-caps' }}>Aa</span></ToolbarButton>
        </>
        <ToolbarButton
          label={copy.superscript}
          active={editor.isActive('omiSuperscript')}
          onMouseDown={keepEditorSelection}
          onClick={() => toggleMark('omiSuperscript')}
        >
          <Superscript size={17} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label={copy.subscript}
          active={editor.isActive('omiSubscript')}
          onMouseDown={keepEditorSelection}
          onClick={() => toggleMark('omiSubscript')}
        >
          <Subscript size={17} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label={copy.link}
          active={editor.isActive('omiLink') || linkOpen}
          onMouseDown={keepEditorSelection}
          onClick={openLinkEditor}
        >
          <Link size={17} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          label={copy.more}
          active={moreOpen}
          onMouseDown={keepEditorSelection}
          onClick={() => {
            setLinkOpen(false);
            setDirectOpen(false);
            setParagraphOpen(false);
            setLanguageDraft(currentLanguage || defaultLanguage);
            setLanguageError(false);
            setMoreOpen((value) => !value);
          }}
        >
          <Ellipsis size={17} aria-hidden="true" />
        </ToolbarButton>
        {editor.schema.marks.omiFontSize ? <ToolbarButton
          label={directFormattingLabel(locale)}
          active={directOpen}
          onMouseDown={keepEditorSelection}
          onClick={() => {
            setLinkOpen(false);
            setMoreOpen(false);
            setParagraphOpen(false);
            setDirectOpen(value => !value);
          }}
        ><SlidersHorizontal size={17} aria-hidden="true" /></ToolbarButton> : null}
        {editor.schema.nodes.paragraph?.spec.attrs?.omiAlign ? <ToolbarButton
          label={paragraphFormattingLabel(locale)}
          active={paragraphOpen}
          onMouseDown={keepEditorSelection}
          onClick={() => {
            setLinkOpen(false);
            setMoreOpen(false);
            setDirectOpen(false);
            setParagraphOpen(value => !value);
          }}
        ><Pilcrow size={17} aria-hidden="true" /></ToolbarButton> : null}
        {expanded ? (
          <button
            type="button"
            className="omi-rich-text-toolbar-dismiss"
            aria-label={copy.cancel}
            title={copy.cancel}
            onMouseDown={keepEditorSelection}
            onClick={closeExpandedMenu}
          >
            ×
          </button>
        ) : null}
      </div>

      {children}
      {renderActions?.()}

      {linkOpen ? (
        <div className="omi-rich-text-popover omi-rich-text-link-editor">
          <label>
            <span>{copy.linkAddress}</span>
            <input
              autoFocus
              type="url"
              value={linkDraft}
              placeholder={copy.linkPlaceholder}
              aria-invalid={linkError}
              onChange={(event) => {
                setLinkDraft(event.target.value);
                setLinkError(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applyLink();
                }
                if (event.key === 'Escape') {
                  closeExpandedMenu();
                }
              }}
            />
          </label>
          {linkError ? <small className="field-error">{copy.invalidLink}</small> : null}
          <div className="omi-rich-text-popover-actions">
            {editor.isActive('omiLink') ? (
              <button type="button" onClick={removeLink}>{copy.unlink}</button>
            ) : null}
            <button type="button" onClick={closeExpandedMenu}>{copy.cancel}</button>
            <button type="button" className="primary" onClick={applyLink}>{copy.apply}</button>
          </div>
        </div>
      ) : null}

      {directOpen ? <DirectFormattingPanel editor={editor} locale={locale} /> : null}
      {paragraphOpen ? <ParagraphFormattingPanel editor={editor} locale={locale} /> : null}

      {moreOpen ? (
        <div className="omi-rich-text-popover omi-rich-text-more-menu">
          <div className="omi-rich-text-command-grid">
            <CommandButton
              icon={<Strikethrough size={17} aria-hidden="true" />}
              label={copy.strike}
              active={editor.isActive('strike')}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            />
            <CommandButton
              icon={<List size={17} aria-hidden="true" />}
              label={copy.bulletList}
              active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            />
            <CommandButton
              icon={<ListOrdered size={17} aria-hidden="true" />}
              label={copy.orderedList}
              active={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            />
            <CommandButton
              icon={<Quote size={17} aria-hidden="true" />}
              label={copy.blockquote}
              active={editor.isActive('blockquote')}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            />
            <CommandButton
              icon={<Code size={17} aria-hidden="true" />}
              label={copy.inlineCode}
              active={editor.isActive('code')}
              onClick={() => editor.chain().focus().toggleCode().run()}
            />
            <CommandButton
              icon={<CodeXml size={17} aria-hidden="true" />}
              label={copy.codeBlock}
              active={editor.isActive('codeBlock')}
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            />
            <CommandButton
              icon={<CornerDownLeft size={17} aria-hidden="true" />}
              label={copy.hardBreak}
              active={false}
              onClick={() => editor.chain().focus().setHardBreak().run()}
            />
            <CommandButton
              icon={<Eraser size={17} aria-hidden="true" />}
              label={copy.clearMarks}
              active={false}
              onClick={() => editor.chain().focus().unsetAllMarks().run()}
            />
          </div>

          <div className="omi-rich-text-language-editor">
            <label>
              <span>{copy.language}</span>
              <select
                value={languageDraft}
                aria-invalid={languageError}
                onChange={(event) => {
                  setLanguageDraft(event.target.value);
                  setLanguageError(false);
                }}
              >
                {languageOptions.map((option) => (
                  <option value={option.tag} key={option.tag}>
                    {option.label} — {option.tag}
                  </option>
                ))}
              </select>
            </label>
            <div className="omi-rich-text-inline-actions">
              {currentLanguage ? (
                <button type="button" onClick={removeLanguage}>{copy.removeLanguage}</button>
              ) : null}
              <button type="button" onClick={applyLanguage}>{copy.apply}</button>
            </div>
          </div>

          <div className="omi-rich-text-symbols" aria-label={copy.specialCharacters}>
            <strong>{copy.specialCharacters}</strong>
            <div className="omi-rich-text-symbol-grid">
              {SPECIAL_CHARACTERS.map((character) => (
                <button
                  key={character.label}
                  type="button"
                  title={character.label}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => editor.chain().focus().insertContent(character.value).run()}
                >
                  {character.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {floating.desktop && !inHeader ? (
        <div className="omi-rich-text-toolbar-resize-row">
          <button
            type="button"
            className="omi-rich-text-toolbar-resize"
            aria-label={copy.resizeToolbar}
            title={copy.resizeToolbar}
            {...floating.resizeHandle}
          >
            <MoveDiagonal2 size={14} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
  if (inHeader) return toolbar;
  return createPortal(toolbar,
    // Keep the panel in the active modal's accessibility/focus scope, outside
    // the zoomed publication canvas that otherwise changes fixed coordinates.
    editor.view.dom.closest('[role="dialog"], dialog') ?? document.body,
  );
}

interface ToolbarButtonProps {
  label: string;
  active: boolean;
  children: React.ReactNode;
  onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onClick: () => void;
}

function ToolbarButton({
  label,
  active,
  children,
  onMouseDown,
  onClick,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={active ? 'is-active' : ''}
      aria-pressed={active}
      aria-label={label}
      title={label}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function CommandButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? 'is-active' : ''}
      aria-pressed={active}
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function isTouchSelectionEnvironment(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent ?? '')) return true;
  return navigator.maxTouchPoints > 1 && window.matchMedia('(pointer: coarse)').matches;
}
