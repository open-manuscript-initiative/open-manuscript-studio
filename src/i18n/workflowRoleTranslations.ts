import type { WorkflowRole } from '../model/workflowRole';

interface WorkflowRoleCopy {
  preference: string; hint: string; current: string; showAll: string; focused: string;
  sources: Record<'profile' | 'ojs' | 'omp', string>;
  roles: Record<WorkflowRole, string>;
}

export function getWorkflowRoleCopy(locale: string): WorkflowRoleCopy {
  if (locale === 'hu') return {
    preference: 'Alapértelmezett munkaszerep',
    hint: 'A munkaszerep az eszközök megjelenítését egyszerűsíti. OJS/OMP-megnyitáskor az adott kézirathoz kapott szerep az irányadó. A jogosultságokat a megbízás határozza meg.',
    current: 'Munkaszerep', showAll: 'Összes eszköz megjelenítése', focused: 'Szerephez igazított eszközök',
    sources: { profile: 'Profil szerinti beállítás', ojs: 'Az OJS-ből megnyitott kézirat szerepe', omp: 'Az OMP-ből megnyitott kézirat szerepe' },
    roles: { general: 'Teljes munkafelület', author: 'Szerző', editor: 'Szerkesztő', reviewer: 'Tudományos lektor', translator: 'Fordító', copyeditor: 'Nyelvi lektor', 'layout-editor': 'Tördelőszerkesztő' },
  };
  if (locale === 'de') return {
    preference: 'Bevorzugte Arbeitsrolle',
    hint: 'Die Arbeitsrolle vereinfacht die Werkzeugauswahl. Beim Öffnen aus OJS/OMP gilt die Rolle des jeweiligen Manuskripts. Berechtigungen richten sich nach dem Auftrag.',
    current: 'Arbeitsrolle', showAll: 'Alle Werkzeuge anzeigen', focused: 'Rollenspezifische Werkzeuge',
    sources: { profile: 'Profileinstellung', ojs: 'Rolle für dieses OJS-Manuskript', omp: 'Rolle für dieses OMP-Manuskript' },
    roles: { general: 'Vollständiger Arbeitsbereich', author: 'Autor/in', editor: 'Redakteur/in', reviewer: 'Wissenschaftliche Begutachtung', translator: 'Übersetzer/in', copyeditor: 'Sprachlektorat', 'layout-editor': 'Layoutredaktion' },
  };
  return {
    preference: 'Preferred working role',
    hint: 'Your working role simplifies the tools shown. When opening from OJS/OMP, the role supplied for that manuscript takes precedence. Permissions come from the assignment.',
    current: 'Working role', showAll: 'Show all tools', focused: 'Role-focused tools',
    sources: { profile: 'Profile preference', ojs: 'Role for this OJS manuscript', omp: 'Role for this OMP manuscript' },
    roles: { general: 'Full workspace', author: 'Author', editor: 'Editor', reviewer: 'Scientific reviewer', translator: 'Translator', copyeditor: 'Language reviewer', 'layout-editor': 'Layout editor' },
  };
}
