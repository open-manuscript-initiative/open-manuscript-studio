const en = {
  description: 'Machine translations are suggestions. Compare them with the source, edit them and choose which to keep. Accepted text becomes a draft in a new translation variant.',
  request: 'Request machine translation suggestions', accept: 'Accept selected suggestions as new translation', discard: 'Discard suggestions',
  suggestion: 'Machine suggestion', include: 'Use suggestion',
  changed: 'The source has changed since this request. Accepted suggestions will need review against the current source.',
  failed: 'Unable to prepare translation suggestions. Check the DeepL connection and try again.',
  acceptFailed: 'Unable to save the suggestions. Check that the original manuscript is still open.',
};
type Copy = typeof en;
const copies: Record<string, Copy> = {
  en,
  hu: {
    description: 'A gépi fordítás javaslat. Vesd össze az eredetivel, javítsd, és válaszd ki, mit szeretnél megtartani. Az elfogadott szöveg új fordítási változat piszkozata lesz.',
    request: 'Gépi fordítási javaslatok kérése', accept: 'Kijelölt javaslatok átvétele új fordításként', discard: 'Javaslatok elvetése',
    suggestion: 'Gépi fordítási javaslat', include: 'Javaslat átvétele',
    changed: 'A forrás a kérés óta megváltozott. Az elfogadott javaslatokat az aktuális forrással is össze kell vetni.',
    failed: 'Nem sikerült fordítási javaslatokat kérni. Ellenőrizd a DeepL-kapcsolatot, majd próbáld újra.',
    acceptFailed: 'Nem sikerült menteni a javaslatokat. Ellenőrizd, hogy az eredeti kézirat van-e megnyitva.',
  },
  de: {
    description: 'Maschinelle Übersetzungen sind Vorschläge. Vergleichen und bearbeiten Sie diese und wählen Sie die gewünschten Texte aus. Die Übernahme erstellt einen Entwurf in einer neuen Übersetzungsvariante.',
    request: 'Maschinelle Übersetzungsvorschläge anfordern', accept: 'Ausgewählte Vorschläge als neue Übersetzung übernehmen', discard: 'Vorschläge verwerfen',
    suggestion: 'Maschineller Übersetzungsvorschlag', include: 'Vorschlag übernehmen',
    changed: 'Der Quelltext wurde seit der Anfrage geändert. Übernommene Vorschläge müssen mit der aktuellen Quelle verglichen werden.',
    failed: 'Übersetzungsvorschläge konnten nicht erstellt werden. Prüfen Sie die DeepL-Verbindung.',
    acceptFailed: 'Vorschläge konnten nicht gespeichert werden. Öffnen Sie das ursprüngliche Manuskript.',
  },
  fr: {
    description: 'Les traductions automatiques sont des suggestions. Comparez-les, modifiez-les et sélectionnez les textes à conserver. Leur acceptation crée un brouillon dans une nouvelle variante.',
    request: 'Demander des suggestions de traduction automatique', accept: 'Accepter la sélection comme nouvelle traduction', discard: 'Rejeter les suggestions', suggestion: 'Suggestion automatique', include: 'Utiliser la suggestion',
    changed: 'La source a changé depuis la demande. Vérifiez les suggestions avec la source actuelle.', failed: 'Impossible de préparer les suggestions. Vérifiez la connexion DeepL.', acceptFailed: 'Impossible de sauvegarder. Ouvrez le manuscrit d’origine.',
  },
  it: {
    description: 'Le traduzioni automatiche sono suggerimenti. Confrontali, modificali e seleziona i testi da conservare. Accettandoli crei una bozza in una nuova variante.',
    request: 'Richiedi suggerimenti di traduzione automatica', accept: 'Accetta la selezione come nuova traduzione', discard: 'Scarta i suggerimenti', suggestion: 'Suggerimento automatico', include: 'Usa il suggerimento',
    changed: 'La fonte è cambiata dopo la richiesta. Verifica i suggerimenti con la fonte attuale.', failed: 'Impossibile preparare i suggerimenti. Verifica la connessione DeepL.', acceptFailed: 'Impossibile salvare. Apri il manoscritto originale.',
  },
  es: {
    description: 'Las traducciones automáticas son sugerencias. Compáralas, edítalas y selecciona los textos que quieras conservar. Al aceptarlas se crea un borrador en una variante nueva.',
    request: 'Solicitar sugerencias de traducción automática', accept: 'Aceptar la selección como traducción nueva', discard: 'Descartar sugerencias', suggestion: 'Sugerencia automática', include: 'Usar sugerencia',
    changed: 'La fuente ha cambiado desde la solicitud. Revisa las sugerencias con la fuente actual.', failed: 'No se pudieron preparar las sugerencias. Comprueba la conexión DeepL.', acceptFailed: 'No se pudo guardar. Abre el manuscrito original.',
  },
  nl: {
    description: 'Machinevertalingen zijn suggesties. Vergelijk en bewerk ze en kies welke teksten u wilt bewaren. Accepteren maakt een concept in een nieuwe vertaalvariant.',
    request: 'Machinevertaalsuggesties aanvragen', accept: 'Selectie als nieuwe vertaling accepteren', discard: 'Suggesties verwerpen', suggestion: 'Machinevertaalsuggestie', include: 'Suggestie gebruiken',
    changed: 'De bron is sinds de aanvraag gewijzigd. Controleer de suggesties met de huidige bron.', failed: 'Suggesties konden niet worden gemaakt. Controleer de DeepL-verbinding.', acceptFailed: 'Opslaan mislukt. Open het oorspronkelijke manuscript.',
  },
  pl: {
    description: 'Tłumaczenia maszynowe są sugestiami. Porównaj je, popraw i wybierz teksty do zachowania. Akceptacja tworzy szkic w nowym wariancie tłumaczenia.',
    request: 'Poproś o sugestie tłumaczenia maszynowego', accept: 'Zaakceptuj wybór jako nowe tłumaczenie', discard: 'Odrzuć sugestie', suggestion: 'Sugestia maszynowa', include: 'Użyj sugestii',
    changed: 'Źródło zmieniło się od czasu żądania. Sprawdź sugestie z aktualnym źródłem.', failed: 'Nie udało się przygotować sugestii. Sprawdź połączenie DeepL.', acceptFailed: 'Nie udało się zapisać. Otwórz oryginalny rękopis.',
  },
  sk: {
    description: 'Strojové preklady sú návrhy. Porovnajte ich, upravte a vyberte texty na zachovanie. Prijatie vytvorí koncept v novom variante prekladu.',
    request: 'Vyžiadať návrhy strojového prekladu', accept: 'Prijať výber ako nový preklad', discard: 'Zahodiť návrhy', suggestion: 'Strojový návrh', include: 'Použiť návrh',
    changed: 'Zdroj sa od požiadavky zmenil. Skontrolujte návrhy s aktuálnym zdrojom.', failed: 'Návrhy sa nepodarilo pripraviť. Skontrolujte pripojenie DeepL.', acceptFailed: 'Uloženie zlyhalo. Otvorte pôvodný rukopis.',
  },
};
export function getMachineTranslationCopy(locale: string): Copy { return copies[locale] ?? en; }
