import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';

interface Point { left: number; top: number }
interface Anchor extends Point { below: boolean }
interface Layout {
  width: number;
  height: number;
  position: Point | null;
}

const STORAGE_KEY = 'omi.selectionToolbarLayout.v1';
const CHANGE_EVENT = 'omi-selection-toolbar-layout-change';
const DEFAULT_LAYOUT: Layout = { width: 704, height: 0, position: null };
const MARGIN = 12;
const MIN_WIDTH = 360;

function readLayout(): Layout {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!saved || saved.version !== 1) return DEFAULT_LAYOUT;
    return {
      width: Number.isFinite(saved.width) && saved.width >= MIN_WIDTH
        ? saved.width : DEFAULT_LAYOUT.width,
      height: Number.isFinite(saved.height) && saved.height >= 0 ? saved.height : 0,
      position: saved.position && Number.isFinite(saved.position.left)
        && Number.isFinite(saved.position.top) ? saved.position : null,
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function constrain(value: number, maximum: number): number {
  return Math.max(MARGIN, Math.min(Math.max(MARGIN, maximum), value));
}

/** A desktop placement preference shared by every editor, independent of manuscript data. */
export function useSelectionToolbarLayout(
  toolbarRef: RefObject<HTMLDivElement | null>,
  anchor: Anchor | null,
) {
  const [layout, setLayout] = useState(readLayout);
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth, height: window.innerHeight,
  }));
  const [size, setSize] = useState({ width: DEFAULT_LAYOUT.width, height: 120 });
  const interactionRef = useRef<{
    pointerId: number;
    mode: 'move' | 'resize';
    x: number;
    y: number;
    rect: DOMRect;
    original: Layout;
    draft: Layout;
  } | null>(null);
  const desktop = viewport.width > 760;
  const visible = anchor !== null;

  function save(next: Layout) {
    setLayout(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...next }));
    } catch {
      // The panel remains usable when browser storage is unavailable.
    }
    // Also update toolbars belonging to other blocks or open manuscripts.
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: next }));
  }

  useEffect(() => {
    const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    const sync = (event: Event) => {
      setLayout((event as CustomEvent<Layout>).detail);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setLayout(readLayout());
    };
    window.addEventListener('resize', resize);
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', storage);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', storage);
    };
  }, []);

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    if (!visible || !desktop || !toolbar) return;
    const measure = () => {
      const rect = toolbar.getBoundingClientRect();
      setSize((previous) => previous.width === rect.width && previous.height === rect.height
        ? previous : { width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, [desktop, toolbarRef, visible]);

  const left = constrain(
    layout.position?.left ?? (anchor?.left ?? viewport.width / 2) - size.width / 2,
    viewport.width - size.width - MARGIN,
  );
  const top = constrain(
    layout.position?.top ?? ((anchor?.top ?? MARGIN) - (anchor?.below ? 0 : size.height)),
    viewport.height - size.height - MARGIN,
  );
  const style: CSSProperties = desktop ? {
    left, top,
    width: Math.min(layout.width, viewport.width - 2 * MARGIN),
    minHeight: Math.min(layout.height, viewport.height - 2 * MARGIN),
  } : {};

  const start = (mode: 'move' | 'resize') => (event: PointerEvent<HTMLButtonElement>) => {
    if (!desktop || event.button !== 0 || !toolbarRef.current) return;
    event.preventDefault();
    const rect = toolbarRef.current.getBoundingClientRect();
    interactionRef.current = {
      pointerId: event.pointerId, mode, x: event.clientX, y: event.clientY,
      rect, original: layout, draft: layout,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    event.preventDefault();
    const { rect, mode, original } = interaction;
    const dx = event.clientX - interaction.x;
    const dy = event.clientY - interaction.y;
    interaction.draft = mode === 'move' ? {
      ...original,
      position: {
        left: constrain(rect.left + dx, viewport.width - rect.width - MARGIN),
        top: constrain(rect.top + dy, viewport.height - rect.height - MARGIN),
      },
    } : {
      ...original,
      position: { left: rect.left, top: rect.top },
      width: Math.max(MIN_WIDTH, Math.min(viewport.width - rect.left - MARGIN, rect.width + dx)),
      height: Math.max(0, Math.min(viewport.height - rect.top - MARGIN, rect.height + dy)),
    };
    setLayout(interaction.draft);
  };

  const finish = (event: PointerEvent<HTMLButtonElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    interactionRef.current = null;
    if (event.type === 'pointercancel') setLayout(interaction.original);
    else save(interaction.draft);
  };

  const keyboard = (mode: 'move' | 'resize') => (event: KeyboardEvent<HTMLButtonElement>) => {
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    const rect = toolbarRef.current?.getBoundingClientRect();
    if (!desktop || !direction || !rect) return;
    event.preventDefault();
    const [dx, dy] = direction.map((value) => value * (event.shiftKey ? 40 : 10));
    save(mode === 'move' ? {
      ...layout,
      position: {
        left: constrain(rect.left + dx, viewport.width - rect.width - MARGIN),
        top: constrain(rect.top + dy, viewport.height - rect.height - MARGIN),
      },
    } : {
      ...layout,
      position: { left: rect.left, top: rect.top },
      width: Math.max(MIN_WIDTH, Math.min(viewport.width - rect.left - MARGIN, rect.width + dx)),
      height: Math.max(0, Math.min(viewport.height - rect.top - MARGIN, rect.height + dy)),
    });
  };

  const handle = (mode: 'move' | 'resize') => ({
    onPointerDown: start(mode),
    onPointerMove: move,
    onPointerUp: finish,
    onPointerCancel: finish,
    onLostPointerCapture: finish,
    onKeyDown: keyboard(mode),
  });

  return {
    desktop, style, interactionRef,
    pinned: layout.position !== null,
    moveHandle: handle('move'),
    resizeHandle: handle('resize'),
    reset: () => save(DEFAULT_LAYOUT),
    togglePin: () => {
      const rect = toolbarRef.current?.getBoundingClientRect();
      if (!rect) return;
      save({ ...layout, position: layout.position ? null : { left: rect.left, top: rect.top } });
    },
  };
}
