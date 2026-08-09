import {
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';

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

interface AutoGrowHeadingProps {
  id?: string;
  className: string;
  value: string;
  ariaLabel: string;
  placeholder: string;
  onChange: (value: string) => void;
}

/**
 * A semantic single-value heading field that visually behaves like document
 * text. The textarea soft-wraps long headings and grows with their rendered
 * height, while Enter is suppressed so line breaks are not stored in title
 * metadata accidentally.
 */
function AutoGrowHeading({
  id,
  className,
  value,
  ariaLabel,
  placeholder,
  onChange,
}: AutoGrowHeadingProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  };

  useLayoutEffect(() => {
    resize();
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value.replace(/[\r\n]+/g, ' '));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
    }
  };

  return (
    <textarea
      ref={ref}
      id={id}
      className={className}
      rows={1}
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onInput={resize}
    />
  );
}

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

            <AutoGrowHeading
              id="manuscript-title"
              className="title-input omi-document-title omi-auto-grow-heading"
              value={manuscript.title}
              ariaLabel={t('manuscript.documentTitle')}
              onChange={setTitle}
              placeholder={t('studio.titlePlaceholder')}
            />

            <label className="omi-visually-hidden" htmlFor="manuscript-subtitle">
              {frontMatterCopy.subtitleOptional}
            </label>
            <AutoGrowHeading
              id="manuscript-subtitle"
              className="omi-subtitle-input omi-document-subtitle omi-auto-grow-heading"
              value={manuscript.subtitle ?? ''}
              ariaLabel={frontMatterCopy.subtitleOptional}
              onChange={stageSubtitleChange}
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

                      <AutoGrowHeading
                        className="omi-section-title-input omi-auto-grow-heading"
                        value={section.title}
                        ariaLabel={t('studio.document.sections')}
                        placeholder={t('editor.untitledSection')}
                        onChange={(value) =>
                          stageSectionTitleChange(section.id, value)
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
