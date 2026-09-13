import { createDocumentStructureProfile } from '../../src/model/documentProfile.ts';
import { createTestManuscript } from '../testManuscriptFixture.ts';

/** Authored demonstration, not an actual research publication or a user's private manuscript. */
export function createHtmlGalleyStudy() {
  const manuscript = createTestManuscript();
  manuscript.documentStructure = createDocumentStructureProfile('study');
  manuscript.locale = 'hu';
  manuscript.title = 'A strukturált kézirattól az olvasható webes tanulmányig';
  manuscript.subtitle = 'Az OJS HTML-átadásának mintatanulmánya';
  manuscript.abstract = 'Ez a bemutató a címek, bekezdések és táblázatok megőrzését szemlélteti a kézirat HTML-változatában. Kizárólag tesztelésre készült; nem közöl kutatási eredményeket.';
  manuscript.keywords = ['mintatanulmány', 'HTML', 'OJS'];
  manuscript.agents[0]!.names = [{ id: 'demo-author-name', value: 'Mintaszerző (fiktív)', preferred: true, visibility: 'public' }];
  manuscript.agents[0]!.affiliations = [];
  const paragraph = (id: string, text: string) => ({ id, type: 'paragraph' as const, content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }) });
  manuscript.sections = [
    { id: 'demo-introduction', title: 'A bemutató célja', blocks: [paragraph('demo-p1', 'A kézirat szerkezete a böngészőben is követhető marad: a főcím, az összefoglaló és a fejezetcímek külön elemekként jelennek meg. Az ékezetes szöveg és a hosszabb bekezdések mobilon is olvashatók.')] },
    { id: 'demo-method', title: 'Az átadás menete', blocks: [paragraph('demo-p2', 'A szerkesztő ellenőrzi a célcikket és az előnézetet, majd átadja a HTML-változatot. Az OJS-ben külön olvasói fájl keletkezik. Ennek közzétételéről továbbra is a folyóirat szerkesztősége dönt.'), {
      id: 'demo-table', type: 'table', content: '', visual: { kind: 'table', headerRows: 1, caption: 'A bemutató ellenőrzési pontjai', cells: [['Elem', 'Elvárt viselkedés'], ['Cím és fejezetek', 'Szemantikus HTML'], ['Táblázat', 'Olvasható fejléc és sorok'], ['Ismételt átadás', 'Ugyanazon HTML-változat frissítése'], ['Közzététel', 'Külön szerkesztői lépés']] },
    }] },
    { id: 'demo-conclusion', title: 'Ellenőrzés', blocks: [paragraph('demo-p3', 'A teszt akkor teljes, ha a HTML az OJS-ben megnyitható, egy módosított bekezdés ismételt átadása ugyanazt a változatot frissíti, és a közzétett cikket a rendszer nem engedi felülírni.')] },
  ];
  return manuscript;
}
