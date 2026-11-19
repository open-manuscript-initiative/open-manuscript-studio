import { BookOpen, CaseSensitive, Pin, PinOff } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useFormattingStore } from '../editor/useFormattingEditor';
import { useTranslation } from '../i18n';
import { getNoteCitationCopy } from '../i18n/noteCitations';
import { getRichTextCopy } from '../i18n/richText';
import { RichTextToolbar } from './RichTextToolbar';

export function HeaderFormattingButton({ className = 'focus-menu-button' }: { className?: string }) {
  const { locale } = useTranslation();
  const open = useFormattingStore((state) => state.open);
  const pinned = useFormattingStore((state) => state.pinned);
  const label = getRichTextCopy(locale).toolbar;
  useEffect(() => {
    const restoreDesktopPin = () => {
      if (pinned && window.innerWidth > 760) useFormattingStore.setState({ open: true });
    };
    restoreDesktopPin();
    window.addEventListener('resize', restoreDesktopPin);
    return () => window.removeEventListener('resize', restoreDesktopPin);
  }, [pinned]);
  return <button type="button"
    className={`${className} focus-formatting-button${open ? ' is-active' : ''}`}
    data-editor-formatting-controls="true"
    aria-label={label} title={label}
    aria-expanded={open} aria-controls="omi-header-formatting"
    onMouseDown={(event) => event.preventDefault()}
    onClick={() => useFormattingStore.setState({ open: !open, ...(open && window.innerWidth > 760 ? { pinned: false } : {}) })}>
    <CaseSensitive size={19} aria-hidden="true" />
  </button>;
}

export function HeaderFormattingPanel({ manuscriptLanguage }: { manuscriptLanguage: string }) {
  const { locale } = useTranslation();
  const target = useFormattingStore((state) => state.target);
  const pinned = useFormattingStore((state) => state.pinned);
  const copy = getNoteCitationCopy(locale);
  const richCopy = getRichTextCopy(locale);
  const hint = locale === 'hu'
    ? 'Kattintson a főszövegbe vagy egy jegyzetbe a formázáshoz.'
    : locale === 'de'
      ? 'Zum Formatieren in den Haupttext oder eine Anmerkung klicken.'
      : 'Click in the main text or a note to format it.';

  const panel = (
    <div id="omi-header-formatting" className="focus-header-formatting" data-editor-formatting-controls="true" data-pinned={pinned}>
      <div className="focus-header-formatting__placement">
        <button type="button" aria-label={richCopy.pinToolbar}
          title={pinned ? richCopy.unpinToolbar : richCopy.pinToolbar}
          aria-pressed={pinned}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => useFormattingStore.setState({ pinned: !pinned, open: true })}>
          {pinned ? <PinOff size={16} aria-hidden="true" /> : <Pin size={16} aria-hidden="true" />}
          {richCopy.pinToolbar}
        </button>
      </div>
      {target && !target.editor.isDestroyed && target.editor.isEditable ? (
        <RichTextToolbar key={`${target.editor.instanceId}:${target.noteId ?? ''}`}
          editor={target.editor} locale={locale} manuscriptLanguage={manuscriptLanguage}
          placement="header" renderActions={target.renderActions}>
          {target.insertCitation ? (
            <button type="button" className="focus-formatting-citation"
              onMouseDown={(event) => event.preventDefault()}
              onClick={target.insertCitation}>
              <BookOpen size={16} aria-hidden="true" />{copy.addCitation}
            </button>
          ) : null}
        </RichTextToolbar>
      ) : <p className="focus-header-formatting__hint">{hint}</p>}
    </div>
  );
  const dialogHost = target && !target.editor.isDestroyed
    ? target.editor.view.dom.closest('[role="dialog"], dialog')?.querySelector('[data-shared-formatting-host]')
    : null;
  return dialogHost ? createPortal(panel, dialogHost) : panel;
}
