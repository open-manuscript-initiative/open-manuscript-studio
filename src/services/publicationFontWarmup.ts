import { cssStringLiteral } from './embeddedCss';
import { resolvePublicationParagraphStyle, type PublicationStyle } from './publicationStyleExport';

const MAX_FONT_REQUESTS = 24;
const SAMPLE = 'AaBb0123 ÁÉÍÓÖŐÚÜŰ áéíóöőúüű ß —';

const GENERIC_FAMILIES = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong']);

/** Font size does not distinguish CSS font faces; use a common probe size. */
export function publicationFontRequests(style: PublicationStyle): string[] {
  const requests = new Set<string>();
  const add = (family: string, weight: number, fontStyle: string) => {
    const name = family.trim();
    if (!name) return;
    const token = GENERIC_FAMILIES.has(name.toLowerCase()) ? name.toLowerCase() : cssStringLiteral(name);
    requests.add(`${fontStyle === 'italic' ? 'italic' : 'normal'} ${Math.max(100, Math.min(900, weight))} 16px ${token}`);
  };
  // Body and footnote faces are first, including common direct-format variants.
  for (const family of [style.fonts.body.family, style.fonts.note.family]) {
    add(family, 400, 'normal');
    add(family, 700, 'normal');
    add(family, 400, 'italic');
    add(family, 700, 'italic');
  }
  for (const item of style.paragraphStyles.items) {
    const resolved = resolvePublicationParagraphStyle(style, item.id);
    add(resolved.fontFamily, resolved.fontWeight, resolved.fontStyle);
    if (requests.size >= MAX_FONT_REQUESTS) break;
  }
  return [...requests].slice(0, MAX_FONT_REQUESTS);
}

type FontLoader = Pick<FontFaceSet, 'check' | 'load'>;

/** Warm existing CSS faces without blocking editing or requiring external fonts.
 * The first measurement may wait briefly, never indefinitely. Late font loads
 * remain covered by the caller's normal font-metric invalidation listener.
 */
export function preparePublicationFonts(
  fonts: FontLoader | undefined,
  requests: readonly string[],
  ready: () => void,
  maxWaitMs = 350,
): () => void {
  let done = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finish = () => {
    if (done) return;
    done = true;
    if (timer !== undefined) clearTimeout(timer);
    ready();
  };
  const pending: Promise<unknown>[] = [];
  if (fonts) {
    for (const request of requests) {
      try {
        if (!fonts.check(request, SAMPLE)) pending.push(fonts.load(request, SAMPLE));
      } catch {
        // Invalid/unavailable faces fall back to normal browser font matching.
      }
    }
  }
  if (!pending.length) finish();
  else {
    timer = setTimeout(finish, maxWaitMs);
    void Promise.allSettled(pending).then(finish);
  }
  return () => {
    done = true;
    if (timer !== undefined) clearTimeout(timer);
  };
}
