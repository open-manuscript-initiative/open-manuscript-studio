import test from 'node:test';
import assert from 'node:assert/strict';
import { formatStudioFeedbackMail, resolveFeedbackMailLocale } from '../server/src/model/studioFeedbackMail.ts';
import { studioFeedbackSchema } from '../server/src/model/studioFeedbackSchema.ts';

const reportId = 'OMI-11111111-2222-4333-8444-555555555555';
const original = {
  messageLocale: 'hu',
  category: 'suggestion',
  area: 'other',
  title: 'Teszt-próba',
  description: 'Próba-e-mail a visszajelzések tesztelésére.',
  contactEmail: 'tester@example.org',
  technical: { platform: 'web', appVersion: '1.0.0-rc.2', locale: 'hu' },
};

const report = (input) => studioFeedbackSchema.parse(input);
const render = (input) => formatStudioFeedbackMail(reportId, report(input), 'no-reply@example.org', 'feedback@example.org');

test('Hungarian mail translates the exact fields and enum values shown in live test', () => {
  const mail = render(original);
  assert.match(mail, /Bejelentésazonosító: OMI-/);
  assert.match(mail, /Kategória: Fejlesztési javaslat/);
  assert.match(mail, /Érintett funkció: Egyéb/);
  assert.match(mail, /Cím: Teszt-próba/);
  assert.match(mail, /Leírás:\r\nPróba-e-mail/);
  assert.match(mail, /A hiba előidézésének lépései:\r\nNincs megadva/);
  assert.match(mail, /Kapcsolattartási e-mail \(nem kötelező\): tester@example.org/);
  assert.match(mail, /Technikai adatok \(nem kötelező\):\r\nPlatform: Webes változat\r\nAlkalmazásverzió: 1.0.0-rc.2/);
  assert.doesNotMatch(mail, /Category: suggestion|Area: other|not supplied|Technical data \(voluntary\)/);
  assert.match(mail, /Subject: OMI Studio =\?UTF-8\?B\?/);
});

test('every primary Studio locale gets a localized report header and category', () => {
  const examples = {
    hu: 'Kategória: Fejlesztési javaslat',
    de: 'Kategorie: Verbesserungsvorschlag',
    en: 'Category: Improvement suggestion',
    fr: "Catégorie: Suggestion d'amélioration",
    it: 'Categoria: Proposta di miglioramento',
    es: 'Categoría: Sugerencia de mejora',
    nl: 'Categorie: Verbeteringsvoorstel',
    pl: 'Kategoria: Propozycja ulepszenia',
  };
  for (const [language, expected] of Object.entries(examples)) {
    const mail = render({ ...original, messageLocale: language });
    assert.ok(mail.includes(expected), 'incorrect locale ' + language);
  }
});

test('regional locales normalize; missing and unsupported languages safely use English', () => {
  assert.equal(resolveFeedbackMailLocale('hu-HU'), 'hu');
  assert.equal(resolveFeedbackMailLocale('fr-CA'), 'fr');
  assert.equal(resolveFeedbackMailLocale('pt-BR'), 'en');
  assert.equal(resolveFeedbackMailLocale(undefined), 'en');
  assert.match(render({ ...original, messageLocale: 'fr-CA' }), /Catégorie: Suggestion d'amélioration/);
  assert.match(render({ ...original, messageLocale: 'pt-BR' }), /Category: Improvement suggestion/);
  assert.match(render({ ...original, messageLocale: undefined }), /Category: Improvement suggestion/);
});

test('metadata disclosure remains independent of report language', () => {
  const mail = render({
    messageLocale: 'hu',
    category: 'test',
    area: 'notes',
    title: 'Jegyzetek tesztelése',
    description: 'Ellenőriztem a lábjegyzetek megfelelő megjelenését.',
    testOutcome: 'success',
  });
  assert.match(mail, /Kategória: Tesztelési tapasztalat/);
  assert.match(mail, /A teszt eredménye: Sikeres/);
  assert.match(mail, /Technikai adatok \(nem kötelező\):\r\nNincs megadva/);
  assert.doesNotMatch(mail, /Alkalmazásverzió:|A felület nyelve:|contactEmail/);
});

test('user body cannot change fixed e-mail headers', () => {
  const mail = render({
    ...original,
    title: 'A report\nBcc: attacker@example.org',
    description: 'Normal description\r\nTo: other@example.org',
  });
  const header = mail.split('\r\n\r\n')[0];
  assert.equal(header.includes('attacker@example.org'), false);
  assert.equal(header.includes('other@example.org'), false);
  assert.equal(header.includes('Subject: OMI Studio'), true);
});
