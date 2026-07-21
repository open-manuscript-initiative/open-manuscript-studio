import {useStudioStore} from '../app/useStudioStore';
import {BlockEditor} from './BlockEditor';

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
    ) ??
    manuscript.sections[0];

  return (
    <main
      className="panel editor"
      aria-label="Manuscript editor"
    >
      <label
        className="field-label"
        htmlFor="manuscript-title"
      >
        Title
      </label>

      <input
        id="manuscript-title"
        className="title-input"
        value={manuscript.title}
        onChange={(event) => setTitle(event.target.value)}
      />

      {section ? (
        <section className="section-editor">
          <h2>{section.title}</h2>

          {section.blocks.map((block) => (
            <BlockEditor
              key={block.id}
              blockId={block.id}
              blockType={block.type}
              content={block.content}
              onUpdate={updateBlock}
            />
          ))}
        </section>
      ) : (
        <p>No section selected.</p>
      )}
    </main>
  );
}
