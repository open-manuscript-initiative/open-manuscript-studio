import { useEffect, useState } from 'react';
import { publicationTemplatesCopy } from '../i18n/publicationTemplates';
import type { PublicationTemplate } from '../model/publicationTemplates';
import { builtinPublicationTemplates, loadPublicationTemplates, PUBLICATION_TEMPLATES_EVENT } from '../services/publicationTemplates';

export function publicationTemplateName(template: PublicationTemplate, locale: string): string {
  const copy = publicationTemplatesCopy(locale);
  return template.id === 'omi-series-a5' ? copy.series : template.id === 'omi-journal-150-240' ? copy.journal : template.name;
}

export function usePublicationTemplates() {
  const [templates, setTemplates] = useState(builtinPublicationTemplates);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const refresh = () => { loadPublicationTemplates().then((next) => {
      if (!cancelled) { setTemplates(next); setLoadError(false); }
    }).catch(() => { if (!cancelled) setLoadError(true); }); };
    refresh();
    window.addEventListener(PUBLICATION_TEMPLATES_EVENT, refresh);
    return () => { cancelled = true; window.removeEventListener(PUBLICATION_TEMPLATES_EVENT, refresh); };
  }, []);
  return { templates, loadError };
}

export function PublicationTemplateSelector({ templates, locale, kind, value, onChange, disabled = false }: {
  templates: PublicationTemplate[]; locale: string; kind: PublicationTemplate['kind']; value: string;
  onChange: (template: PublicationTemplate | undefined) => void; disabled?: boolean;
}) {
  const copy = publicationTemplatesCopy(locale);
  return <label className="publication-template-selector">{copy.select}
    <select value={value} disabled={disabled} onChange={(event) => onChange(templates.find((item) => item.id === event.target.value && item.kind === kind))}>
      <option value="">{copy.none}</option>
      {templates.filter((template) => template.kind === kind).map((template) => <option value={template.id} key={template.id}>
        {publicationTemplateName(template, locale)}{template.association ? ` · ${template.association}` : ''}
      </option>)}
    </select>
  </label>;
}
