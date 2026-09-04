import type { Editor } from '@tiptap/core';
import type { Mark } from '@tiptap/pm/model';
import { Bot, Languages, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  runIntegrationAgent,
  translateWithDeepL,
  type BuiltInAgentId,
  type TranslationSegment,
} from '../services/integrationExecutionApi';
import './SelectionIntegrationDialog.css';

interface SelectionIntegrationDialogProps {
  editor: Editor;
  blockId: string;
  mode: 'translate' | 'agent';
  sourceLanguage?: string;
  onClose: () => void;
}

interface SelectedTextPart {
  id: string;
  text: string;
  from: number;
  to: number;
  marks: readonly Mark[];
}

const LANGUAGES = [
  ['EN', 'English'],
  ['DE', 'Deutsch'],
  ['HU', 'Magyar'],
  ['FR', 'Français'],
  ['ES', 'Español'],
  ['IT', 'Italiano'],
  ['NL', 'Nederlands'],
  ['PL', 'Polski'],
  ['PT', 'Português'],
] as const;

export function SelectionIntegrationDialog({
  editor,
  blockId,
  mode,
  sourceLanguage,
  onClose,
}: SelectionIntegrationDialogProps) {
  const selection = useMemo(() => collectSelectedTextParts(editor), [editor]);
  const wholeBlock = useMemo(() => collectWholeBlockTextParts(editor), [editor]);
  const [translationScope, setTranslationScope] = useState<'selection' | 'block'>(
    selection.length ? 'selection' : 'block',
  );
  const [targetLanguage, setTargetLanguage] = useState('EN');
  const [agentId, setAgentId] = useState<BuiltInAgentId>('language-editor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [translated, setTranslated] = useState<TranslationSegment[]>([]);
  const [suggestion, setSuggestion] = useState('');

  const activeParts = translationScope === 'selection' ? selection : wholeBlock;
  const selectedText = selection.map((part) => part.text).join('');
  const translationText = activeParts.map((part) => part.text).join('');

  async function translateText(): Promise<void> {
    if (!activeParts.length) {
      setError(translationScope === 'selection'
        ? 'Select text before using DeepL.'
        : 'This block contains no translatable text.');
      return;
    }
    setBusy(true);
    setError('');
    setTranslated([]);
    try {
      const result = await translateWithDeepL({
        sourceLanguage,
        targetLanguage,
        scope: { kind: translationScope, id: blockId },
        segments: activeParts.map(({ id, text }) => ({ id, text, kind: 'text' })),
      });
      setTranslated(result.segments);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  function applyTranslation(): void {
    if (!translated.length || translated.length !== activeParts.length) return;
    const translatedById = new Map(translated.map((segment) => [segment.id, segment.text]));
    let transaction = editor.state.tr;
    for (const part of [...activeParts].sort((a, b) => b.from - a.from)) {
      const nextText = translatedById.get(part.id);
      if (nextText === undefined) continue;
      transaction = transaction.replaceWith(
        part.from,
        part.to,
        editor.schema.text(nextText, part.marks),
      );
    }
    editor.view.dispatch(transaction);
    editor.commands.focus();
    onClose();
  }

  async function runAgent(): Promise<void> {
    if (!selectedText.trim()) {
      setError('Select text before running an agent.');
      return;
    }
    setBusy(true);
    setError('');
    setSuggestion('');
    try {
      const result = await runIntegrationAgent({
        agentId,
        scope: { kind: 'selection', id: blockId },
        content: selectedText,
        requestedPermissions: agentId === 'citation-checker'
          ? ['document.read', 'references.read', 'suggest']
          : ['document.read', 'suggest'],
      });
      setSuggestion(result.suggestion);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  function applySuggestion(): void {
    if (!suggestion.trim() || !selection.length) return;
    if (!window.confirm('Apply this external-service suggestion to the selected manuscript text?')) return;
    const from = selection[0]?.from;
    const to = selection[selection.length - 1]?.to;
    if (from === undefined || to === undefined) return;
    editor.chain().focus().setTextSelection({ from, to }).insertContent(suggestion).run();
    onClose();
  }

  return (
    <div className="omi-selection-integration-dialog" role="dialog" aria-modal="false" aria-label={mode === 'translate' ? 'Translate manuscript text' : 'AI suggestion for selected text'}>
      <header>
        <div>{mode === 'translate' ? <Languages size={17} aria-hidden="true" /> : <Bot size={17} aria-hidden="true" />}<strong>{mode === 'translate' ? 'DeepL translation' : 'Agent suggestion'}</strong></div>
        <button type="button" className="omi-selection-integration-close" onClick={onClose} aria-label="Close"><X size={16} aria-hidden="true" /></button>
      </header>

      <p className="omi-selection-integration-source">{mode === 'translate' ? (translationText || 'No translatable text.') : (selectedText || 'No text selected.')}</p>

      {mode === 'translate' ? (
        <>
          <label><span>Translate</span><select value={translationScope} onChange={(event) => { setTranslationScope(event.target.value as 'selection' | 'block'); setTranslated([]); setError(''); }}><option value="selection" disabled={!selection.length}>Selected text</option><option value="block">Whole block</option></select></label>
          <label><span>Target language</span><select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)}>{LANGUAGES.map(([value, label]) => <option value={value} key={value}>{label} ({value})</option>)}</select></label>
          <div className="omi-selection-integration-actions">
            <button type="button" className="studio-menu-primary-action" disabled={busy || !activeParts.length} onClick={() => void translateText()}>{busy ? 'Translating…' : 'Translate'}</button>
            <button type="button" className="studio-menu-secondary-action" disabled={busy || !translated.length} onClick={applyTranslation}>Apply translation</button>
          </div>
          {translated.length ? <div className="omi-selection-integration-result">{translated.map((segment) => <span key={segment.id}>{segment.text}</span>)}</div> : null}
        </>
      ) : (
        <>
          <label><span>Agent</span><select value={agentId} onChange={(event) => setAgentId(event.target.value as BuiltInAgentId)}><option value="language-editor">Language editor</option><option value="metadata-assistant">Metadata assistant</option><option value="summarizer">Summarizer</option><option value="citation-checker">Citation checker</option></select></label>
          <div className="omi-selection-integration-actions">
            <button type="button" className="studio-menu-primary-action" disabled={busy || !selection.length} onClick={() => void runAgent()}>{busy ? 'Running…' : 'Create suggestion'}</button>
            <button type="button" className="studio-menu-secondary-action" disabled={busy || !suggestion} onClick={applySuggestion}>Apply suggestion</button>
          </div>
          {suggestion ? <pre className="omi-selection-integration-result">{suggestion}</pre> : null}
        </>
      )}

      {error ? <p className="omi-integration-error" role="alert">{error}</p> : null}
      <small>Only plain manuscript text is sent externally. Inline formatting is preserved; citation, note and cross-reference nodes and code marks remain outside translation requests.</small>
    </div>
  );
}

function collectSelectedTextParts(editor: Editor): SelectedTextPart[] {
  const { from, to } = editor.state.selection;
  if (from === to) return [];
  return collectTextParts(editor, from, to, 'selection');
}

function collectWholeBlockTextParts(editor: Editor): SelectedTextPart[] {
  return collectTextParts(editor, 0, editor.state.doc.content.size, 'block');
}

function collectTextParts(
  editor: Editor,
  from: number,
  to: number,
  prefix: string,
): SelectedTextPart[] {
  const parts: SelectedTextPart[] = [];
  editor.state.doc.nodesBetween(from, to, (node, position) => {
    if (!node.isText || !node.text) return;
    if (node.marks.some((mark) => mark.type.name === 'code')) return;
    const start = Math.max(from, position);
    const end = Math.min(to, position + node.nodeSize);
    if (end <= start) return;
    const text = node.text.slice(start - position, end - position);
    if (!text.trim()) return;
    parts.push({
      id: `${prefix}-${parts.length}`,
      text,
      from: start,
      to: end,
      marks: node.marks,
    });
  });
  return parts;
}
