import { BookA } from 'lucide-react';
import { useMemo } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { groupIndexEntries } from '../model/indexing';

const labels: Record<string, {
  title: string;
  description: string;
  empty: string;
  entries: string;
  occurrences: string;
  imported: string;
}> = {
  en: {
    title: 'Name index',
    description: 'Semantic index entries preserved from Word XE fields. The generated list updates from the stored markers instead of becoming ordinary text.',
    empty: 'No index markers are stored in this manuscript.',
    entries: 'Index entries',
    occurrences: 'occurrences',
    imported: 'Imported generated index',
  },
  hu: {
    title: 'Névmutató',
    description: 'A Word XE mezőiből megőrzött szemantikus névmutató-bejegyzések. A lista a tárolt jelölésekből generálható újra, nem közönséges szövegként tárolódik.',
    empty: 'A kézirat nem tartalmaz névmutató-jelöléseket.',
    entries: 'Névmutató-bejegyzések',
    occurrences: 'előfordulás',
    imported: 'Importált generált névmutató',
  },
  de: {
    title: 'Personenregister',
    description: 'Semantische Registereinträge aus Word-XE-Feldern. Das Register kann aus den gespeicherten Markierungen neu erzeugt werden und bleibt strukturiert.',
    empty: 'Dieses Manuskript enthält keine Registermarkierungen.',
    entries: 'Registereinträge',
    occurrences: 'Vorkommen',
    imported: 'Importiertes generiertes Register',
  },
};

export function IndexPanel() {
  const { locale } = useTranslation();
  const copy = labels[locale] ?? labels.en;
  const manuscript = useStudioStore((state) => state.manuscript);
  const entries = manuscript.indexEntries ?? [];
  const generatedIndexes = manuscript.generatedIndexes ?? [];
  const groups = useMemo(() => groupIndexEntries(entries), [entries]);

  return (
    <section className="studio-menu-view omi-index-panel">
      <div className="studio-menu-view-header">
        <div>
          <h3>
            <BookA size={18} aria-hidden="true" />
            {copy.title}
          </h3>
          <p>{copy.description}</p>
        </div>
        <span className="omi-notes-count">{entries.length}</span>
      </div>

      {generatedIndexes.length > 0 ? (
        <div className="studio-tool-card">
          <div>
            <strong>{copy.imported}</strong>
            <p>{generatedIndexes.length}</p>
          </div>
        </div>
      ) : null}

      {groups.length === 0 ? (
        <div className="omi-notes-empty">
          <BookA size={22} aria-hidden="true" />
          <p>{copy.empty}</p>
        </div>
      ) : (
        <div className="omi-notes-list" aria-label={copy.entries}>
          {groups.map((group) => (
            <div key={group.key} className="omi-note-editor-card omi-note-editor-card--compact">
              <span className="omi-note-editor-header">
                <strong>{group.label}</strong>
              </span>
              <span className="omi-note-meta">
                {group.count} {copy.occurrences}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
