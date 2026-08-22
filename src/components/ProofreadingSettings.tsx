import { useTranslation } from '../i18n';
import {
  setSpellcheckEnabled,
  useProofreadingPreferences,
} from '../editor/proofreadingPreferences';

export function ProofreadingSettings() {
  const { locale } = useTranslation();
  const { spellcheckEnabled } = useProofreadingPreferences();
  const copy = locale === 'hu'
    ? {
        title: 'Helyesírás és nyelvi ellenőrzés',
        description: 'A szerkesztő a kézirat nyelvét adja át a rendszer helyesírás-ellenőrzőjének.',
        spellcheck: 'Helyesírás-ellenőrzés',
        spellcheckDescription: 'Jelölje a rendszer a lehetséges elírásokat és az adott platform által támogatott nyelvi hibákat gépelés közben.',
        grammarNote: 'A fejlettebb nyelvhelyességi ellenőrzés külön szolgáltatói rétegen keresztül kerül beépítésre, mert a támogatás nyelvenként eltér.',
      }
    : locale === 'de'
      ? {
          title: 'Rechtschreibung und Sprachprüfung',
          description: 'Der Editor übergibt die Manuskriptsprache an die systemeigene Rechtschreibprüfung.',
          spellcheck: 'Rechtschreibprüfung',
          spellcheckDescription: 'Mögliche Tippfehler und vom jeweiligen System unterstützte Sprachfehler während der Eingabe markieren.',
          grammarNote: 'Eine erweiterte Grammatikprüfung wird über eine separate Anbieter-Schnittstelle integriert, da die Sprachunterstützung je nach Dienst variiert.',
        }
      : {
          title: 'Spelling and language checking',
          description: 'The editor passes the manuscript language to the platform spell checker.',
          spellcheck: 'Spell checking',
          spellcheckDescription: 'Mark possible spelling mistakes and language issues supported by the current platform while typing.',
          grammarNote: 'Advanced grammar checking is being integrated through a separate provider layer because language coverage differs by service.',
        };

  return (
    <section className="studio-settings-card">
      <div className="studio-settings-card-header">
        <div>
          <h4>{copy.title}</h4>
          <p>{copy.description}</p>
        </div>
      </div>
      <label className="studio-settings-toggle-row">
        <span>
          <strong>{copy.spellcheck}</strong>
          <small>{copy.spellcheckDescription}</small>
        </span>
        <input
          type="checkbox"
          checked={spellcheckEnabled}
          onChange={(event) => setSpellcheckEnabled(event.target.checked)}
        />
      </label>
      <p className="studio-language-inline-hint">{copy.grammarNote}</p>
    </section>
  );
}
