import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { BlockEditor } from './BlockEditor';

export function EditorPane() {
  const { t } = useTranslation();
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

  return (
    <section
      className="editor omi-studio-editor focus-editor"
      aria-label={t('studio.editorAria')}
    >
      <header className="omi-editor-header focus-editor-header">
        <label
          className="field-label"
          htmlFor="manuscript-title"
        >
          {t('manuscript.documentTitle')}
        </label>

        <input
          id="manuscript-title"
          className="title-input"
          value={manuscript.title}
          onChange={(event) =>
            setTitle(event.target.value)
          }
          placeholder={t('studio.titlePlaceholder')}
        />
      </header>

      <section
        className="omi-writing-pane focus-writing-pane"
        aria-label={t('studio.editorAria')}
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
            {t('studio.noSection')}
          </p>
        )}
      </section>
    </section>
  );
}
