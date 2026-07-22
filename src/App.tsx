import { AppLayout } from './components/AppLayout';
import { DocumentTree } from './components/DocumentTree';
import { EditorPane } from './components/EditorPane';
import { PropertiesPanel } from './components/PropertiesPanel';

export function App() {
  return (
    <AppLayout>
      <div className="workspace">
        <DocumentTree />
        <EditorPane />
        <PropertiesPanel />
      </div>
    </AppLayout>
  );
}
