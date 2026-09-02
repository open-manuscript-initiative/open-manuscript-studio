import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { ContributorEditor } from './ContributorEditor';

/** Menu wrapper for contributors attached to the complete volume. */
export function PropertiesPanel() {
  const { t } = useTranslation();
  const manuscriptId = useStudioStore((state) => state.manuscript.id);

  return (
    <aside className="panel properties omi-properties-panel">
      <ContributorEditor
        targetId={manuscriptId}
        title={t('manuscript.contributors')}
        description={t('contributors.description')}
      />
    </aside>
  );
}
