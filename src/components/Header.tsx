import { Download, FilePlus2, RotateCcw } from 'lucide-react';
import { useStudioStore } from '../app/useStudioStore';
import { downloadOmiJson } from '../services/exportOmi';

export function Header() {
  const addSection = useStudioStore((state) => state.addSection);
  const checkpoint = useStudioStore((state) => state.checkpoint);
  const resetSample = useStudioStore((state) => state.resetSample);

  function exportManuscript(): void {
    checkpoint('export');
    downloadOmiJson(useStudioStore.getState().manuscript);
  }

  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">Open Manuscript Initiative</p>
        <h1>Open Manuscript Studio</h1>
      </div>
      <nav className="header-actions" aria-label="Studio actions">
        <button type="button" onClick={addSection}>
          <FilePlus2 size={18} /> New section
        </button>
        <button type="button" onClick={resetSample}>
          <RotateCcw size={18} /> Reset sample
        </button>
        <button
          type="button"
          className="primary"
          onClick={exportManuscript}
        >
          <Download size={18} /> Export .omi.json
        </button>
      </nav>
    </header>
  );
}
