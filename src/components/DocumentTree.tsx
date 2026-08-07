import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { formatSectionHeading } from '../model/sectionNumbering';

interface DocumentTreeProps {
  onNavigate?: () => void;
}

export function DocumentTree({
  onNavigate,
}: DocumentTreeProps) {
  const { t } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectedSectionId = useStudioStore(
    (state) => state.selectedSectionId,
  );
  const selectSection = useStudioStore(
    (state) => state.selectSection,
  );

  return (
    <aside
      className="panel sidebar studio-document-tree"
      aria-label={t('studio.document.title')}
    >
      <div className="tree-group-title">
        {t('studio.document.sections')}
      </div>

      {manuscript.sections.map((section, index) => (
        <button
          key={section.id}
          type="button"
          className={
            section.id === selectedSectionId
              ? 'tree-item active'
              : 'tree-item'
          }
          onClick={() => {
            selectSection(section.id);
            onNavigate?.();
          }}
        >
          {formatSectionHeading(
            section.title || t('editor.untitledSection'),
            index,
            manuscript.sectionNumberingStyle,
          )}
        </button>
      ))}

      <div className="tree-group-title">
        {t('studio.document.objects')}
      </div>
      <div className="tree-item muted">
        {t('studio.document.annotations')}: {manuscript.annotations.length}
      </div>
      <div className="tree-item muted">
        {t('studio.document.citations')}: {manuscript.citations.length}
      </div>
    </aside>
  );
}
