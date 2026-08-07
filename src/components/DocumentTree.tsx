import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { formatHierarchicalSectionHeading } from '../model/sectionNumbering';
import { buildSectionOutline } from '../model/sectionStructure';

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
  const outline = buildSectionOutline(manuscript.sections);

  return (
    <aside
      className="panel sidebar studio-document-tree"
      aria-label={t('studio.document.title')}
    >
      <div className="tree-group-title">
        {t('studio.document.sections')}
      </div>

      {outline.map(({ section, depth }) => (
        <button
          key={section.id}
          type="button"
          className={
            section.id === selectedSectionId
              ? 'tree-item active'
              : 'tree-item'
          }
          style={{ paddingInlineStart: `${0.75 + depth * 1.1}rem` }}
          onClick={() => {
            selectSection(section.id);
            onNavigate?.();
          }}
        >
          {formatHierarchicalSectionHeading(
            section.title || t('editor.untitledSection'),
            manuscript.sections,
            section.id,
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
