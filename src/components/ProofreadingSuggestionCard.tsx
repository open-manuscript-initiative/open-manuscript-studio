import type { ProofreadingIssue } from '../services/proofreadingApi';

interface ProofreadingSuggestionCardProps {
  issue: ProofreadingIssue;
  locale: string;
  onApply: (replacement: string) => void;
  onIgnore: () => void;
  onClose: () => void;
}

export function ProofreadingSuggestionCard({
  issue,
  locale,
  onApply,
  onIgnore,
  onClose,
}: ProofreadingSuggestionCardProps) {
  const copy = getCopy(locale);
  return (
    <aside className="omi-proofreading-card" role="dialog" aria-label={copy.title}>
      <header>
        <div>
          <strong>{copy.title}</strong>
          <span className={`omi-proofreading-category omi-proofreading-category--${issue.category}`}>
            {copy.categories[issue.category]}
          </span>
        </div>
        <button type="button" onClick={onClose} aria-label={copy.close} title={copy.close}>×</button>
      </header>
      <p>{issue.message}</p>
      {issue.replacements.length ? (
        <div className="omi-proofreading-replacements">
          {issue.replacements.map((replacement) => (
            <button
              type="button"
              className="studio-menu-secondary-action"
              key={replacement}
              onClick={() => onApply(replacement)}
            >
              {replacement}
            </button>
          ))}
        </div>
      ) : <small>{copy.noReplacement}</small>}
      <footer>
        <button type="button" className="studio-menu-secondary-action" onClick={onIgnore}>
          {copy.ignore}
        </button>
      </footer>
    </aside>
  );
}

function getCopy(locale: string) {
  if (locale === 'hu') {
    return {
      title: 'Nyelvi javaslat',
      close: 'Bezárás',
      ignore: 'Mellőzés',
      noReplacement: 'Ehhez a találathoz nincs automatikus cserejavaslat.',
      categories: {
        spelling: 'Helyesírás',
        grammar: 'Nyelvtan',
        punctuation: 'Központozás',
        style: 'Stílus',
      },
    } as const;
  }
  if (locale === 'de') {
    return {
      title: 'Sprachvorschlag',
      close: 'Schließen',
      ignore: 'Ignorieren',
      noReplacement: 'Für diesen Fund gibt es keinen automatischen Ersatzvorschlag.',
      categories: {
        spelling: 'Rechtschreibung',
        grammar: 'Grammatik',
        punctuation: 'Zeichensetzung',
        style: 'Stil',
      },
    } as const;
  }
  return {
    title: 'Language suggestion',
    close: 'Close',
    ignore: 'Ignore',
    noReplacement: 'No automatic replacement is available for this issue.',
    categories: {
      spelling: 'Spelling',
      grammar: 'Grammar',
      punctuation: 'Punctuation',
      style: 'Style',
    },
  } as const;
}
