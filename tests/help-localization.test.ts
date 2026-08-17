import assert from 'node:assert/strict';
import test from 'node:test';

import { getLocalizedHelpCopy } from '../src/i18n/helpResolver.ts';

const locales = [
  'bg','cs','da','de','el','en','es','et','fi','fr','ga','hr',
  'hu','it','lt','lv','mt','nl','pl','pt','ro','sk','sl','sv',
] as const;

const protectedTechnicalTerms = [
  'OMI','OJS','ORCID','ROR','CSL','JATS','DOCX','WebAuthn','PDF','CSS',
];

const flatten = (locale: string) => {
  const copy = getLocalizedHelpCopy(locale);
  return [
    copy.navigation,
    copy.title,
    copy.description,
    copy.gettingStarted,
    ...copy.topics.flatMap((topic) => [topic.title, topic.body, ...(topic.tips ?? [])]),
  ];
};

test('help exists and is substantial for all 24 supported interface locales', () => {
  for (const locale of locales) {
    const copy = getLocalizedHelpCopy(locale);
    assert.ok(copy.navigation.trim(), `${locale}: missing help navigation label`);
    assert.ok(copy.title.trim(), `${locale}: missing help title`);
    assert.ok(copy.description.length >= 60, `${locale}: help description is too short`);
    assert.ok(copy.gettingStarted.length >= 120, `${locale}: getting-started copy is too short`);
    assert.ok(copy.topics.length >= 20, `${locale}: expected at least 20 help topics`);

    for (const [index, topic] of copy.topics.entries()) {
      assert.ok(topic.title.trim(), `${locale}: topic ${index + 1} has no title`);
      assert.ok(topic.body.length >= 80, `${locale}: topic ${index + 1} body is too short`);
      assert.ok((topic.tips?.length ?? 0) >= 1, `${locale}: topic ${index + 1} has no practical guidance`);
    }
  }
});

test('non-English help does not silently fall back to the English copy', () => {
  const english = flatten('en');
  const technical = new Set(protectedTechnicalTerms);

  for (const locale of locales.filter((value) => value !== 'en')) {
    const localized = flatten(locale);
    const englishLongStrings = new Set(english.filter((value) => value.length >= 40));
    const accidentalFallbacks = localized.filter((value) =>
      value.length >= 40 && englishLongStrings.has(value) && !technical.has(value),
    );
    assert.deepEqual(accidentalFallbacks, [], `${locale}: contains English fallback help text`);
  }
});

test('every locale documents current signature and publisher-profile workflows', () => {
  for (const locale of locales) {
    const copy = getLocalizedHelpCopy(locale);
    const corpus = flatten(locale).join('\n').toLocaleLowerCase(locale);

    assert.match(corpus, /orcid/i, `${locale}: ORCID guidance missing`);
    assert.match(corpus, /webauthn|passkey/i, `${locale}: cryptographic signature guidance missing`);
    assert.match(corpus, /css/i, `${locale}: publisher export CSS guidance missing`);
    assert.match(corpus, /ojs/i, `${locale}: OJS integration guidance missing`);
    assert.match(corpus, /docx/i, `${locale}: DOCX import guidance missing`);
    assert.ok(copy.topics.some((topic) => /signature|signatur|firma|podpis|parakst|paraš|allekir|υπογραφ|подпис|síni|potpis|semnătur|assinatura|handtekening/i.test(topic.title + ' ' + topic.body)), `${locale}: author-signature topic missing`);
  }
});
