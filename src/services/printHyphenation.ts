type HyphenateSync = (
  text: string,
  options?: { minWordLength?: number; hyphenChar?: string },
) => string;

interface ImportedHyphenationModule {
  default?: { hyphenateSync?: HyphenateSync };
  hyphenateSync?: HyphenateSync;
}

type HyphenationModuleLoader = () => Promise<ImportedHyphenationModule>;

/**
 * Language patterns are split into lazy chunks, so opening the editor does not
 * download every dictionary. A print export loads only the dictionaries used
 * by the document's BCP 47 language tags.
 */
const MODULE_LOADERS = {
  af: () => import('hyphen/af/index.js'),
  as: () => import('hyphen/as/index.js'),
  be: () => import('hyphen/be/index.js'),
  bg: () => import('hyphen/bg/index.js'),
  bn: () => import('hyphen/bn/index.js'),
  ca: () => import('hyphen/ca/index.js'),
  cs: () => import('hyphen/cs/index.js'),
  cy: () => import('hyphen/cy/index.js'),
  da: () => import('hyphen/da/index.js'),
  de: () => import('hyphen/de/index.js'),
  el: () => import('hyphen/el/index.js'),
  en: () => import('hyphen/en/index.js'),
  'en-gb': () => import('hyphen/en-gb/index.js'),
  es: () => import('hyphen/es/index.js'),
  et: () => import('hyphen/et/index.js'),
  eu: () => import('hyphen/eu/index.js'),
  fi: () => import('hyphen/fi/index.js'),
  fr: () => import('hyphen/fr/index.js'),
  ga: () => import('hyphen/ga/index.js'),
  gl: () => import('hyphen/gl/index.js'),
  gu: () => import('hyphen/gu/index.js'),
  hi: () => import('hyphen/hi/index.js'),
  hr: () => import('hyphen/hr/index.js'),
  hu: () => import('hyphen/hu/index.js'),
  hy: () => import('hyphen/hy/index.js'),
  ia: () => import('hyphen/ia/index.js'),
  id: () => import('hyphen/id/index.js'),
  is: () => import('hyphen/is/index.js'),
  it: () => import('hyphen/it/index.js'),
  ka: () => import('hyphen/ka/index.js'),
  kn: () => import('hyphen/kn/index.js'),
  la: () => import('hyphen/la/index.js'),
  lt: () => import('hyphen/lt/index.js'),
  lv: () => import('hyphen/lv/index.js'),
  mk: () => import('hyphen/mk/index.js'),
  ml: () => import('hyphen/ml/index.js'),
  mr: () => import('hyphen/mr/index.js'),
  nb: () => import('hyphen/nb/index.js'),
  nl: () => import('hyphen/nl/index.js'),
  nn: () => import('hyphen/nn/index.js'),
  no: () => import('hyphen/no/index.js'),
  oc: () => import('hyphen/oc/index.js'),
  or: () => import('hyphen/or/index.js'),
  pa: () => import('hyphen/pa/index.js'),
  pi: () => import('hyphen/pi/index.js'),
  pl: () => import('hyphen/pl/index.js'),
  pt: () => import('hyphen/pt/index.js'),
  rm: () => import('hyphen/rm/index.js'),
  ro: () => import('hyphen/ro/index.js'),
  ru: () => import('hyphen/ru/index.js'),
  sa: () => import('hyphen/sa/index.js'),
  'sh-cyrl': () => import('hyphen/sh-cyrl/index.js'),
  'sh-latn': () => import('hyphen/sh-latn/index.js'),
  'sr-cyrl': () => import('hyphen/sr-cyrl/index.js'),
  sk: () => import('hyphen/sk/index.js'),
  sl: () => import('hyphen/sl/index.js'),
  sq: () => import('hyphen/sq/index.js'),
  sv: () => import('hyphen/sv/index.js'),
  ta: () => import('hyphen/ta/index.js'),
  te: () => import('hyphen/te/index.js'),
  th: () => import('hyphen/th/index.js'),
  tk: () => import('hyphen/tk/index.js'),
  tr: () => import('hyphen/tr/index.js'),
  uk: () => import('hyphen/uk/index.js'),
  'zh-latn-pinyin': () => import('hyphen/zh-latn-pinyin/index.js'),
} satisfies Record<string, HyphenationModuleLoader>;

export type PrintHyphenationModuleId = keyof typeof MODULE_LOADERS;

const moduleCache = new Map<PrintHyphenationModuleId, Promise<HyphenateSync | null>>();
const HYPHENATABLE_SELECTOR = [
  '.article-body p',
  '.article-body li',
  '.article-body blockquote',
  '.abstract p',
  '.article-abstract p',
  '.abstract-body',
  'figcaption',
  'table caption',
  'td',
  'th',
  '.article-notes li',
  '.footnotes li',
  '[role="doc-endnotes"] li',
  '.bibliography p',
  '.bibliography li',
  '.references li',
].join(', ');
const SKIP_SELECTOR = 'a, code, kbd, math, pre, samp, script, style, svg, [data-omi-no-hyphenation]';
const SHOW_TEXT = 4;

