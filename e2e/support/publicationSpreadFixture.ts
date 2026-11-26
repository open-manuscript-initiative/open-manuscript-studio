import { useStudioStore } from '../../src/app/useStudioStore';
import { clonePublicationStyleTemplate, PUBLICATION_STYLE_STORAGE_KEY, loadPublicationStyle } from '../../src/services/publicationStyleExport';
import { serializeOmiJson } from '../../src/services/exportOmi';
import { parseOmiJson } from '../../src/services/omiPortableFormat';
import { createNoteAnnotation } from '../../src/model/notes';
import { createTableBlock } from '../../src/model/visualBlocks';
// E2E-only browser module served by Vite; never imported by production code.
declare global {
  interface Window {
    __omiSpreadPersistence?: {
      hasEdit: () => boolean;
      roundTrip: () => { facingPages?: boolean; pageNumberStart?: number };
    };
  }
}

const style = clonePublicationStyleTemplate();
style.page.pageNumberStart = 2;
localStorage.setItem(PUBLICATION_STYLE_STORAGE_KEY, JSON.stringify(style));
const current = useStudioStore.getState().manuscript;
const rich = (index: number) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [
  { type: 'text', text: `Paragraph ${index}. ` + 'Continuous text crossing the spine and flowing onto the next sheet. '.repeat(65) },
  { type: 'omiNote', attrs: { noteId: `n-${index}`, anchorId: `a-${index}`, label: `${index + 1}`, noteType: 'footnote' } },
  { type: 'text', text: ' After the note.' },
] }] });
useStudioStore.getState().loadManuscript({ ...current, title: 'Facing pages trial', sections: [{ id: 's', title: '', blocks: [
  ...Array.from({ length: 3 }, (_, i) => ({ id: `p-${i}`, type: 'paragraph', content: rich(i) })),
  createTableBlock(Array.from({ length: 50 }, (_, i) => [`Row ${i}`, 'Table text. '.repeat(4)]), {}, 'spread-table'),
] }], annotations: Array.from({ length: 3 }, (_, i) => createNoteAnnotation({
  id: `n-${i}`, anchorId: `a-${i}`, targetBlockId: `p-${i}`, body: `Note ${i}. ` + 'A footnote on its reference page. '.repeat(5),
})) });
window.__omiSpreadPersistence = {
  hasEdit: () => useStudioStore.getState().manuscript.sections.some(section => section.blocks.some(block => block.content.includes('EDITED'))),
  roundTrip: () => {
    useStudioStore.getState().checkpoint('manual');
    return loadPublicationStyle(parseOmiJson(serializeOmiJson(useStudioStore.getState().manuscript))).page;
  },
};
