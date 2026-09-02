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
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getFrontMatterCopy } from '../i18n/frontMatter';
import type { OjsLaunchPayload } from '../integrations/ojs/importOjsLaunch';
import { ContinuousManuscriptEditor } from './ContinuousManuscriptEditor';
import { EmbeddedTableOfContents } from './EmbeddedTableOfContents';

type OjsContributors = NonNullable<OjsLaunchPayload['contributors']>;

interface EditorPaneProps {
  ojsContributors?: OjsContributors;
}

interface AutoGrowHeadingProps {
  id?: string;
  className: string;
  value: string;
  ariaLabel: string;
  placeholder: string;
  onChange: (value: string) => void;
}

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

function OjsContributorPanel({ contributors }: { contributors: OjsContributors }) {
  if (!contributors.length) return null;

  return (
    <section className="omi-ojs-contributors" aria-label="OJS contributors">
      <h2>Contributors</h2>
      <div className="omi-ojs-contributor-list">
        {contributors.map((contributor, index) => {
          const name = [contributor.name?.given, contributor.name?.family]
            .filter(Boolean)
            .join(' ') || `Contributor ${index + 1}`;
          const orcid = contributor.identifiers?.find(
            (identifier) => identifier.scheme?.toLowerCase() === 'orcid',
          )?.value;

          return (
            <article
              className="omi-ojs-contributor-card"
              key={contributor.externalId ?? `${name}-${index}`}
            >
              <strong>{name}</strong>
              {contributor.primaryContact ? <span> · Corresponding author</span> : null}
              {contributor.email ? <div>{contributor.email}</div> : null}
              {contributor.affiliation ? <div>{contributor.affiliation}</div> : null}
              {orcid ? <div>ORCID: {orcid}</div> : null}
              {contributor.country ? <div>{contributor.country}</div> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function EditorPane({ ojsContributors = [] }: EditorPaneProps) {
  const { t, locale } = useTranslation();
  const frontMatterCopy = getFrontMatterCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const setTitle = useStudioStore((state) => state.setTitle);

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

            <OjsContributorPanel contributors={ojsContributors} />
          </header>

          <EmbeddedTableOfContents />

          <div className="omi-continuous-sections">
            <div className="omi-continuous-blocks">
              {manuscript.sections.length === 0 ? (
                <p className="omi-empty-section">{t('studio.noSection')}</p>
              ) : null}
              <ContinuousManuscriptEditor />
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}
