import type { Editor } from '@tiptap/core';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

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
}: RichTextToolbarProps) {
  const copy = getRichTextCopy(locale);
  const { manuscriptLanguages } = useContentLanguagePreferences();
  const [position, setPosition] = useState<ToolbarPosition | null>(null);
  const [revision, setRevision] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');
  const [linkError, setLinkError] = useState(false);
  const [languageDraft, setLanguageDraft] = useState(manuscriptLanguage);
  const [languageError, setLanguageError] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editorDom = editor.view.dom;
    const previousTouchCallout = editorDom.style.getPropertyValue('-webkit-touch-callout');
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let touchStart: { x: number; y: number } | null = null;

    if (isTouchSelectionEnvironment()) {
      editorDom.style.setProperty('-webkit-touch-callout', 'none');
    }

    const closeToolbar = () => {
      setPosition(null);
      setMoreOpen(false);
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

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
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
      if (event.pointerType !== 'touch') return;
      cancelLongPress();
      touchStart = { x: event.clientX, y: event.clientY };
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        const point = touchStart;
        touchStart = null;
        if (!point) return;
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
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault();
        openToolbarAtSelection();
        return;
      }
      if (event.key === 'Escape') closeToolbar();
    };

    const handleDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (toolbarRef.current?.contains(target)) return;
      closeToolbar();
    };

    const handleScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && toolbarRef.current?.contains(target)) return;
      closeToolbar();
    };

    const handleTransaction = () => {
      setRevision((value) => value + 1);
    };

    editor.on('transaction', handleTransaction);
    editorDom.addEventListener('contextmenu', handleContextMenu);
    editorDom.addEventListener('pointerdown', handlePointerDown);
    editorDom.addEventListener('pointermove', handlePointerMove);
    editorDom.addEventListener('pointerup', cancelLongPress);
    editorDom.addEventListener('pointercancel', cancelLongPress);
    editorDom.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handleDocumentPointerDown, true);
    window.addEventListener('resize', closeToolbar);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      cancelLongPress();
      editor.off('transaction', handleTransaction);
      editorDom.removeEventListener('contextmenu', handleContextMenu);
      editorDom.removeEventListener('pointerdown', handlePointerDown);
      editorDom.removeEventListener('pointermove', handlePointerMove);
      editorDom.removeEventListener('pointerup', cancelLongPress);
      editorDom.removeEventListener('pointercancel', cancelLongPress);
      editorDom.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
      window.removeEventListener('resize', closeToolbar);
      window.removeEventListener('scroll', handleScroll, true);
      if (previousTouchCallout) {
        editorDom.style.setProperty('-webkit-touch-callout', previousTouchCallout);
      } else {
        editorDom.style.removeProperty('-webkit-touch-callout');
      }
    };
  }, [editor]);

  const currentLanguage = useMemo(() => {
    void revision;
    const value = editor.getAttributes('omiLanguage').lang;
    return typeof value === 'string' ? value : '';
  }, [editor, revision]);

  const languageOptions = useMemo(() => {
    const normalized = [
      currentLanguage,
      manuscriptLanguage,
      ...manuscriptLanguages,
    ]
      .map((language) => normalizeInlineLanguageTag(language))
      .filter((language): language is string => Boolean(language));

    return [...new Set(normalized)].map((tag) => ({
      tag,
      label: getManuscriptLanguageDisplayName(tag, locale),
    }));
  }, [currentLanguage, locale, manuscriptLanguage, manuscriptLanguages]);

  if (!position) {
    return null;
  }

  const style = {
    left: `${position.left}px`,
    top: `${position.top}px`,
  } as CSSProperties;

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
    setLinkOpen(true);
  }

  function closeExpandedMenu(): void {
    setMoreOpen(false);
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
    setLanguageDraft(manuscriptLanguage);
    setLanguageError(false);
  }

  const expanded = moreOpen || linkOpen;

  return (
    <div
      ref={toolbarRef}
      className={`omi-rich-text-toolbar${
        position.below ? ' omi-rich-text-toolbar--below' : ''
      }${expanded ? ' omi-rich-text-toolbar--expanded' : ''}`}
      style={style}
      role="toolbar"
      aria-label={copy.toolbar}
      data-selection-length={editor.state.selection.to - editor.state.selection.from}
    >
      <div className="omi-rich-text-toolbar-row">
        <ToolbarButton
          label={copy.bold}
          active={editor.isActive('bold')}
          onMouseDown={keepEditorSelection}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          label={copy.italic}
          active={editor.isActive('italic')}
          onMouseDown={keepEditorSelection}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          label={copy.superscript}
          active={editor.isActive('omiSuperscript')}
          onMouseDown={keepEditorSelection}
          onClick={() => toggleMark('omiSuperscript')}
        >
          x²
        </ToolbarButton>
        <ToolbarButton
          label={copy.subscript}
          active={editor.isActive('omiSubscript')}
          onMouseDown={keepEditorSelection}
          onClick={() => toggleMark('omiSubscript')}
        >
          x₂
        </ToolbarButton>
        <ToolbarButton
          label={copy.link}
          active={editor.isActive('omiLink') || linkOpen}
          onMouseDown={keepEditorSelection}
          onClick={openLinkEditor}
        >
          ↗
        </ToolbarButton>
        <ToolbarButton
          label={copy.more}
          active={moreOpen}
          onMouseDown={keepEditorSelection}
          onClick={() => {
            setLinkOpen(false);
            setLanguageDraft(currentLanguage || manuscriptLanguage);
            setLanguageError(false);
            setMoreOpen((value) => !value);
          }}
        >
          ⋯
        </ToolbarButton>
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

      {moreOpen ? (
        <div className="omi-rich-text-popover omi-rich-text-more-menu">
          <div className="omi-rich-text-command-grid">
            <CommandButton
              label={copy.strike}
              active={editor.isActive('strike')}
              onClick={() => editor.chain().focus().toggleStrike().run()}
            />
            <CommandButton
              label={copy.bulletList}
              active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            />
            <CommandButton
              label={copy.orderedList}
              active={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            />
            <CommandButton
              label={copy.blockquote}
              active={editor.isActive('blockquote')}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            />
            <CommandButton
              label={copy.inlineCode}
              active={editor.isActive('code')}
              onClick={() => editor.chain().focus().toggleCode().run()}
            />
            <CommandButton
              label={copy.codeBlock}
              active={editor.isActive('codeBlock')}
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            />
            <CommandButton
              label={copy.hardBreak}
              active={false}
              onClick={() => editor.chain().focus().setHardBreak().run()}
            />
            <CommandButton
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
    </div>
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
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? 'is-active' : ''}
      aria-pressed={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function isTouchSelectionEnvironment(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent ?? '')) return true;
  return navigator.maxTouchPoints > 1 && window.matchMedia('(pointer: coarse)').matches;
}
