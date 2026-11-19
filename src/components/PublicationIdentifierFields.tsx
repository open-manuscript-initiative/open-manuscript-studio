import { useEffect, useState } from 'react';
import type { OmiTitleMatter } from '../model/frontMatter';
import { getPublicationIdentifiersCopy, publicationIdentifierFields, type PublicationIdentifierField, type PublicationKind } from '../model/publicationIdentifiers';

export function PublicationIdentifierFields({ locale, kind, values, onChange }: {
  locale: string; kind: PublicationKind; values: OmiTitleMatter;
  onChange(field: PublicationIdentifierField, value: string): void;
}) {
  const copy = getPublicationIdentifiersCopy(locale);
  return <fieldset className="omi-title-matter-details">
    <legend>{copy.title}</legend>
    <p>{copy.hint}</p>
    <div className="omi-title-matter-grid">
      {publicationIdentifierFields(kind).map((field) => <label key={field}>
        <span>{copy[field]}</span>
        <IdentifierInput value={values[field] ?? ''} onChange={(value) => onChange(field, value)} />
      </label>)}
    </div>
  </fieldset>;
}

function IdentifierInput({ value, onChange }: { value: string; onChange(value: string): void }) {
  const [draft, setDraft] = useState(value);
  // Title-matter storage trims whitespace; preserve a newly typed line break
  // while the user is still entering another identifier in this field.
  useEffect(() => { setDraft((previous) => previous.trim() === value.trim() ? previous : value); }, [value]);
  return <textarea rows={2} value={draft} onChange={(event) => {
    setDraft(event.target.value);
    onChange(event.target.value);
  }} onBlur={() => setDraft(value)} />;
}
