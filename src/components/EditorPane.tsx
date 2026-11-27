import { useStudioStore } from '../app/useStudioStore';
import { useAuthoringViewSuspended } from '../editor/publicationEditorActivity';
import { useTranslation } from '../i18n';
import type { OjsLaunchPayload } from '../integrations/ojs/importOjsLaunch';
import { ContinuousManuscriptEditor } from './ContinuousManuscriptEditor';
import { EmbeddedTableOfContents } from './EmbeddedTableOfContents';
import { EditorZoomControl } from './EditorZoomControl';
import { VolumeFrontMatterEditor } from './VolumeFrontMatterEditor';

type OjsContributors = NonNullable<OjsLaunchPayload['contributors']>;

interface EditorPaneProps {
  ojsContributors?: OjsContributors;
}

export function EditorPane({ ojsContributors = [] }: EditorPaneProps) {
  const { t } = useTranslation();
  const suspended = useAuthoringViewSuspended();
  const sectionCount = useStudioStore((state) => state.manuscript.sections.length);

  return (
    <section
      className="editor omi-studio-editor focus-editor omi-continuous-manuscript"
      aria-label={t('studio.editorAria')}
      inert={suspended || undefined}
      data-authoring-suspended={String(suspended)}
    >
      <section
        className="omi-writing-pane focus-writing-pane omi-document-canvas"
        aria-label={t('studio.editorAria')}
      >
        <article className="omi-manuscript-page">
          <VolumeFrontMatterEditor ojsContributors={ojsContributors} />

          <EmbeddedTableOfContents />

          <div className="omi-continuous-sections">
            <div className="omi-continuous-blocks">
              {sectionCount === 0 ? (
                <p className="omi-empty-section">{t('studio.noSection')}</p>
              ) : null}
              <ContinuousManuscriptEditor suspended={suspended} />
            </div>
          </div>
        </article>
      </section>
      <EditorZoomControl />
    </section>
  );
}
