import { ChevronDown, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useTranslation } from '../i18n';
import { getVisualElementsCopy } from '../i18n/visualElements';
import { VisualInsertPanel } from './VisualInsertPanel';

import '../styles/header-insert-menu.css';

export function HeaderInsertMenu() {
  const { locale } = useTranslation();
  const copy = getVisualElementsCopy(locale);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', closeOnPointerDown);
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className="focus-insert-menu" ref={rootRef}>
      <button
        type="button"
        className="focus-insert-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={copy.insertMenu}
        title={copy.insertMenu}
        onClick={() => setOpen((current) => !current)}
      >
        <Plus size={16} aria-hidden="true" />
        <span>{copy.insertMenu}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open ? (
        <div
          className="focus-insert-menu-popover"
          role="menu"
          aria-label={copy.insertMenu}
        >
          <VisualInsertPanel compact onInserted={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
