import { useStudioStore } from '../app/useStudioStore';

export function DocumentTree() {
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectedSectionId = useStudioStore((state) => state.selectedSectionId);
  const selectSection = useStudioStore((state) => state.selectSection);

  return (
    <aside className="panel sidebar" aria-label="Document tree">
      <h2>Document</h2>
      <div className="tree-item strong">Metadata</div>
      <div className="tree-item strong">Authors</div>
      <div className="tree-group-title">Sections</div>
      {manuscript.sections.map((section, index) => (
        <button
          key={section.id}
          type="button"
          className={section.id === selectedSectionId ? 'tree-item active' : 'tree-item'}
          onClick={() => selectSection(section.id)}
        >
          {index + 1}. {section.title}
        </button>
      ))}
      <div className="tree-group-title">Objects</div>
      <div className="tree-item muted">Annotations: {manuscript.annotations.length}</div>
      <div className="tree-item muted">Citations: {manuscript.citations.length}</div>
    </aside>
  );
}
