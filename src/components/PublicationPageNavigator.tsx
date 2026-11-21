import { useRef, useState } from 'react';
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
  const page = pages[selected] ?? pages[0];
  const selectedStyle = styles.some((style) => style.id === newStyle) ? newStyle : page?.styleId ?? styles[0]?.id ?? '';
  return <details className="publication-page-navigator" open>
    <summary>{copy.title} ({pages.length})</summary>
    <p>{help === 'frame' ? copy.frameHelp : copy.bodyHelp}</p>
    <div className="publication-page-thumbnails" role="group" aria-label={copy.title}>
      {pages.map((item, index) => {
        const styleIndex = Math.max(0, styles.findIndex((style) => style.id === item.styleId));
        const name = styles[styleIndex]?.name ?? copy.defaultStyle;
        return <button type="button" key={item.id} className="publication-page-thumbnail" data-thumbnail-page={index} data-thumbnail-id={item.id}
          data-thumbnail-style={item.styleId} aria-current={selected === index ? 'page' : undefined}
          aria-label={`${copy.page} ${item.number}: ${name}${item.label ? ` — ${item.label}` : ''}`}
          draggable={item.canMoveUp || item.canMoveDown} onClick={() => onSelect(index)}
          onDragStart={(event) => { dragId.current = item.id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id); }}
          onDragEnd={() => { dragId.current = null; }}
          onDragOver={(event) => { if (dragId.current && dragId.current !== item.id) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }}
          onDrop={(event) => { event.preventDefault(); const from = pages.findIndex((candidate) => candidate.id === dragId.current); dragId.current = null; if (from >= 0 && from !== index) onMove(from, index); }}>
          <svg viewBox={`0 0 ${item.width} ${item.height}`} aria-hidden="true" focusable="false">
            <rect width={item.width} height={item.height} fill={item.background ?? '#fff'} />
            {item.marks.map((mark, n) => <rect key={n} x={mark.x} y={mark.y} width={mark.width} height={mark.height}
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
      <button type="button" disabled={!page?.canInsert} onClick={() => onInsert(selected, 'before', selectedStyle)}>{copy.before}</button>
      <button type="button" disabled={!page?.canInsert} onClick={() => onInsert(selected, 'after', selectedStyle)}>{copy.after}</button>
      <button type="button" disabled={!page?.canMoveUp} onClick={() => onMove(selected, page?.moveUpTarget ?? selected - 1)} aria-label={copy.up}>↑</button>
      <button type="button" disabled={!page?.canMoveDown} onClick={() => onMove(selected, page?.moveDownTarget ?? selected + 1)} aria-label={copy.down}>↓</button>
      <button type="button" disabled={!page?.canDelete} onClick={() => onDelete(selected)}>{copy.remove}</button>
    </div>
  </details>;
}
