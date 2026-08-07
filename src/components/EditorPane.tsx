import { Fragment } from 'react';

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
import { VisualInsertMenu } from './VisualInsertMenu';

export function EditorPane() {
  const { t, locale } = useTranslation();
  const frontMatterCopy = getFrontMatterCopy(locale);
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
  const sectionNumber = section
    ? formatHierarchicalSectionNumber(
        manuscript.sections,
        section.id,
        manuscript.sectionNumberingStyle,
      )
    : '';
  const crossReferenceTargets = collectCrossReferenceTargets(manuscript);
  const targetMap = new Map(
    crossReferenceTargets.map((target) => [target.id, target]),
  );

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

        <div className="omi-front-matter-fields">
          <label className="omi-front-matter-field" htmlFor="manuscript-subtitle">
            <span>{frontMatterCopy.subtitleOptional}</span>
            <input
              id="manuscript-subtitle"
              className="omi-subtitle-input"
              value={manuscript.subtitle ?? ''}
              onChange={(event) => stageSubtitleChange(event.target.value)}
              placeholder={frontMatterCopy.subtitlePlaceholder}
            />
          </label>

          <label className="omi-front-matter-field omi-front-matter-field--motto" htmlFor="manuscript-motto">
            <span>{frontMatterCopy.mottoOptional}</span>
            <textarea
              id="manuscript-motto"
              className="omi-motto-input"
              rows={2}
              value={manuscript.motto ?? ''}
              onChange={(event) => stageMottoChange(event.target.value)}
              placeholder={frontMatterCopy.mottoPlaceholder}
            />
          </label>
        </div>
      </header>

      <section
        className="omi-writing-pane focus-writing-pane"
        aria-label={t('studio.editorAria')}
      >
        {section ? (
          <div className="omi-section-editor">
            <div
              className="omi-section-title-row"
              id={`omi-target-${section.id}`}
              data-cross-reference-target="section"
            >
              {sectionNumber ? (
                <span
                  className="omi-section-number"
                  aria-hidden="true"
                >
                  {sectionNumber}
                </span>
              ) : null}

              <input
                className="omi-section-title-input"
                value={section.title}
                aria-label={t('studio.document.sections')}
                placeholder={t('editor.untitledSection')}
                onChange={(event) =>
                  stageSectionTitleChange(
                    section.id,
                    event.target.value,
                  )
                }
              />
            </div>

            {section.blocks.map((block, blockIndex) => {
              const target = targetMap.get(block.id);

              return (
                <Fragment key={block.id}>
                  <VisualInsertMenu
                    sectionId={section.id}
                    gapIndex={blockIndex}
                  />

                  {isVisualBlock(block) ? (
                    <div
                      className="omi-numbered-object"
                      id={`omi-target-${block.id}`}
                      data-cross-reference-target={target?.kind}
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
                      blockId={block.id}
                      blockType={block.type}
                      content={block.content}
                      onUpdate={updateBlock}
                    />
                  )}
                </Fragment>
              );
            })}

            <VisualInsertMenu
              sectionId={section.id}
              gapIndex={section.blocks.length}
            />
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
