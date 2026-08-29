import { useEffect, useMemo, useState } from 'react';

import {
  getAssignedReviewForm,
  saveAssignedReviewForm,
  type ReviewFormContext,
  type ReviewFormElement,
  type ReviewFormOption,
  type ReviewFormResponseValue,
} from '../services/peerReviewApi';

type Locale = 'en' | 'hu' | 'de';

type ReviewFormLocalization = {
  question?: string;
  description?: string;
  options?: ReviewFormOption[];
};

type LocalizedReviewFormElement = ReviewFormElement & {
  localizations?: Record<string, ReviewFormLocalization>;
};

const copy = {
  en: {
    title: 'Journal review form',
    intro: 'This form is defined by the journal in OJS. Required fields must be completed before submission.',
    required: 'Required',
    authorVisible: 'Visible to the author',
    confidential: 'Editor only',
    save: 'Save review form',
    saved: 'Review form saved',
    loading: 'Loading journal review form…',
    select: 'Select…',
  },
  hu: {
    title: 'Folyóirati értékelő űrlap',
    intro: 'Ezt az űrlapot a folyóirat határozza meg az OJS-ben. A beküldés előtt minden kötelező mezőt ki kell tölteni.',
    required: 'Kötelező',
    authorVisible: 'A szerző számára látható',
    confidential: 'Csak a szerkesztőnek',
    save: 'Értékelő űrlap mentése',
    saved: 'Értékelő űrlap mentve',
    loading: 'Folyóirati értékelő űrlap betöltése…',
    select: 'Válasszon…',
  },
  de: {
    title: 'Begutachtungsformular der Zeitschrift',
    intro: 'Dieses Formular wird von der Zeitschrift in OJS definiert. Pflichtfelder müssen vor dem Einreichen ausgefüllt werden.',
    required: 'Pflichtfeld',
    authorVisible: 'Für Autorinnen und Autoren sichtbar',
    confidential: 'Nur für die Redaktion',
    save: 'Begutachtungsformular speichern',
    saved: 'Begutachtungsformular gespeichert',
    loading: 'Begutachtungsformular wird geladen…',
    select: 'Auswählen…',
  },
} satisfies Record<Locale, Record<string, string>>;

