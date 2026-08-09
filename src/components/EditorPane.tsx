import {
  stageMottoChange,
  stageSubtitleChange,
} from '../app/manuscriptFrontMatterActions';
import { stageSectionTitleChange } from '../app/sectionActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getFrontMatterCopy } from '../i18n/frontMatter';
import {
  collectCrossReferenceTargets,
  formatCrossReferenceLabel,
} from '../model/crossReferences';
import { formatHierarchicalSectionNumber } from '../model/sectionNumbering';
import { isVisualBlock } from '../model/visualBlocks';
import { BlockEditor } from './BlockEditor';
import { VisualBlockEditor } from './VisualBlockEditor';

/**
 * Continuous manuscript editor.
 *
 * The Studio deliberately renders the manuscript as one uninterrupted writing
 * surface. The OMI block/section model remains intact underneath, so export,
 * citations, notes, annotations and cross references keep their semantic
 * identity while the author gets a word-processor-like reading and writing
 * experience.
 */
export function EditorPane() {
  const { t, locale } = useTranslation();
  const frontMatterCopy = getFrontMatterCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const setTitle = useStudioStore((state) => state.setTitle);
  const updateBlock = useStudioStore((state) => state.updateBlock);

  const crossReferenceTargets = collectCrossReferenceTargets(manuscript);
  const targetMap = new Map(
    crossReferenceTargets.map((target) => [target.id, target]),
  );

  return (
    <section
      className="editor omi-studio-editor focus-editor omi-continuous-manuscript"
      aria-label={t('studio.editorAria')}
    >
      <section
        className="omi-writing-pane focus-writing-pane omi-document-canvas"
        aria-label={t('studio.editorAria')}
      >
        <article className="omi-manuscript-page">
          <header className="omi-editor-header omi-continuous-front-matter">
            <label className="omi-visually-hidden" htmlFor="manuscript-title">
              {t('manuscript.documentTitle')}
            </label>

            <input
              id="manuscript-title"
              className="title-input omi-document-title"
              value={manuscript.title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t('studio.titlePlaceholder')}
            />

            <label className="omi-visually-hidden" htmlFor="manuscript-subtitle">
              {frontMatterCopy.subtitleOptional}
            </label>
            <input
              id="manuscript-subtitle"
              className="omi-subtitle-input omi-document-subtitle"
              value={manuscript.subtitle ?? ''}
              onChange={(event) => stageSubtitleChange(event.target.value)}
              placeholder={frontMatterCopy.subtitlePlaceholder}
            />

            <label className="omi-visually-hidden" htmlFor="manuscript-motto">
              {frontMatterCopy.mottoOptional}
            </label>
            <textarea
              id="manuscript-motto"
              className="omi-motto-input omi-document-motto"
              rows={2}
              value={manuscript.motto ?? ''}
              onChange={(event) => stageMottoChange(event.target.value)}
              placeholder={frontMatterCopy.mottoPlaceholder}
            />
          </header>

          <div className="omi-continuous-sections">
            {manuscript.sections.length > 0 ? (
              manuscript.sections.map((section) => {
                const sectionNumber = formatHierarchicalSectionNumber(
                  manuscript.sections,
                  section.id,
                  manuscript.sectionNumberingStyle,
                );

                return (
                  <section
                    className="omi-section-editor omi-continuous-section"
                    key={section.id}
                    data-section-id={section.id}
                  >
                    <div
                      className="omi-section-title-row omi-continuous-section-title"
                      id={`omi-target-${section.id}`}
                      data-cross-reference-target="section"
                    >
                      {sectionNumber ? (
                        <span className="omi-section-number" aria-hidden="true">
                          {sectionNumber}
                        </span>
                      ) : null}

                      <input
                        className="omi-section-title-input"
                        value={section.title}
                        aria-label={t('studio.document.sections')}
                        placeholder={t('editor.untitledSection')}
                        onChange={(event) =>
                          stageSectionTitleChange(section.id, event.target.value)
                        }
                      />
                    </div>

                    <div className="omi-continuous-blocks">
                      {section.blocks.map((block, blockIndex) => {
                        const target = targetMap.get(block.id);

                        return isVisualBlock(block) ? (
                          <div
                            className="omi-numbered-object omi-continuous-visual"
                            id={`omi-target-${block.id}`}
                            data-cross-reference-target={target?.kind}
                            key={block.id}
                          >
                            {target ? (
                              <div className="omi-numbered-object-label">
                                {formatCrossReferenceLabel(
                                  {
                                    targetId: target.id,
                                    displayStyle: 'label-number',
                                  },
                                  target,
                                  manuscript.locale,
                                )}
                              </div>
                            ) : null}

                            <VisualBlockEditor
                              block={block}
                              sectionId={section.id}
                              blockIndex={blockIndex}
                            />
                          </div>
                        ) : (
                          <BlockEditor
                            key={block.id}
                            blockId={block.id}
                            blockType={block.type}
                            content={block.content}
                            onUpdate={updateBlock}
                          />
                        );
                      })}
                    </div>
                  </section>
                );
              })
            ) : (
              <p className="omi-empty-section">{t('studio.noSection')}</p>
            )}
          </div>
        </article>
      </section>
    </section>
  );
}
