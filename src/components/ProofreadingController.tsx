import { useEffect } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useProofreadingPreferences } from '../editor/proofreadingPreferences';

export function ProofreadingController() {
  const manuscriptLanguage = useStudioStore((state) => state.manuscript.locale);
  const { spellcheckEnabled } = useProofreadingPreferences();

  useEffect(() => {
    const apply = (root: ParentNode = document) => {
      root.querySelectorAll<HTMLElement>('.omi-tiptap-editor').forEach((editor) => {
        editor.setAttribute('spellcheck', spellcheckEnabled ? 'true' : 'false');
        editor.setAttribute('lang', manuscriptLanguage || 'en');
      });
    };

    apply();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.matches('.omi-tiptap-editor')) {
            node.setAttribute('spellcheck', spellcheckEnabled ? 'true' : 'false');
            node.setAttribute('lang', manuscriptLanguage || 'en');
          }
          apply(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [manuscriptLanguage, spellcheckEnabled]);

  return null;
}
