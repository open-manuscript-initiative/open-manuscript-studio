import { useStudioStore } from '../app/useStudioStore';
import { PropertiesPanel } from './components/PropertiesPanel';
export function PropertiesPanel() {
  const manuscript = useStudioStore((state) => state.manuscript);
  const setAbstract = useStudioStore((state) => state.setAbstract);

  return (
    <aside className="panel properties" aria-label="Properties">
      <h2>Properties</h2>
      <div className="property-card">
        <h3>Manuscript metadata</h3>
        <p><strong>Schema:</strong> OMI 0.1</p>
        <p><strong>Locale:</strong> {manuscript.locale}</p>
        <p><strong>Authors:</strong> {manuscript.authors.length}</p>
      </div>
      <label className="field-label" htmlFor="abstract">Abstract</label>
      <textarea
        id="abstract"
        className="abstract-editor"
        value={manuscript.abstract ?? ''}
        onChange={(event) => setAbstract(event.target.value)}
      />
      <div className="property-card">
        <h3>Publisher profile</h3>
        <p>Default scholarly profile. Rendering rules will be added in Alpha 0.2.</p>
      </div>
      <div className="property-card">
        <h3>Annotation rendering</h3>
        <p>Footnote, endnote, margin note and popup targets are reserved in the model.</p>
      </div>
    </aside>
  );
}
<div className="workspace">
  <DocumentTree />
  <EditorPane />
  <PropertiesPanel />
</div>
