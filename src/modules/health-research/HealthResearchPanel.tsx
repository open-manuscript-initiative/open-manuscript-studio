import { downloadWorkspaceJson, safeWorkspaceFileName, useLocalWorkspace } from '../disciplineWorkspace';
import { commonFields, createHealthWorkspace, disciplineFields, isHealthWorkspace, type HealthDiscipline } from './model';
import { healthCopy, healthFieldLabels } from './copy';
import '../disciplineWorkspaces.css';

export function HealthResearchPanel({ discipline, locale, storageKey }: { discipline: HealthDiscipline; locale: string; storageKey: string }) {
  const language = locale === 'hu' || locale === 'de' ? locale : 'en';
  const t = healthCopy[language];
  const [workspace, setWorkspace] = useLocalWorkspace(storageKey, () => createHealthWorkspace(discipline), value => isHealthWorkspace(value, discipline));
  return <main className="discipline-workspace">
    <header className="discipline-workspace__header"><h1>{t[discipline]}</h1>
      <button type="button" onClick={() => downloadWorkspaceJson(safeWorkspaceFileName(workspace.fields.title, discipline) + '.json', workspace)}>{t.export}</button>
    </header>
    <p className="discipline-workspace__hint">{t.notice}</p>
    <p>{t.shared}</p>
    <section className="discipline-workspace__section"><div className="discipline-workspace__grid">
      {[...commonFields, ...disciplineFields[discipline]].map(field => <label key={field}>{healthFieldLabels[field][language]}
        <textarea rows={field === 'publicSummary' ? 5 : 2} value={workspace.fields[field]} onChange={event => {
          const text = event.target.value;
          setWorkspace(current => ({ ...current, fields: { ...current.fields, [field]: text } }));
        }} />
      </label>)}
    </div></section>
    <p className="discipline-workspace__hint">{t.projection}</p>
  </main>;
}
