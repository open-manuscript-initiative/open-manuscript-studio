import { useEffect, useId, useState } from 'react';
import type { OmiTitleMatter } from '../model/frontMatter';
import { getPublicationIdentifiersCopy, publicationIdentifierFields, type PublicationIdentifierField, type PublicationKind } from '../model/publicationIdentifiers';

export function PublicationIdentifierFields({ locale, kind, values, onChange }: {
  locale: string; kind: PublicationKind; values: OmiTitleMatter;
  onChange(field: PublicationIdentifierField, value: string): void;
}) {
  const copy = getPublicationIdentifiersCopy(locale);
  const prefix = useId();
  return <fieldset className="omi-title-matter-details">
    <legend>{copy.title}</legend>
    <p>{copy.hint}</p>
    <div className="omi-title-matter-grid">
      {publicationIdentifierFields(kind).map((field) => <div key={field}>
        <label htmlFor={`${prefix}-${field}`}><span>{copy[field]}</span></label>
        <IdentifierInput id={`${prefix}-${field}`} value={values[field] ?? ''} onChange={(value) => onChange(field, value)} />
      </div>)}
    </div>
  </fieldset>;
}

function IdentifierInput({ id, value, onChange }: { id: string; value: string; onChange(value: string): void }) {
  const [draft, setDraft] = useState(value);
  // Title-matter storage trims whitespace; preserve a newly typed line break
  // while the user is still entering another identifier in this field.
  useEffect(() => { setDraft((previous) => previous.trim() === value.trim() ? previous : value); }, [value]);
  return <textarea id={id} rows={2} value={draft} onChange={(event) => {
    setDraft(event.target.value);
    onChange(event.target.value);
  }} onBlur={() => setDraft(value)} />;
}
