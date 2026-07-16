import { Header } from './components/Header';
import { DocumentTree } from './components/DocumentTree';
import { EditorPane } from './editor/EditorPane';
import { PropertiesPanel } from './components/PropertiesPanel';

export function App() {
  return (
    <div className="app-shell">
      <Header />
      <div className="workspace">
        <DocumentTree />
        <EditorPane />
        <PropertiesPanel />
      </div>
    </div>
  );
}