export function OjsReviewFormCard({
  assignmentId,
  locale,
  disabled,
  onError,
}: {
  assignmentId: string;
  locale: Locale;
  disabled: boolean;
  onError: (message: string) => void;
}) {
  const labels = copy[locale];
  const [context, setContext] = useState<ReviewFormContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [values, setValues] = useState<Record<string, string | string[] | null>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSaved(false);
    void getAssignedReviewForm(assignmentId)
      .then((next) => {
        if (!active) return;
        setContext(next);
        const responseValues = new Map(
          (next?.responses ?? []).map((item) => [item.elementExternalId, item.value]),
        );
        setValues(Object.fromEntries(
          (next?.definition?.elements ?? []).map((element) => [
            element.externalId,
            responseValues.has(element.externalId)
              ? responseValues.get(element.externalId) ?? null
              : element.value,
          ]),
        ));
      })
      .catch((error) => {
        if (active) onError(error instanceof Error ? error.message : labels.loading);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [assignmentId, labels.loading, onError]);

  const elements = context?.definition?.elements ?? [];
  const responses = useMemo<ReviewFormResponseValue[]>(
    () => elements.map((element) => ({
      elementExternalId: element.externalId,
      value: values[element.externalId] ?? null,
    })),
    [elements, values],
  );

  if (loading) {
    return <section className="review-mode__card"><p>{labels.loading}</p></section>;
  }
  if (!context?.definition) return null;

  async function save() {
    try {
      setSaving(true);
      setSaved(false);
      const next = await saveAssignedReviewForm(assignmentId, responses);
      setContext(next);
      setSaved(true);
    } catch (error) {
      onError(error instanceof Error ? error.message : labels.save);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="review-mode__card review-mode__ojs-form">
      <h2>{labels.title}</h2>
      <p>{labels.intro}</p>
      <div className="review-mode__ojs-form-fields">
        {elements.map((element) => (
          <ReviewField
            key={element.externalId}
            element={element as LocalizedReviewFormElement}
            locale={locale}
            value={values[element.externalId] ?? null}
            disabled={disabled || saving}
            labels={labels}
            onChange={(value) => {
              setSaved(false);
              setValues((current) => ({ ...current, [element.externalId]: value }));
            }}
          />
        ))}
      </div>
      <div className="review-mode__actions">
        <button type="button" disabled={disabled || saving} onClick={() => void save()}>{labels.save}</button>
        {saved ? <span>{labels.saved}</span> : null}
      </div>
    </section>
  );
}

function ReviewField({
  element,
  locale,
  value,
  disabled,
  labels,
  onChange,
}: {
  element: LocalizedReviewFormElement;
  locale: Locale;
  value: string | string[] | null;
  disabled: boolean;
  labels: Record<string, string>;
  onChange: (value: string | string[] | null) => void;
}) {
  const scalar = Array.isArray(value) ? '' : value ?? '';
  const localized = resolveLocalization(element, locale);
  const question = ojsText(localized?.question ?? element.question);
  const description = ojsText(localized?.description ?? element.description);
  const options = (localized?.options ?? element.options).map((option) => ({
    ...option,
    label: ojsText(option.label),
  }));

  return (
    <fieldset className="review-mode__ojs-form-field" disabled={disabled}>
      <legend>
        {question}
        {element.required ? <span aria-label={labels.required}> *</span> : null}
      </legend>
      {description ? <p>{description}</p> : null}
      <small>{element.authorVisible ? labels.authorVisible : labels.confidential}</small>

      {element.type === 'textarea' ? (
        <textarea rows={7} required={element.required} value={scalar} onChange={(event) => onChange(event.target.value)} />
      ) : element.type === 'small_text' || element.type === 'text' ? (
        <input type="text" required={element.required} value={scalar} onChange={(event) => onChange(event.target.value)} />
      ) : element.type === 'dropdown' ? (
        <select required={element.required} value={scalar} onChange={(event) => onChange(event.target.value)}>
          <option value="">{labels.select}</option>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : element.type === 'radio' ? (
        <div className="review-mode__ojs-form-options">
          {options.map((option) => (
            <label key={option.value}>
              <input type="radio" name={`review-form-${element.externalId}`} checked={scalar === option.value} onChange={() => onChange(option.value)} />
              {option.label}
            </label>
          ))}
        </div>
      ) : (
        <div className="review-mode__ojs-form-options">
          {options.map((option) => {
            const selected = Array.isArray(value) ? value : [];
            return (
              <label key={option.value}>
                <input
                  type="checkbox"
                  checked={selected.includes(option.value)}
                  onChange={(event) => onChange(
                    event.target.checked
                      ? [...selected, option.value]
                      : selected.filter((item) => item !== option.value),
                  )}
                />
                {option.label}
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

function resolveLocalization(
  element: LocalizedReviewFormElement,
  locale: Locale,
): ReviewFormLocalization | undefined {
  const entries = Object.entries(element.localizations ?? {});
  if (entries.length === 0) return undefined;

  const normalizedLocale = normalizeLocale(locale);
  const exact = entries.find(([key]) => normalizeLocale(key) === normalizedLocale);
  if (exact) return exact[1];

  const language = normalizedLocale.split('-')[0];
  return entries.find(([key]) => normalizeLocale(key).split('-')[0] === language)?.[1];
}

function normalizeLocale(locale: string): string {
  return locale.trim().replace(/_/g, '-').toLowerCase();
}

function ojsText(value: string | undefined | null): string {
  if (!value) return '';
  const document = new DOMParser().parseFromString(value, 'text/html');
  return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}
