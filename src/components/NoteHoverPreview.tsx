import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStudioStore } from '../app/useStudioStore';
import { isNoteAnnotation, sortNotesByDocumentOrder } from '../model/notes';
import { renderPublicationNoteBody } from '../services/publicationNoteBody';
import './NoteHoverPreview.css';

const ANCHOR = '[data-omi-note][data-note-id]';
const CLOSE_DELAY = 180;
const GAP = 6;

function findAnchor(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(ANCHOR) : null;
}

/** A transient, read-only projection of the current annotation, not part of the
 * editable ProseMirror document or its serialized note anchor. */
export function NoteHoverPreview() {
  const id = useId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const active = useRef<HTMLElement | null>(null);
  const popup = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const manuscript = useStudioStore((state) => anchor ? state.manuscript : null);
  const noteId = anchor?.dataset.noteId;
  const body = useMemo(() => {
    if (!manuscript || !noteId) return null;
    const note = manuscript.annotations.find((item) => item.id === noteId && isNoteAnnotation(item));
    if (!note) return null;
    const previous: string[] = [];
    for (const item of sortNotesByDocumentOrder(manuscript)) {
      if (item.id === note.id) break;
      previous.push(...(item.noteCitations ?? []).map((citation) => citation.target));
    }
    const rules = manuscript.embeddedPublicationProfile?.rules.citations;
    return renderPublicationNoteBody(note, manuscript.bibliographicRecords ?? [],
      rules?.noteFirstStyle ?? manuscript.citationStyle ?? 'apa-7', manuscript.locale,
      { subsequentStyle: rules?.noteSubsequentStyle, previouslyCitedTargets: previous, previewOnly: true });
  }, [manuscript, noteId]);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const close = useCallback(() => {
    cancelClose();
    active.current = null;
    setAnchor(null);
    setPosition(null);
  }, [cancelClose]);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(close, CLOSE_DELAY);
  }, [cancelClose, close]);

  useEffect(() => {
    function open(element: HTMLElement) {
      cancelClose();
      if (active.current === element) return;
      active.current = element;
      setPosition(null);
      setAnchor(element);
    }
    function pointerOver(event: PointerEvent) {
      if (event.pointerType === 'touch') return;
      const element = findAnchor(event.target);
      if (element) open(element);
      else if (event.target instanceof Node && popup.current?.contains(event.target)) cancelClose();
    }
    function pointerOut(event: PointerEvent) {
      if (event.pointerType === 'touch' || findAnchor(event.target) !== active.current || !active.current) return;
      if (event.relatedTarget instanceof Node && (active.current.contains(event.relatedTarget) || popup.current?.contains(event.relatedTarget))) return;
      if (active.current === document.activeElement && active.current.matches(':focus-visible')) return;
      scheduleClose();
    }
    function focusIn(event: FocusEvent) {
      const element = findAnchor(event.target);
      if (element?.matches(':focus-visible')) open(element);
      else if (active.current && event.target !== active.current) close();
    }
    function focusOut(event: FocusEvent) {
      if (findAnchor(event.target) === active.current && active.current) scheduleClose();
    }
    function pointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node) || !popup.current?.contains(event.target)) close();
    }
    function keyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && active.current) close();
    }
    document.addEventListener('pointerover', pointerOver);
    document.addEventListener('pointerout', pointerOut);
    document.addEventListener('focusin', focusIn);
    document.addEventListener('focusout', focusOut);
    document.addEventListener('pointerdown', pointerDown, true);
    document.addEventListener('keydown', keyDown);
    window.addEventListener('blur', close);
    return () => {
      cancelClose();
      document.removeEventListener('pointerover', pointerOver);
      document.removeEventListener('pointerout', pointerOut);
      document.removeEventListener('focusin', focusIn);
      document.removeEventListener('focusout', focusOut);
      document.removeEventListener('pointerdown', pointerDown, true);
      document.removeEventListener('keydown', keyDown);
      window.removeEventListener('blur', close);
    };
  }, [cancelClose, close, scheduleClose]);

  const html = body?.text ? body.html : '';
  useLayoutEffect(() => {
    if (!anchor || !html || !popup.current) return;
    const describedBy = anchor.getAttribute('aria-describedby');
    const descriptions = new Set((describedBy ?? '').split(/\s+/).filter(Boolean));
    descriptions.add(id);
    anchor.setAttribute('aria-describedby', [...descriptions].join(' '));
    const measure = () => {
      if (!anchor.isConnected) { close(); return; }
      const rect = anchor.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
        close(); return;
      }
      const box = popup.current?.getBoundingClientRect();
      if (!box) return;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - box.width - 8));
      const below = rect.bottom + GAP;
      const above = rect.top - box.height - GAP;
      const top = below + box.height <= window.innerHeight - 8 ? below
        : above >= 8 ? above : Math.max(8, window.innerHeight - box.height - 8);
      setPosition({ left, top });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(popup.current);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      const remaining = (anchor.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((value) => value && value !== id);
      if (remaining.length) anchor.setAttribute('aria-describedby', remaining.join(' '));
      else anchor.removeAttribute('aria-describedby');
    };
  }, [anchor, close, html, id]);

  if (!anchor || !html) return null;
  return createPortal(
    <div ref={popup} id={id} role="tooltip" className="omi-note-hover-preview"
      style={position ? { ...position } : { left: 0, top: 0, visibility: 'hidden' }}
      onPointerEnter={cancelClose}
      onPointerLeave={() => {
        if (active.current === document.activeElement && active.current?.matches(':focus-visible')) return;
        scheduleClose();
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />, document.body,
  );
}
