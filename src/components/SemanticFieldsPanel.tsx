import { Braces, Lock, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  createSemanticField,
  SEMANTIC_FIELD_PRESETS,
  updateSemanticField,
  validateSemanticFields,
  type OmiSemanticField,
  type OmiSemanticFieldValueType,
} from '../model/semanticFields';

export function SemanticFieldsPanel() {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const fields = manuscript.semanticFields ?? [];
  const issues = useMemo(() => validateSemanticFields(manuscript), [manuscript]);
  const [presetRole, setPresetRole] = useState(SEMANTIC_FIELD_PRESETS[0].role);
  const [customRole, setCustomRole] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customType, setCustomType] = useState<OmiSemanticFieldValueType>('text');
  const [message, setMessage] = useState('');

  function setFields(next: OmiSemanticField[]): void {
    useStudioStore.setState((state) => ({
      manuscript: {
        ...state.manuscript,
        semanticFields: next,
        updatedAt: new Date().toISOString(),
      },
    }));
  }

  function addPreset(): void {
    const preset = SEMANTIC_FIELD_PRESETS.find((item) => item.role === presetRole);
    if (!preset) return;
    if (fields.some((field) => field.role === preset.role && field.scope !== 'section')) {
      setMessage(copy.alreadyExists);
      return;
    }
    setFields([
      ...fields,
      createSemanticField({
        role: preset.role,
        label: localizedPresetLabel(preset.role, locale),
        valueType: preset.valueType,
      }),
    ]);
    setMessage(copy.created);
  }

  function addCustom(): void {
    const role = customRole.trim();
    const label = customLabel.trim();
    if (!role || !label) return;
    try {
      setFields([
        ...fields,
        createSemanticField({ role, label, valueType: customType }),
      ]);
      setCustomRole('');
      setCustomLabel('');
      setCustomType('text');
      setMessage(copy.created);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function patchField(id: string, patch: Partial<OmiSemanticField>): void {
    setFields(fields.map((field) =>
      field.id === id ? updateSemanticField(field, patch) : field,
    ));
  }

  return (
    <section className="studio-menu-view omi-semantic-fields-panel">
      <div className="studio-menu-view-header">
        <div>
          <h3><Braces size={18} aria-hidden="true" /> {copy.title}</h3>
          <p>{copy.description}</p>
        </div>
        <span className="omi-notes-count">{fields.length}</span>
      </div>

      <div className="studio-tool-card">
        <div style={{ width: '100%' }}>
          <strong>{copy.addStandard}</strong>
          <p>{copy.addStandardDescription}</p>
          <div className="studio-tool-actions" style={{ flexWrap: 'wrap' }}>
            <select value={presetRole} onChange={(event) => setPresetRole(event.target.value)}>
              {SEMANTIC_FIELD_PRESETS.map((preset) => (
                <option key={preset.role} value={preset.role}>
                  {localizedPresetLabel(preset.role, locale)}
                </option>
              ))}
            </select>
            <button type="button" className="studio-menu-secondary-action" onClick={addPreset}>
              <Plus size={15} aria-hidden="true" /> {copy.add}
            </button>
          </div>
        </div>
      </div>

      <div className="studio-tool-card">
        <div style={{ width: '100%' }}>
          <strong>{copy.addCustom}</strong>
          <p>{copy.addCustomDescription}</p>
          <div className="studio-manuscript-fields">
            <label>
              <span>{copy.role}</span>
              <input value={customRole} onChange={(event) => setCustomRole(event.target.value)} placeholder="e.g. archival-source-note" />
            </label>
            <label>
              <span>{copy.label}</span>
              <input value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} placeholder={copy.labelPlaceholder} />
            </label>
            <label>
              <span>{copy.type}</span>
              <select value={customType} onChange={(event) => setCustomType(event.target.value as OmiSemanticFieldValueType)}>
                <option value="text">{copy.types.text}</option>
                <option value="rich-text">{copy.types.richText}</option>
                <option value="date">{copy.types.date}</option>
                <option value="boolean">{copy.types.boolean}</option>
                <option value="choice">{copy.types.choice}</option>
              </select>
            </label>
          </div>
          <div className="studio-tool-actions">
            <button type="button" className="studio-menu-secondary-action" disabled={!customRole.trim() || !customLabel.trim()} onClick={addCustom}>
              <Plus size={15} aria-hidden="true" /> {copy.add}
            </button>
          </div>
          {message ? <p role="status">{message}</p> : null}
        </div>
      </div>

      {fields.length === 0 ? (
        <div className="omi-notes-empty"><p>{copy.empty}</p></div>
      ) : fields.map((field) => {
        const fieldIssues = issues.filter((issue) => issue.fieldId === field.id);
        return (
          <div key={field.id} className="studio-tool-card">
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
                <div>
                  <strong>{field.label}</strong>
                  <p><code>{field.role}</code> · {typeLabel(field.valueType, copy)}</p>
                </div>
                {field.locked ? <Lock size={16} aria-label={copy.locked} /> : null}
              </div>

              <div className="studio-manuscript-fields">
                {renderValueEditor(field, copy, (value) => patchField(field.id, { value }))}
                <label>
                  <span>{copy.required}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(field.required)}
                    disabled={field.locked}
                    onChange={(event) => patchField(field.id, { required: event.target.checked })}
                  />
                </label>
                <label>
                  <span>{copy.locked}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(field.locked)}
                    onChange={(event) => patchField(field.id, { locked: event.target.checked })}
                  />
                </label>
              </div>

              {fieldIssues.length ? (
                <p role="alert">{copy.validation}: {fieldIssues.map((issue) => issueLabel(issue.type, copy)).join(', ')}</p>
              ) : null}

              <div className="studio-tool-actions">
                <button type="button" className="studio-menu-secondary-action" onClick={() => setFields(fields.filter((candidate) => candidate.id !== field.id))}>
                  <Trash2 size={15} aria-hidden="true" /> {copy.delete}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function renderValueEditor(
  field: OmiSemanticField,
  copy: ReturnType<typeof getCopy>,
  onChange: (value: string | boolean) => void,
) {
  if (field.valueType === 'boolean') {
    return (
      <label>
        <span>{copy.value}</span>
        <input type="checkbox" checked={field.value === true} disabled={field.locked} onChange={(event) => onChange(event.target.checked)} />
      </label>
    );
  }

  if (field.valueType === 'choice') {
    return (
      <label>
        <span>{copy.value}</span>
        <select disabled={field.locked} value={typeof field.value === 'string' ? field.value : ''} onChange={(event) => onChange(event.target.value)}>
          <option value="">—</option>
          {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }

  if (field.valueType === 'rich-text') {
    return (
      <label>
        <span>{copy.value}</span>
        <textarea disabled={field.locked} value={typeof field.value === 'string' ? field.value : ''} onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  }

  return (
    <label>
      <span>{copy.value}</span>
      <input type={field.valueType === 'date' ? 'date' : 'text'} disabled={field.locked} value={typeof field.value === 'string' ? field.value : ''} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function localizedPresetLabel(role: string, locale: string): string {
  const language = locale.toLowerCase().split('-')[0];
  const labels: Record<string, Record<string, string>> = {
    hu: {
      'funding-statement': 'Finanszírozási nyilatkozat',
      'conflict-of-interest': 'Összeférhetetlenségi nyilatkozat',
      'ethics-statement': 'Etikai nyilatkozat',
      'data-availability': 'Adathozzáférési nyilatkozat',
      acknowledgements: 'Köszönetnyilvánítás',
      'publication-date': 'Megjelenés dátuma',
    },
    de: {
      'funding-statement': 'Finanzierungserklärung',
      'conflict-of-interest': 'Interessenkonflikterklärung',
      'ethics-statement': 'Ethikerklärung',
      'data-availability': 'Datenverfügbarkeit',
      acknowledgements: 'Danksagung',
      'publication-date': 'Veröffentlichungsdatum',
    },
  };
  return labels[language]?.[role]
    ?? SEMANTIC_FIELD_PRESETS.find((preset) => preset.role === role)?.label
    ?? role;
}

function typeLabel(type: OmiSemanticFieldValueType, copy: ReturnType<typeof getCopy>): string {
  if (type === 'rich-text') return copy.types.richText;
  return copy.types[type];
}

function issueLabel(type: string, copy: ReturnType<typeof getCopy>): string {
  if (type === 'missing-required-value') return copy.issues.required;
  if (type === 'invalid-choice') return copy.issues.choice;
  if (type === 'missing-section') return copy.issues.section;
  return copy.issues.role;
}

function getCopy(locale: string) {
  const language = locale.toLowerCase().split('-')[0];
  if (language === 'hu') return {
    title: 'Szemantikus mezők',
    description: 'Típusos, géppel értelmezhető dokumentummezők. A látható érték és a tudományos szerep külön tárolódik, így sablonok, exportok és integrációk megbízhatóan használhatják.',
    addStandard: 'Szabványos mező', addStandardDescription: 'Adjon hozzá gyakori tudományos nyilatkozatot vagy dokumentummezőt.',
    addCustom: 'Egyéni mező', addCustomDescription: 'Hozzon létre saját szemantikus szerepet és adattípust.',
    add: 'Hozzáadás', role: 'Szemantikus szerep', label: 'Felirat', labelPlaceholder: 'A mező látható neve', type: 'Adattípus', value: 'Érték', required: 'Kötelező', locked: 'Zárolt', delete: 'Törlés', empty: 'A dokumentumban még nincs szemantikus mező.', alreadyExists: 'Ez a szabványos mező már létezik.', created: 'Szemantikus mező létrehozva.', validation: 'Ellenőrzés',
    types: { text: 'Szöveg', richText: 'Hosszú szöveg', date: 'Dátum', boolean: 'Jelölőnégyzet', choice: 'Választólista' },
    issues: { required: 'a kötelező érték hiányzik', choice: 'érvénytelen választás', section: 'a célszakasz hiányzik', role: 'érvénytelen szemantikus szerep' },
  };
  if (language === 'de') return {
    title: 'Semantische Felder',
    description: 'Typisierte, maschinenlesbare Dokumentfelder. Sichtbarer Wert und wissenschaftliche Rolle werden getrennt gespeichert und können zuverlässig von Vorlagen, Exporten und Integrationen verwendet werden.',
    addStandard: 'Standardfeld', addStandardDescription: 'Fügen Sie eine häufige wissenschaftliche Erklärung oder ein Dokumentfeld hinzu.',
    addCustom: 'Benutzerdefiniertes Feld', addCustomDescription: 'Erstellen Sie eine eigene semantische Rolle und einen Datentyp.',
    add: 'Hinzufügen', role: 'Semantische Rolle', label: 'Bezeichnung', labelPlaceholder: 'Sichtbarer Feldname', type: 'Datentyp', value: 'Wert', required: 'Pflichtfeld', locked: 'Gesperrt', delete: 'Löschen', empty: 'Dieses Dokument enthält noch keine semantischen Felder.', alreadyExists: 'Dieses Standardfeld ist bereits vorhanden.', created: 'Semantisches Feld erstellt.', validation: 'Prüfung',
    types: { text: 'Text', richText: 'Langtext', date: 'Datum', boolean: 'Kontrollkästchen', choice: 'Auswahlliste' },
    issues: { required: 'Pflichtwert fehlt', choice: 'ungültige Auswahl', section: 'Zielabschnitt fehlt', role: 'ungültige semantische Rolle' },
  };
  return {
    title: 'Semantic fields',
    description: 'Typed, machine-readable document fields. The visible value and scholarly role are stored separately so templates, exports and integrations can address them reliably.',
    addStandard: 'Standard field', addStandardDescription: 'Add a common scholarly statement or document field.',
    addCustom: 'Custom field', addCustomDescription: 'Create a custom semantic role and data type.',
    add: 'Add', role: 'Semantic role', label: 'Label', labelPlaceholder: 'Visible field name', type: 'Data type', value: 'Value', required: 'Required', locked: 'Locked', delete: 'Delete', empty: 'This document does not contain semantic fields yet.', alreadyExists: 'This standard field already exists.', created: 'Semantic field created.', validation: 'Validation',
    types: { text: 'Text', richText: 'Long text', date: 'Date', boolean: 'Checkbox', choice: 'Choice list' },
    issues: { required: 'required value is missing', choice: 'invalid choice', section: 'target section is missing', role: 'invalid semantic role' },
  };
}
