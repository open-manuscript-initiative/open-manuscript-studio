import { useMemo } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { BlockEditor } from './BlockEditor';

export function EditorPane() {
  const manuscript = useStudioStore(
    (state) => state.manuscript,
  );

  const selectedSectionId = useStudioStore(
    (state) => state.selectedSectionId,
  );

  const setTitle = useStudioStore(
    (state) => state.setTitle,
  );

  const updateBlock = useStudioStore(
    (state) => state.updateBlock,
  );

  const section =
    manuscript.sections.find(
      (item) => item.id === selectedSectionId,
    ) ?? manuscript.sections[0];

  /*
   * A jobb oldali panelen nem a JSON-stringeket jelenítjük meg
   * stringként, hanem megpróbáljuk visszaalakítani őket valódi
   * objektummá. Így a szemantikus dokumentumfa jól olvasható.
   */
  const liveSectionJson = useMemo(() => {
    if (!section) {
      return null;
    }

    return {
      id: section.id,
      title: section.title,
      blocks: section.blocks.map((block) => ({
        id: block.id,
        type: block.type,
        content: parseBlockContentForPreview(
          block.content,
        ),
      })),
    };
  }, [section]);

  return (
    <main
      className="panel editor omi-studio-editor"
      aria-label="Manuscript editor"
    >
      <style>{`
        .omi-studio-editor {
          --omi-border: #dfe3e8;
          --omi-border-strong: #c9d0d8;
          --omi-surface: #ffffff;
          --omi-surface-muted: #f7f8fa;
          --omi-text: #17202a;
          --omi-text-muted: #667085;
          --omi-accent: #475467;
          --omi-note-background: #fff4cc;
          --omi-note-border: #e7c85c;
          --omi-json-background: #111827;
          --omi-json-text: #dbeafe;

          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 0;
          height: 100%;
          color: var(--omi-text);
          background: var(--omi-surface);
        }

        .omi-editor-header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--omi-border);
          background: var(--omi-surface);
        }

        .omi-editor-header .field-label {
          display: block;
          margin-bottom: 0.4rem;
          color: var(--omi-text-muted);
          font-size: 0.75rem;
          font-weight: 650;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .omi-editor-header .title-input {
          box-sizing: border-box;
          width: 100%;
          padding: 0.25rem 0;
          border: 0;
          border-bottom: 1px solid transparent;
          outline: none;
          color: var(--omi-text);
          background: transparent;
          font: inherit;
          font-size: clamp(1.55rem, 3vw, 2.25rem);
          font-weight: 650;
          line-height: 1.2;
          transition:
            border-color 150ms ease,
            background-color 150ms ease;
        }

        .omi-editor-header .title-input:hover {
          border-bottom-color: var(--omi-border);
        }

        .omi-editor-header .title-input:focus {
          border-bottom-color: var(--omi-accent);
        }

        .omi-editor-workspace {
          display: grid;
          grid-template-columns:
            minmax(0, 3fr)
            minmax(20rem, 2fr);
          flex: 1;
          min-width: 0;
          min-height: 0;
          overflow: hidden;
        }

        .omi-writing-pane {
          min-width: 0;
          overflow-y: auto;
          padding: 2rem clamp(1.25rem, 4vw, 4rem) 4rem;
          background: var(--omi-surface);
        }

        .omi-section-editor {
          width: min(100%, 52rem);
          margin: 0 auto;
        }

        .omi-section-heading {
          margin: 0 0 1.75rem;
          color: var(--omi-text);
          font-size: 1.35rem;
          font-weight: 650;
          line-height: 1.3;
        }

        .omi-block-editor {
          position: relative;
          margin: 0 0 1.25rem;
          padding: 0.85rem 1rem 1rem;
          border: 1px solid transparent;
          border-radius: 0.65rem;
          background: var(--omi-surface);
          transition:
            border-color 150ms ease,
            box-shadow 150ms ease,
            background-color 150ms ease;
        }

        .omi-block-editor:hover {
          border-color: var(--omi-border);
        }

        .omi-block-editor:focus-within {
          border-color: var(--omi-border-strong);
          box-shadow: 0 0 0 3px rgb(71 84 103 / 8%);
        }

        .omi-block-editor--loading {
          color: var(--omi-text-muted);
        }

        .omi-block-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 1.75rem;
          margin-bottom: 0.35rem;
          opacity: 0.48;
          transition: opacity 150ms ease;
        }

        .omi-block-editor:hover .omi-block-toolbar,
        .omi-block-editor:focus-within .omi-block-toolbar {
          opacity: 1;
        }

        .omi-block-type {
          color: var(--omi-text-muted);
          font-size: 0.69rem;
          font-weight: 650;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .omi-note-insert-button {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.28rem 0.55rem;
          border: 1px solid var(--omi-border);
          border-radius: 999px;
          color: var(--omi-text-muted);
          background: var(--omi-surface);
          font: inherit;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition:
            color 150ms ease,
            border-color 150ms ease,
            background-color 150ms ease;
        }

        .omi-note-insert-button:hover {
          color: var(--omi-text);
          border-color: var(--omi-border-strong);
          background: var(--omi-surface-muted);
        }

        .omi-note-insert-button:focus-visible {
          outline: 2px solid var(--omi-accent);
          outline-offset: 2px;
        }

        .omi-tiptap-editor {
          min-height: 3.25rem;
          padding: 0.3rem 0;
          border: 0;
          outline: none;
          color: var(--omi-text);
          font-size: 1.02rem;
          line-height: 1.75;
          overflow-wrap: anywhere;
        }

        .omi-tiptap-editor p {
          margin: 0;
        }

        .omi-tiptap-editor p + p {
          margin-top: 0.8rem;
        }

        .omi-tiptap-editor p.is-editor-empty:first-child::before {
          content: 'Kezdje el írni a bekezdést…';
          float: left;
          height: 0;
          color: #98a2b3;
          pointer-events: none;
        }

        .omi-note {
          display: inline-flex;
          align-items: center;
          margin-inline: 0.18rem;
          padding: 0.12rem 0.42rem;
          border: 1px solid var(--omi-note-border);
          border-radius: 999px;
          color: #695000;
          background: var(--omi-note-background);
          font-family: inherit;
          font-size: 0.72em;
          font-weight: 700;
          line-height: 1.25;
          vertical-align: 0.12em;
          cursor: default;
          user-select: none;
        }

        .omi-note.ProseMirror-selectednode {
          outline: 2px solid var(--omi-accent);
          outline-offset: 2px;
        }

        .omi-json-pane {
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 0;
          border-left: 1px solid var(--omi-border);
          background: var(--omi-json-background);
        }

        .omi-json-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 1rem;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid rgb(255 255 255 / 10%);
        }

        .omi-json-header h2 {
          margin: 0;
          color: #f9fafb;
          font-size: 0.94rem;
          font-weight: 650;
        }

        .omi-json-status {
          color: #86efac;
          font-size: 0.72rem;
          font-weight: 600;
        }

        .omi-json-view {
          box-sizing: border-box;
          flex: 1;
          min-width: 0;
          min-height: 0;
          margin: 0;
          padding: 1.25rem;
          overflow: auto;
          color: var(--omi-json-text);
          background: transparent;
          font-family:
            "SFMono-Regular",
            Consolas,
            "Liberation Mono",
            Menlo,
            monospace;
          font-size: 0.78rem;
          line-height: 1.6;
          tab-size: 2;
          white-space: pre;
        }

        .omi-json-view code {
          font: inherit;
        }

        .omi-empty-section {
          color: var(--omi-text-muted);
        }

        @media (max-width: 960px) {
          .omi-editor-workspace {
            grid-template-columns: 1fr;
            grid-template-rows:
              minmax(24rem, 3fr)
              minmax(18rem, 2fr);
            overflow: auto;
          }

          .omi-writing-pane {
            overflow: visible;
          }

          .omi-json-pane {
            min-height: 18rem;
            border-top: 1px solid var(--omi-border);
            border-left: 0;
          }
        }

        @media (max-width: 600px) {
          .omi-editor-header {
            padding: 1rem;
          }

          .omi-writing-pane {
            padding: 1.25rem 0.65rem 2rem;
          }

          .omi-block-editor {
            padding-inline: 0.75rem;
          }

          .omi-note-insert-button span:last-child {
            display: none;
          }
        }
      `}</style>

      <header className="omi-editor-header">
        <label
          className="field-label"
          htmlFor="manuscript-title"
        >
          Kézirat címe
        </label>

        <input
          id="manuscript-title"
          className="title-input"
          value={manuscript.title}
          onChange={(event) =>
            setTitle(event.target.value)
          }
          placeholder="Adja meg a kézirat címét"
        />
      </header>

      <div className="omi-editor-workspace">
        <section
          className="omi-writing-pane"
          aria-label="Szemantikus szerkesztő"
        >
          {section ? (
            <div className="omi-section-editor">
              <h1 className="omi-section-heading">
                {section.title}
              </h1>

              {section.blocks.map((block) => (
                <BlockEditor
                  key={block.id}
                  blockId={block.id}
                  blockType={block.type}
                  content={block.content}
                  onUpdate={updateBlock}
                />
              ))}
            </div>
          ) : (
            <p className="omi-empty-section">
              Nincs kiválasztott szekció.
            </p>
          )}
        </section>

        <aside
          className="omi-json-pane"
          aria-label="Élő JSON nézet"
        >
          <header className="omi-json-header">
            <h2>Élő JSON nézet</h2>

            <span
              className="omi-json-status"
              aria-live="polite"
            >
              ● Szinkronban
            </span>
          </header>

          <pre className="omi-json-view">
            <code>
              {JSON.stringify(
                liveSectionJson,
                null,
                2,
              )}
            </code>
          </pre>
        </aside>
      </div>
    </main>
  );
}

/**
 * Az élő nézet számára megpróbálja objektummá alakítani
 * a store-ban JSON-stringként tárolt Tiptap dokumentumot.
 *
 * A régi, még nem migrált egyszerű szöveget változatlanul
 * jeleníti meg.
 */
function parseBlockContentForPreview(
  content: string,
): unknown {
  if (content.trim().length === 0) {
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
        },
      ],
    };
  }

  try {
    return JSON.parse(content) as unknown;
  } catch {
    return {
      legacyText: content,
    };
  }
}