export function resolvePrintHyphenationModule(
  languageTag: string | null | undefined,
): PrintHyphenationModuleId | null {
  const locale = parseLocale(languageTag);
  if (!locale) return null;

  const language = locale.language?.toLowerCase();
  if (!language || language === 'und') return null;
  const region = locale.region?.toUpperCase();
  const script = locale.script;

  if (language === 'en' && region === 'GB') return 'en-gb';
  if (language === 'sr') return script === 'Latn' ? 'sh-latn' : 'sr-cyrl';
  if (language === 'sh') return script === 'Latn' ? 'sh-latn' : 'sh-cyrl';
  if (language === 'zh') return script === 'Latn' ? 'zh-latn-pinyin' : null;

  return language in MODULE_LOADERS
    ? language as PrintHyphenationModuleId
    : null;
}

export async function hyphenatePrintText(
  text: string,
  languageTag: string,
): Promise<string> {
  const moduleId = resolvePrintHyphenationModule(languageTag);
  if (!moduleId) return text;
  const hyphenate = await loadHyphenator(moduleId);
  if (!hyphenate) return text;
  return hyphenate(text.replaceAll('\u00ad', ''), {
    minWordLength: 6,
    hyphenChar: '\u00ad',
  });
}

/**
 * Adds discretionary soft-hyphen opportunities to print-only generated HTML.
 * The canonical OMI manuscript is never changed. Inline `lang` spans override
 * the document language, allowing several dictionaries in one publication.
 */
export async function hyphenatePrintHtml(
  html: string,
  fallbackLanguage: string,
): Promise<string> {
  if (typeof DOMParser === 'undefined') return html;

  const document = new DOMParser().parseFromString(html, 'text/html');
  const defaultLanguage = document.documentElement.lang || fallbackLanguage;
  const nodes = collectHyphenatableTextNodes(document);

  await Promise.all(nodes.map(async (node) => {
    const element = node.parentElement;
    if (!element) return;
    const language = element.closest('[lang]')?.getAttribute('lang') || defaultLanguage;
    const moduleId = resolvePrintHyphenationModule(language);
    if (!moduleId) return;
    const hyphenate = await loadHyphenator(moduleId);
    if (!hyphenate) return;

    node.data = hyphenate(node.data.replaceAll('\u00ad', ''), {
      minWordLength: 6,
      hyphenChar: '\u00ad',
    });
    markHyphenationScope(element, document.documentElement, moduleId);
  }));

  return `<!doctype html>\n${document.documentElement.outerHTML}\n`;
}

function collectHyphenatableTextNodes(document: Document): Text[] {
  const nodes = new Set<Text>();
  for (const container of document.querySelectorAll(HYPHENATABLE_SELECTOR)) {
    const walker = document.createTreeWalker(container, SHOW_TEXT);
    let current = walker.nextNode();
    while (current) {
      const text = current as Text;
      if (
        text.data.trim().length > 0
        && !text.parentElement?.closest(SKIP_SELECTOR)
      ) {
        nodes.add(text);
      }
      current = walker.nextNode();
    }
  }
  return [...nodes];
}

function markHyphenationScope(
  element: Element,
  documentElement: HTMLElement,
  moduleId: PrintHyphenationModuleId,
): void {
  const languageOwner = element.closest('[lang]');
  const scope = languageOwner && languageOwner !== documentElement
    ? languageOwner
    : element.closest(HYPHENATABLE_SELECTOR);
  if (!scope) return;

  const modules = new Set(
    (scope.getAttribute('data-omi-hyphenation-module') ?? '')
      .split(/\s+/)
      .filter(Boolean),
  );
  modules.add(moduleId);
  scope.setAttribute('data-omi-hyphenation-module', [...modules].sort().join(' '));
}

async function loadHyphenator(
  moduleId: PrintHyphenationModuleId,
): Promise<HyphenateSync | null> {
  const cached = moduleCache.get(moduleId);
  if (cached) return cached;

  const loading = MODULE_LOADERS[moduleId]().then((module) => (
    module.hyphenateSync ?? module.default?.hyphenateSync ?? null
  )).catch(() => null);
  moduleCache.set(moduleId, loading);
  return loading;
}

function parseLocale(languageTag: string | null | undefined): Intl.Locale | null {
  if (!languageTag) return null;
  try {
    return new Intl.Locale(languageTag.trim().replaceAll('_', '-'));
  } catch {
    return null;
  }
}
