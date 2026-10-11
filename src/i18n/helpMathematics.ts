import type { HelpCopy, HelpTopic } from './help';

const topics: Partial<Record<string, HelpTopic>> = {
  hu: {
    title: 'Matematikai modul és LaTeX-képletek',
    body: 'A Beállításokban kapcsolja be a Matematika modult. Új képletet a Modulok nézetben vagy a Beszúrás → Kutatási modulok → Matematika részen készíthet. A sablonok törteket, gyököket, indexeket, összegeket, integrálokat, mátrixokat, eseteket és egyenletrendszereket segítenek beírni. Az előnézet és a HTML/JATS export ugyanazt a MathML-feldolgozót használja. Hibás vagy nem támogatott parancs esetén a beszúrás nem engedélyezett; meglévő képlet szerkesztésekor az eredeti szöveg megmarad, és hibaüzenet jelenik meg.',
    tips: ['Csak a képletet adja meg, $ határolók és teljes LaTeX-dokumentum nélkül. Együttes indexhez például x_i^2 használható.', 'A már beszúrt képlet a modul kikapcsolása után is megmarad és helyben szerkeszthető. Ez képletszerkesztő, nem szimbolikus számoló vagy teljes LaTeX-fordító.'],
  },
  en: {
    title: 'Mathematics module and LaTeX equations',
    body: 'Enable Mathematics in Settings. Create an equation in Modules or Insert → Research modules → Mathematics. Templates help enter fractions, roots, scripts, sums, integrals, matrices, cases and aligned equations. Preview and HTML/JATS export share the same MathML renderer. Invalid or unsupported commands prevent insertion; editing an existing equation retains its source and shows a diagnostic rather than silently changing the expression.',
    tips: ['Enter the expression without $ delimiters or a complete LaTeX document. For simultaneous scripts, try x_i^2.', 'Inserted equations remain editable when the module is disabled. This is an equation editor, not symbolic computation or a full LaTeX compiler.'],
  },
  de: {
    title: 'Mathematikmodul und LaTeX-Formeln',
    body: 'Aktivieren Sie Mathematik in den Einstellungen. Erstellen Sie Formeln unter Module oder Einfügen → Forschungsmodule → Mathematik. Vorlagen helfen bei Brüchen, Wurzeln, Indizes, Summen, Integralen, Matrizen, Fallunterscheidungen und Gleichungssystemen. Vorschau und HTML/JATS-Export nutzen denselben MathML-Renderer. Ungültige oder nicht unterstützte Befehle verhindern das Einfügen. Bei vorhandenen Formeln bleiben Quelltext und Fehlermeldung erhalten.',
    tips: ['Geben Sie nur den Ausdruck ohne $-Begrenzer oder vollständiges LaTeX-Dokument ein. Gleichzeitige Indizes sind beispielsweise x_i^2.', 'Eingefügte Formeln bleiben nach Deaktivierung des Moduls bearbeitbar. Dies ist ein Formeleditor, kein symbolischer Rechner oder vollständiger LaTeX-Compiler.'],
  },
};

export function appendMathematicsHelp(locale: string, copy: HelpCopy): HelpCopy {
  const topic = topics[locale];
  return topic && !copy.topics.some((existing) => existing.title === topic.title)
    ? { ...copy, topics: [...copy.topics, topic] } : copy;
}
