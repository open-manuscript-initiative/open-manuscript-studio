import { Header } from './components/Header';
import { DocumentTree } from './components/DocumentTree';
import { EditorPane } from './components/EditorPane';
import { PropertiesPanel } from './components/PropertiesPanel';
import { Footer } from './components/Footer';

export function App() {
  return (
    <div
      className="app-shell"
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}
    >
      <Header />

      <div
        className="workspace"
        style={{
          flex: 1,
        }}
      >
        <DocumentTree />
        <EditorPane />
        <PropertiesPanel />
      </div>

      <Footer />
    </div>
  );
}
