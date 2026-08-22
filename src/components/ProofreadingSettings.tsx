import { useTranslation } from '../i18n';
import {
  setLanguageCheckEnabled,
  setSpellcheckEnabled,
  useProofreadingPreferences,
} from '../editor/proofreadingPreferences';

export function ProofreadingSettings() {
  const { locale } = useTranslation();
  const { spellcheckEnabled, languageCheckEnabled } = useProofreadingPreferences();
  const copy = locale === 'hu'
    ? {
        title: 'Helyesírás és nyelvi ellenőrzés',
        description: 'A kézirat nyelve alapján külön kezelhető a helyi helyesírás és a fejlettebb nyelvi ellenőrzés.',
        spellcheck: 'Helyesírás-ellenőrzés',
        spellcheckDescription: 'A rendszer saját szótára jelölje a lehetséges elírásokat gépelés közben.',
        languageCheck: 'Nyelvhelyesség és stílus',
        languageCheckDescription: 'Jelölje a nyelvtani, központozási és stilisztikai problémákat, és kattintásra adjon javítási javaslatot.',
        privacy: 'Bekapcsolásakor a szerkesztett szövegblokkok külső nyelvi szolgáltatáshoz kerülhetnek. Angol és német szövegnél LanguageTool, más nyelveknél – például magyarnál – a beállított AI nyelvi szerkesztő használható.',
      }
    : locale === 'de'
      ? {
          title: 'Rechtschreibung und Sprachprüfung',
          description: 'Lokale Rechtschreibung und erweiterte Sprachprüfung können je nach Manuskriptsprache getrennt gesteuert werden.',
          spellcheck: 'Rechtschreibprüfung',
          spellcheckDescription: 'Das Wörterbuch des Systems markiert mögliche Tippfehler während der Eingabe.',
          languageCheck: 'Grammatik und Stil',
          languageCheckDescription: 'Grammatik-, Zeichensetzungs- und Stilprobleme markieren und per Klick Korrekturvorschläge anzeigen.',
          privacy: 'Wenn aktiviert, können bearbeitete Textblöcke an einen externen Sprachdienst gesendet werden. Für Englisch und Deutsch wird LanguageTool verwendet; andere Sprachen können den konfigurierten KI-Sprachredakteur verwenden.',
        }
      : {
          title: 'Spelling and language checking',
          description: 'Local spelling and advanced language checking can be controlled separately for the manuscript language.',
          spellcheck: 'Spell checking',
          spellcheckDescription: 'Use the platform dictionary to mark possible spelling mistakes while typing.',
          languageCheck: 'Grammar and style',
          languageCheckDescription: 'Mark grammar, punctuation and style issues and show correction suggestions when clicked.',
          privacy: 'When enabled, edited text blocks may be sent to an external language service. English and German use LanguageTool; other languages can use the configured AI language editor.',
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
      <label className="studio-settings-toggle-row">
        <span>
          <strong>{copy.languageCheck}</strong>
          <small>{copy.languageCheckDescription}</small>
        </span>
        <input
          type="checkbox"
          checked={languageCheckEnabled}
          onChange={(event) => setLanguageCheckEnabled(event.target.checked)}
        />
      </label>
      <p className="studio-language-inline-hint">{copy.privacy}</p>
    </section>
  );
}
