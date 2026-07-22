import { useStudioStore } from '../store/useStudioStore';

export function PropertiesPanel() {
  const manuscript = useStudioStore(
    (state) => state.manuscript,
  );

  const selectedSectionId = useStudioStore(
    (state) => state.selectedSectionId,
  );

  const selectedSection =
    manuscript.sections.find(
      (section) =>
        section.id === selectedSectionId,
    ) ?? null;

  return (
    <aside className="omi-properties-panel">
      <div className="omi-properties-panel-header">
        <h2>Properties</h2>
      </div>

      <div className="omi-properties-panel-content">
        <div className="omi-property-group">
          <span className="omi-property-label">
            Manuscript title
          </span>

          <span className="omi-property-value">
            {manuscript.title || 'Untitled manuscript'}
          </span>
        </div>

        <div className="omi-property-group">
          <span className="omi-property-label">
            Language
          </span>

          <span className="omi-property-value">
            {manuscript.language || 'Not specified'}
          </span>
        </div>

        <div className="omi-property-group">
          <span className="omi-property-label">
            Selected section
          </span>

          <span className="omi-property-value">
            {selectedSection?.title ||
              'No section selected'}
          </span>
        </div>

        <div className="omi-property-group">
          <span className="omi-property-label">
            Sections
          </span>

          <span className="omi-property-value">
            {manuscript.sections.length}
          </span>
        </div>
      </div>
    </aside>
  );
}
