/**
 * Short contextual progress labels, following the Studio's existing JATS copy
 * helper pattern. Other UI locales fall back to English until translated.
 */
interface ValidationProgressCopy {
  notice: string;
  preparing: string;
  completed: string;
  elapsed: string;
  finished: string;
}
const translations: Record<string, ValidationProgressCopy> = {
  en: { notice: 'Checks on large manuscripts may take some time.', preparing: 'Preparing manuscript…', completed: 'Completed checks:', elapsed: 'Elapsed:', finished: 'Validation duration:' },
  hu: { notice: 'Nagyobb kéziratoknál az érvényesség ellenőrzése időigényes lehet.', preparing: 'Az ellenőrzés előkészítése…', completed: 'Befejezett vizsgálatok:', elapsed: 'Eltelt idő:', finished: 'Az ellenőrzés időtartama:' },
  de: { notice: 'Bei umfangreichen Manuskripten kann die Gültigkeitsprüfung länger dauern.', preparing: 'Prüfung wird vorbereitet…', completed: 'Abgeschlossene Prüfungen:', elapsed: 'Vergangene Zeit:', finished: 'Prüfdauer:' },
  fr: { notice: 'La vérification des manuscrits volumineux peut prendre du temps.', preparing: 'Préparation de la vérification…', completed: 'Vérifications terminées :', elapsed: 'Temps écoulé :', finished: 'Durée de la vérification :' },
  it: { notice: 'La verifica di manoscritti lunghi può richiedere tempo.', preparing: 'Preparazione della verifica…', completed: 'Verifiche completate:', elapsed: 'Tempo trascorso:', finished: 'Durata della verifica:' },
  es: { notice: 'La validación de manuscritos extensos puede tardar.', preparing: 'Preparando la validación…', completed: 'Comprobaciones completadas:', elapsed: 'Tiempo transcurrido:', finished: 'Duración de la validación:' },
  nl: { notice: 'De controle van grote manuscripten kan enige tijd duren.', preparing: 'Controle voorbereiden…', completed: 'Voltooide controles:', elapsed: 'Verstreken tijd:', finished: 'Duur van de controle:' },
  pl: { notice: 'Sprawdzanie dużych rękopisów może potrwać dłużej.', preparing: 'Przygotowanie sprawdzania…', completed: 'Zakończone kontrole:', elapsed: 'Upłynęło:', finished: 'Czas sprawdzania:' },
  sk: { notice: 'Kontrola rozsiahlych rukopisov môže trvať dlhšie.', preparing: 'Príprava kontroly…', completed: 'Dokončené kontroly:', elapsed: 'Uplynulý čas:', finished: 'Trvanie kontroly:' },
};
export function getValidationProgressCopy(locale: string): ValidationProgressCopy {
  const base = locale.toLowerCase().replace('_', '-').split('-')[0]!;
  return translations[base] ?? translations.en!;
}
