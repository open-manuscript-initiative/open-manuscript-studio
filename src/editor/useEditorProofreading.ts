import type { Editor } from '@tiptap/core';
import { useEffect, useMemo, useState } from 'react';

import {
  OmiProofreadingExtension,
  PROOFREADING_META,
  textOffsetRange,
} from './extensions/OmiProofreadingExtension';
import { useProofreadingPreferences } from './proofreadingPreferences';
import {
  checkProofreading,
  type ProofreadingIssue,
} from '../services/proofreadingApi';

export interface EditorProofreadingState {
  issues: ProofreadingIssue[];
  activeIssue: ProofreadingIssue | null;
  error: string;
  checking: boolean;
  selectIssue: (id: string | null) => void;
  applyReplacement: (replacement: string) => void;
  ignoreActiveIssue: () => void;
}

export function useEditorProofreading(
  editor: Editor | null,
  blockId: string,
  language: string,
): EditorProofreadingState {
  const { languageCheckEnabled } = useProofreadingPreferences();
  const [issues, setIssues] = useState<ProofreadingIssue[]>([]);
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const activeIssue = useMemo(
    () => issues.find((issue) => issue.id === activeIssueId) ?? null,
    [activeIssueId, issues],
  );

  useEffect(() => {
    if (!editor || !languageCheckEnabled) {
      setIssues([]);
      setActiveIssueId(null);
      setChecking(false);
      setError('');
      if (editor) setEditorIssues(editor, []);
      return;
    }

    let timer: number | undefined;
    let controller: AbortController | null = null;
    let disposed = false;

    const run = async () => {
      controller?.abort();
      controller = new AbortController();
      const text = editor.state.doc.textBetween(0, editor.state.doc.content.size, '');
      if (!text.trim()) {
        setIssues([]);
        setEditorIssues(editor, []);
        return;
      }
      if (text.length > 20_000) {
        setError('This block is too large for live language checking.');
        return;
      }

      setChecking(true);
      setError('');
      try {
        const result = await checkProofreading({
          language,
          text,
          blockId,
          signal: controller.signal,
        });
        if (disposed || controller.signal.aborted) return;
        setIssues(result.issues);
        setActiveIssueId((current) =>
          current && result.issues.some((issue) => issue.id === current) ? current : null,
        );
        setEditorIssues(editor, result.issues);
      } catch (reason) {
        if (controller.signal.aborted || disposed) return;
        setIssues([]);
        setEditorIssues(editor, []);
        setError(reason instanceof Error ? reason.message : String(reason));
      } finally {
        if (!disposed && !controller.signal.aborted) setChecking(false);
      }
    };

    const schedule = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => void run(), 900);
    };

    schedule();
    editor.on('update', schedule);
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearTimeout(timer);
      controller?.abort();
      editor.off('update', schedule);
    };
  }, [blockId, editor, language, languageCheckEnabled]);

  function applyReplacement(replacement: string): void {
    if (!editor || !activeIssue) return;
    const range = textOffsetRange(editor.state.doc, activeIssue.offset, activeIssue.length);
    if (!range) return;
    editor.view.dispatch(editor.state.tr.insertText(replacement, range.from, range.to));
    setActiveIssueId(null);
  }

  function ignoreActiveIssue(): void {
    if (!editor || !activeIssue) return;
    const next = issues.filter((issue) => issue.id !== activeIssue.id);
    setIssues(next);
    setEditorIssues(editor, next);
    setActiveIssueId(null);
  }

  return {
    issues,
    activeIssue,
    error,
    checking,
    selectIssue: setActiveIssueId,
    applyReplacement,
    ignoreActiveIssue,
  };
}

function setEditorIssues(editor: Editor, issues: ProofreadingIssue[]): void {
  if (!editor.extensionManager.extensions.some((extension) => extension.name === OmiProofreadingExtension.name)) {
    return;
  }
  editor.view.dispatch(editor.state.tr.setMeta(PROOFREADING_META, issues));
}
