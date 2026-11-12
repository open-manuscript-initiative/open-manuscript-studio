import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import {
  connectionPoints,
  edgeLabelPoint,
  graphColors,
  graphNameLines,
  NODE_HEIGHT,
  NODE_WIDTH,
  type GraphLayout,
} from './layout';
import { relationLabels, type GraphCopy } from './copy';
import type { Point } from './model';

export function GraphCanvas({
  layout,
  selected,
  onSelect,
  onMove,
  t,
}: {
  layout: GraphLayout;
  selected: string;
  onSelect: (id: string) => void;
  onMove: (id: string, point: Point) => void;
  t: GraphCopy;
}) {
  const ref = useRef<SVGSVGElement>(null),
    arrow = useId().replace(/:/g, '');
  const [view, setView] = useState({
    x: layout.x,
    y: layout.y,
    width: layout.width,
    height: layout.height,
  });
  const [drag, setDrag] = useState<{
    id: string;
    start: Point;
    origin: Point;
    point: Point;
    inverse: DOMMatrix;
  } | null>(null);
  const gesture = useRef<{
    id: string;
    start: Point;
    origin: Point;
    point: Point;
    inverse: DOMMatrix;
  } | null>(null);
  const signature = layout.workspace.nodes.map((n) => n.id).join('|');
  useEffect(() => {
    setView({
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
    });
  }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps -- moving nodes must not reset the user's viewport
  function coordinate(event: PointerEvent, inverse?: DOMMatrix): Point {
    const transform = inverse ?? ref.current?.getScreenCTM()?.inverse();
    if (!transform) return { x: 0, y: 0 };
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      transform,
    );
    return { x: p.x, y: p.y };
  }
  function start(event: PointerEvent, id = '') {
    if (event.button !== 0) return;
    event.stopPropagation();
    const p = coordinate(event);
    const origin = id ? layout.points.get(id)! : { x: view.x, y: view.y };
    const inverse = ref.current?.getScreenCTM()?.inverse();
    if (!inverse) return;
    const next = { id, start: p, origin, point: origin, inverse };
    gesture.current = next;
    setDrag(next);
    ref.current?.setPointerCapture(event.pointerId);
    if (id) onSelect(id);
  }
  function move(event: PointerEvent) {
    const current = gesture.current;
    if (!current) return;
    const p = coordinate(event, current.inverse);
    const point = {
      x: current.origin.x + p.x - current.start.x,
      y: current.origin.y + p.y - current.start.y,
    };
    if (current.id) {
      const next = { ...current, point };
      gesture.current = next;
      setDrag(next);
    } else {
      setView((v) => ({
        ...v,
        x: current.origin.x - (p.x - current.start.x),
        y: current.origin.y - (p.y - current.start.y),
      }));
    }
  }
  function end(event: PointerEvent, cancel = false) {
    const current = gesture.current;
    gesture.current = null;
    setDrag(null);
    if (ref.current?.hasPointerCapture(event.pointerId))
      ref.current.releasePointerCapture(event.pointerId);
    if (
      current?.id &&
      !cancel &&
      (Math.abs(current.point.x - current.origin.x) > 1 ||
        Math.abs(current.point.y - current.origin.y) > 1)
    )
      onMove(current.id, current.point);
  }
  const point = (id: string) =>
    drag?.id === id ? drag.point : layout.points.get(id)!;
  const labels = relationLabels(t);
  function zoom(factor: number) {
    setView((v) => {
      const width = Math.max(120, Math.min(100000, v.width * factor)),
        height = (width * v.height) / v.width;
      return {
        x: v.x + (v.width - width) / 2,
        y: v.y + (v.height - height) / 2,
        width,
        height,
      };
    });
  }
  return (
    <div className="genealogy-canvas">
      <div className="genealogy-toolbar">
        <button type="button" onClick={() => zoom(0.8)}>
          {t.zoomIn}
        </button>
        <button type="button" onClick={() => zoom(1.25)}>
          {t.zoomOut}
        </button>
        <button
          type="button"
          onClick={() =>
            setView({
              x: layout.x,
              y: layout.y,
              width: layout.width,
              height: layout.height,
            })
          }
        >
          {t.fit}
        </button>
      </div>
      <p className="genealogy-hint">{t.drag}</p>
      <svg
        ref={ref}
        className="genealogy-diagram"
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        role="group"
        aria-label={t.title}
        onPointerDown={(e) => start(e)}
        onPointerMove={move}
        onPointerUp={(e) => end(e)}
        onPointerCancel={(e) => end(e, true)}
      >
        <defs>
          <marker
            id={arrow}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10" fill="#667085" />
          </marker>
        </defs>
        {layout.workspace.edges.map((e) => {
          const a = point(e.from),
            b = point(e.to),
            p = connectionPoints(a, b),
            label = edgeLabelPoint(a, b);
          return (
            <g key={e.id}>
              <line
                {...p}
                stroke={e.kind === 'parent' ? '#516d96' : '#86909e'}
                strokeWidth="2"
                markerEnd={e.directed ? `url(#${arrow})` : undefined}
                strokeDasharray={
                  e.certainty === 'documented' ? undefined : '6 4'
                }
              />
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                className="genealogy-edge-label"
              >
                {e.label || labels[e.kind]}
              </text>
            </g>
          );
        })}
        {layout.workspace.nodes.map((n) => {
          const p = point(n.id),
            dates = [n.birthDate, n.deathDate].filter(Boolean).join(' – ');
          return (
            <g
              key={n.id}
              transform={`translate(${p.x} ${p.y})`}
              role="button"
              tabIndex={0}
              aria-label={n.label}
              aria-pressed={selected === n.id}
              onPointerDown={(e) => start(e, n.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(n.id);
                }
              }}
              className="genealogy-node"
            >
              <title>
                {n.label}
                {dates ? ` · ${dates}` : ''}
              </title>
              <rect
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx="9"
                fill={graphColors[n.kind]}
                stroke={selected === n.id ? '#175cd3' : '#7a8fa8'}
                strokeWidth={selected === n.id ? 3 : 1}
              />
              <text x="12" y="22" className="genealogy-node-label">
                {graphNameLines(n.label).map((line, index) => (
                  <tspan key={index} x="12" dy={index ? 17 : 0}>
                    {line}
                  </tspan>
                ))}
              </text>
              <text x="12" y="80" className="genealogy-node-dates">
                {dates.length > 28 ? dates.slice(0, 27) + '…' : dates}
              </text>
            </g>
          );
        })}
      </svg>
      {layout.truncated && <p role="status">{t.limit}</p>}
    </div>
  );
}
