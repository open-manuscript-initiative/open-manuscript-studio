import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from '../i18n';
import { publicationPageNavigationCopy } from '../i18n/publicationPageNavigation';
import { publicationPageStyleLetter, type PublicationPageThumbnail } from '../model/publicationPageNavigation';
import './PublicationPageNavigator.css';

export function PublicationPageNavigator({ pages, styles, selected, help, onSelect, onInsert, onDelete, onMove }: {
  pages: PublicationPageThumbnail[]; styles: { id: string; name: string }[]; selected: number; help: 'frame' | 'body';
  onSelect: (index: number) => void; onInsert: (index: number, side: 'before' | 'after', styleId: string) => void;
  onDelete: (index: number) => void; onMove: (from: number, to: number) => void;
}) {
  const { locale } = useTranslation(), copy = publicationPageNavigationCopy(locale);
  const [newStyle, setNewStyle] = useState('');
  const dragId = useRef<string | null>(null);
  const dragTargetId = useRef<string | null>(null);
  const dragCompleted = useRef(false);
  const navigatorRef = useRef<HTMLDivElement>(null);
  const [visibleArtwork, setVisibleArtwork] = useState<ReadonlySet<string>>(() => new Set());
  const pageIds = JSON.stringify(pages.map((item) => item.id));
  const supportsViewportObservation = typeof IntersectionObserver !== 'undefined';
  useEffect(() => {
    const list = navigatorRef.current;
    if (!list || !supportsViewportObservation) return;
    const buttons = Array.from(list.querySelectorAll<HTMLElement>('[data-thumbnail-id]'));
    const ids = new Set(buttons.map((button) => button.dataset.thumbnailId!));
    let disposed = false;
    // Keep all page buttons, labels and drag targets mounted; only the costly
    // SVG line/graphic marks need to follow the scrolling viewport.
    const observer = new IntersectionObserver((entries) => {
      if (disposed) return;
      setVisibleArtwork((previous) => {
        const next = new Set([...previous].filter((id) => ids.has(id)));
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.thumbnailId;
          if (!id) continue;
          if (entry.isIntersecting) next.add(id); else next.delete(id);
        }
        return next.size === previous.size && [...next].every((id) => previous.has(id)) ? previous : next;
      });
    }, { root: list, rootMargin: '160px' });
    buttons.forEach((button) => observer.observe(button));
    return () => { disposed = true; observer.disconnect(); };
  }, [pageIds, supportsViewportObservation]);
  const page = pages[selected] ?? pages[0];
  const selectedStyle = styles.some((style) => style.id === newStyle) ? newStyle : page?.styleId ?? styles[0]?.id ?? '';
  return <details className="publication-page-navigator" open>
    <summary>{copy.title} ({pages.length})</summary>
    <p>{help === 'frame' ? copy.frameHelp : copy.bodyHelp}</p>
    <div className="publication-page-thumbnails" role="group" aria-label={copy.title} ref={navigatorRef}>
      {pages.map((item, index) => {
        const styleIndex = Math.max(0, styles.findIndex((style) => style.id === item.styleId));
        const name = styles[styleIndex]?.name ?? copy.defaultStyle;
        const renderArtwork = !supportsViewportObservation || selected === index || index < 4 || visibleArtwork.has(item.id);
        return <button type="button" key={item.id} className="publication-page-thumbnail" data-thumbnail-page={index} data-thumbnail-id={item.id}
          data-thumbnail-style={item.styleId} data-thumbnail-artwork={String(renderArtwork)} aria-current={selected === index ? 'page' : undefined}
          aria-label={`${copy.page} ${item.number}: ${name}${item.label ? ` — ${item.label}` : ''}`}
          draggable={item.canMoveUp || item.canMoveDown} onClick={() => onSelect(index)}
          onDragStart={(event) => {
            dragId.current = item.id;
            dragTargetId.current = null;
            dragCompleted.current = false;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('application/x-omi-publication-page', item.id);
            event.dataTransfer.setData('text/plain', item.id);
          }}
          onDragEnd={(event) => {
            // A vertically scrolling rail can lose the native drop event while
            // the browser auto-scrolls. Finish the last valid drop target if
            // the pointer is still over the page thumbnail list.
            const sourceId = dragId.current;
            if (sourceId && !dragCompleted.current && navigatorRef.current) {
              const bounds = navigatorRef.current.getBoundingClientRect();
              const overList = event.clientX >= bounds.left && event.clientX <= bounds.right
                && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
              const targetElement = overList ? document.elementFromPoint(event.clientX, event.clientY) : null;
              const closest = targetElement instanceof Element ? targetElement.closest<HTMLElement>('[data-thumbnail-id]') : null;
              const targetId = closest && navigatorRef.current.contains(closest)
                ? closest.dataset.thumbnailId
                : overList ? dragTargetId.current : null;
              const from = pages.findIndex((candidate) => candidate.id === sourceId);
              const to = pages.findIndex((candidate) => candidate.id === targetId);
              if (from >= 0 && to >= 0 && from !== to) onMove(from, to);
            }
            dragId.current = null;
            dragTargetId.current = null;
          }}
          onDragOver={(event) => {
            const candidateId = dragId.current
              ?? (event.dataTransfer.types.includes('application/x-omi-publication-page') ? 'pending' : null);
            if (candidateId && candidateId !== item.id) {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              dragTargetId.current = item.id;
            }
          }}
          onDrop={(event) => {
            const sourceId = event.dataTransfer.getData('application/x-omi-publication-page') || dragId.current;
            const from = pages.findIndex((candidate) => candidate.id === sourceId);
            if (from >= 0 && from !== index) {
              event.preventDefault();
              dragCompleted.current = true;
              onMove(from, index);
            }
            dragId.current = null;
            dragTargetId.current = null;
          }}>
          <svg viewBox={`0 0 ${item.width} ${item.height}`} aria-hidden="true" focusable="false">
            <rect width={item.width} height={item.height} fill={item.background ?? '#fff'} />
            {renderArtwork && item.marks.map((mark, n) => <rect key={n} x={mark.x} y={mark.y} width={mark.width} height={mark.height}
              fill={mark.graphic ? '#b8cad2' : '#64748b'} opacity={mark.graphic ? 0.75 : 0.6}
              transform={mark.rotation ? `rotate(${mark.rotation} ${mark.x + mark.width / 2} ${mark.y + mark.height / 2})` : undefined} />)}
          </svg>
          <span className="publication-page-thumbnail-caption"><span>{item.number}</span><strong title={name} data-style-letter>{publicationPageStyleLetter(styleIndex)}</strong></span>
        </button>;
      })}
    </div>
    <div className="publication-page-style-legend" aria-label={copy.styles}>{styles.map((style, index) => <span key={style.id}><strong>{publicationPageStyleLetter(index)}</strong> {style.name}</span>)}</div>
    <div className="publication-page-navigation-actions">
      <label>{copy.insertStyle}<select value={selectedStyle} onChange={(event) => setNewStyle(event.target.value)}>{styles.map((style, index) => <option key={style.id} value={style.id}>{publicationPageStyleLetter(index)} — {style.name}</option>)}</select></label>
      <button type="button" aria-label={copy.before} title={copy.before} disabled={!page?.canInsert} onClick={() => onInsert(selected, 'before', selectedStyle)}><Plus size={15} aria-hidden="true" /><ArrowUp size={15} aria-hidden="true" /><span className="publication-page-action-text">{copy.before}</span></button>
      <button type="button" aria-label={copy.after} title={copy.after} disabled={!page?.canInsert} onClick={() => onInsert(selected, 'after', selectedStyle)}><Plus size={15} aria-hidden="true" /><ArrowDown size={15} aria-hidden="true" /><span className="publication-page-action-text">{copy.after}</span></button>
      <button type="button" disabled={!page?.canMoveUp} onClick={() => onMove(selected, page?.moveUpTarget ?? selected - 1)} aria-label={copy.up} title={copy.up}><ArrowUp size={16} aria-hidden="true" /></button>
      <button type="button" disabled={!page?.canMoveDown} onClick={() => onMove(selected, page?.moveDownTarget ?? selected + 1)} aria-label={copy.down} title={copy.down}><ArrowDown size={16} aria-hidden="true" /></button>
      <button type="button" aria-label={copy.remove} title={copy.remove} disabled={!page?.canDelete} onClick={() => onDelete(selected)}><Trash2 size={15} aria-hidden="true" /><span className="publication-page-action-text">{copy.remove}</span></button>
    </div>
  </details>;
}
