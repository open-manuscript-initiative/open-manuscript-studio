import { Calculator, Link2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  COMPUTED_FIELD_PRESETS,
  createComputedField,
  resolveComputedField,
  validateComputedFields,
  type OmiComputedField,
} from '../model/computedFields';
import { collectCrossReferenceTargets, formatCrossReferenceTargetOption } from '../model/crossReferences';

export function ComputedFieldsPanel() {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const fields = manuscript.computedFields ?? [];
  const semanticFields = manuscript.semanticFields ?? [];
  const targets = useMemo(() => collectCrossReferenceTargets(manuscript), [manuscript]);
  const issues = useMemo(() => validateComputedFields(manuscript), [manuscript]);
  const [presetIndex, setPresetIndex] = useState('0');
  const [semanticFieldId, setSemanticFieldId] = useState('');
  const [crossReferenceTargetId, setCrossReferenceTargetId] = useState('');
  const [message, setMessage] = useState('');

  function persist(next: OmiComputedField[]): void {
    useStudioStore.setState((state) => ({
      manuscript: {
        ...state.manuscript,
        computedFields: next,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function addPreset(): void {
    const preset = COMPUTED_FIELD_PRESETS[Number(presetIndex)];
    if (!preset) return;
    persist([...fields, createComputedField({ ...preset, label: localizedPresetLabel(preset, locale) })]);
    setMessage(copy.created);
  }

  function addSemanticField(): void {
    const source = semanticFields.find((field) => field.id === semanticFieldId);
    if (!source) return;
    persist([...fields, createComputedField({
      label: source.label,
      kind: 'semantic-field',
      semanticFieldId: source.id,
      fallback: '—',
    })]);
    setSemanticFieldId('');
    setMessage(copy.created);
  }

  function addCrossReference(): void {
    const target = targets.find((item) => item.id === crossReferenceTargetId);
    if (!target) return;
    persist([...fields, createComputedField({
      label: formatCrossReferenceTargetOption(target, locale),
      kind: 'cross-reference',
      crossReferenceTargetId: target.id,
      crossReferenceDisplayStyle: 'label-number',
      fallback: '—',
    })]);
    setCrossReferenceTargetId('');
    setMessage(copy.created);
  }

  return (
    <section className="studio-menu-view omi-computed-fields-panel">
      <div className="studio-menu-view-header">
        <div>
          <h3><Calculator size={18} aria-hidden="true" /> {copy.title}</h3>
          <p>{copy.description}</p>
        </div>
        <span className="omi-notes-count">{fields.length}</span>
      </div>

      <div className="studio-tool-card"><div style={{ width: '100%' }}>
        <strong>{copy.standard}</strong>
        <p>{copy.standardDescription}</p>
        <div className="studio-tool-actions" style={{ flexWrap: 'wrap' }}>
          <select value={presetIndex} onChange={(event) => setPresetIndex(event.target.value)}>
            {COMPUTED_FIELD_PRESETS.map((preset, index) => <option key={`${preset.kind}:${preset.property ?? index}`} value={index}>{localizedPresetLabel(preset, locale)}</option>)}
          </select>
          <button type="button" className="studio-menu-secondary-action" onClick={addPreset}><Plus size={15} aria-hidden="true" />{copy.add}</button>
        </div>
      </div></div>

      {semanticFields.length ? <div className="studio-tool-card"><div style={{ width: '100%' }}>
        <strong>{copy.semantic}</strong><p>{copy.semanticDescription}</p>
        <div className="studio-tool-actions" style={{ flexWrap: 'wrap' }}>
          <select value={semanticFieldId} onChange={(event) => setSemanticFieldId(event.target.value)}><option value="">—</option>{semanticFields.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}</select>
          <button type="button" className="studio-menu-secondary-action" disabled={!semanticFieldId} onClick={addSemanticField}><Plus size={15} aria-hidden="true" />{copy.add}</button>
        </div>
      </div></div> : null}

      {targets.length ? <div className="studio-tool-card"><div style={{ width: '100%' }}>
        <strong>{copy.crossReference}</strong><p>{copy.crossReferenceDescription}</p>
        <div className="studio-tool-actions" style={{ flexWrap: 'wrap' }}>
          <select value={crossReferenceTargetId} onChange={(event) => setCrossReferenceTargetId(event.target.value)}><option value="">—</option>{targets.map((target) => <option key={`${target.kind}:${target.id}`} value={target.id}>{formatCrossReferenceTargetOption(target, locale)}</option>)}</select>
          <button type="button" className="studio-menu-secondary-action" disabled={!crossReferenceTargetId} onClick={addCrossReference}><Link2 size={15} aria-hidden="true" />{copy.add}</button>
        </div>
      </div></div> : null}

      {message ? <p role="status">{message}</p> : null}
      {fields.length === 0 ? <div className="omi-notes-empty"><p>{copy.empty}</p></div> : fields.map((field) => {
        const value = resolveComputedField(manuscript, field, locale);
        const fieldIssues = issues.filter((issue) => issue.fieldId === field.id);
        return <div key={field.id} className="studio-tool-card"><div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.75rem', alignItems: 'flex-start' }}>
            <div><strong>{field.label}</strong><p><code>{field.kind}</code></p></div>
            <button type="button" className="studio-menu-secondary-action" onClick={() => persist(fields.filter((candidate) => candidate.id !== field.id))} title={copy.delete}><Trash2 size={14} aria-hidden="true" /></button>
          </div>
          <div className="omi-xref-validation omi-xref-validation--ok"><RefreshCw size={15} aria-hidden="true" /><span>{value || copy.emptyValue}</span></div>
          {fieldIssues.length ? <p role="alert">{copy.validation}: {fieldIssues.map((issue) => issueLabel(issue.type, copy)).join(', ')}</p> : null}
        </div></div>;
      })}
    </section>
  );
}

function localizedPresetLabel(preset: (typeof COMPUTED_FIELD_PRESETS)[number], locale: string): string {
  const key = `${preset.kind}:${preset.property ?? ''}`;
  const language = locale.toLowerCase().split('-')[0];
  const labels: Record<string, Record<string, string>> = {
    hu: {
      'document-property:title': 'Dokumentum címe', 'document-property:subtitle': 'Dokumentum alcíme', 'document-property:locale': 'Dokumentum nyelve', 'document-property:created-at': 'Létrehozás dátuma', 'document-property:updated-at': 'Utolsó módosítás', 'current-date:': 'Aktuális dátum', 'section-count:': 'Szakaszok száma', 'word-count:': 'Szavak száma',
    },
    de: {
      'document-property:title': 'Dokumenttitel', 'document-property:subtitle': 'Dokumentuntertitel', 'document-property:locale': 'Dokumentsprache', 'document-property:created-at': 'Erstellt am', 'document-property:updated-at': 'Letzte Änderung', 'current-date:': 'Aktuelles Datum', 'section-count:': 'Abschnittszahl', 'word-count:': 'Wortzahl',
    },
  };
  return labels[language]?.[key] ?? preset.label;
}

function issueLabel(type: string, copy: ReturnType<typeof getCopy>): string {
  if (type === 'missing-property') return copy.issues.property;
  if (type === 'missing-semantic-field') return copy.issues.semantic;
  if (type === 'missing-cross-reference-target') return copy.issues.crossReference;
  return copy.issues.label;
}

function getCopy(locale: string) {
  const language = locale.toLowerCase().split('-')[0];
  if (language === 'hu') return {
    title: 'Számított mezők', description: 'Dinamikus értékek, amelyek a dokumentum szemantikus állapotából számolódnak újra. Az OMI nem Word-mezőkódot, hanem hordozható definíciót tárol.',
    standard: 'Dokumentumadat és számítás', standardDescription: 'Cím, dátum, nyelv, szakasz- vagy szószám automatikus megjelenítése.', semantic: 'Szemantikus mező értéke', semanticDescription: 'Egy szemantikus mező aktuális értékére mutató dinamikus mező.', crossReference: 'Kereszthivatkozás', crossReferenceDescription: 'Szakasz, ábra, tábla, egyenlet vagy könyvjelző aktuális címkéjének/sorszámának feloldása.', add: 'Hozzáadás', delete: 'Törlés', created: 'Számított mező létrehozva.', empty: 'A dokumentumban még nincs számított mező.', emptyValue: 'Nincs feloldható érték', validation: 'Ellenőrzés', issues: { label: 'hiányzó felirat', property: 'hiányzó dokumentumtulajdonság', semantic: 'a szemantikus forrásmező hiányzik', crossReference: 'a kereszthivatkozási cél hiányzik' },
  };
  if (language === 'de') return {
    title: 'Berechnete Felder', description: 'Dynamische Werte, die aus dem semantischen Dokumentzustand neu berechnet werden. OMI speichert portable Definitionen statt Word-Feldcodes.',
    standard: 'Dokumentdaten und Berechnung', standardDescription: 'Titel, Datum, Sprache, Abschnitts- oder Wortzahl automatisch anzeigen.', semantic: 'Wert eines semantischen Feldes', semanticDescription: 'Dynamischer Verweis auf den aktuellen Wert eines semantischen Feldes.', crossReference: 'Querverweis', crossReferenceDescription: 'Aktuelle Beschriftung/Nummer eines Abschnitts, einer Abbildung, Tabelle, Gleichung oder Textmarke auflösen.', add: 'Hinzufügen', delete: 'Löschen', created: 'Berechnetes Feld erstellt.', empty: 'Dieses Dokument enthält noch keine berechneten Felder.', emptyValue: 'Kein auflösbarer Wert', validation: 'Prüfung', issues: { label: 'Bezeichnung fehlt', property: 'Dokumenteigenschaft fehlt', semantic: 'semantisches Quellfeld fehlt', crossReference: 'Querverweisziel fehlt' },
  };
  return {
    title: 'Computed fields', description: 'Dynamic values recalculated from semantic manuscript state. OMI stores portable definitions rather than Word-specific field codes.',
    standard: 'Document data and calculation', standardDescription: 'Automatically expose title, date, language, section count or word count.', semantic: 'Semantic field value', semanticDescription: 'Dynamic reference to the current value of a semantic field.', crossReference: 'Cross-reference', crossReferenceDescription: 'Resolve the current label/number of a section, figure, table, equation or bookmark.', add: 'Add', delete: 'Delete', created: 'Computed field created.', empty: 'This document does not contain computed fields yet.', emptyValue: 'No resolvable value', validation: 'Validation', issues: { label: 'missing label', property: 'missing document property', semantic: 'semantic source field is missing', crossReference: 'cross-reference target is missing' },
  };
}
