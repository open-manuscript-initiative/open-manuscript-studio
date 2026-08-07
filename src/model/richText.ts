export interface SemanticInlineStyle {
  strong: boolean;
  emphasis: boolean;
  strike: boolean;
  verticalAlign?: 'super' | 'sub';
}

/**
 * External hyperlinks are deliberately separate from OMI internal cross-
 * references. Only browser-safe http(s) and mailto destinations are accepted.
 */
export function normalizeExternalHref(
  value: string | undefined,
): string | undefined {
  const input = (value ?? '').trim();
  if (!input) return undefined;

  const candidate = /^(https?:|mailto:)/i.test(input)
    ? input
    : `https://${input}`;

  try {
    const url = new URL(candidate);
    const protocol = url.protocol.toLowerCase();

    if (protocol !== 'http:' && protocol !== 'https:' && protocol !== 'mailto:') {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
}

/**
 * Normalizes a BCP 47 language tag without restricting manuscript authors to
 * the three Studio UI languages.
 */
export function normalizeInlineLanguageTag(
  value: string | undefined,
): string | undefined {
  const input = (value ?? '').trim();
  if (!input) return undefined;

  try {
    const [canonical] = Intl.getCanonicalLocales(input);
    return canonical;
  } catch {
    return undefined;
  }
}

/**
 * Extracts the small subset of Word/Office inline CSS that carries scholarly
 * semantics. Presentation-only CSS is intentionally ignored.
 */
export function detectSemanticInlineStyle(
  style: string | undefined,
): SemanticInlineStyle {
  const normalized = (style ?? '').toLowerCase();
  const weightMatch = normalized.match(/font-weight\s*:\s*([^;]+)/);
  const numericWeight = weightMatch?.[1]?.match(/\d{3}/)?.[0];
  const strong =
    /font-weight\s*:\s*(bold|bolder)/.test(normalized) ||
    (numericWeight ? Number(numericWeight) >= 600 : false);

  return {
    strong,
    emphasis: /font-style\s*:\s*italic/.test(normalized),
    strike: /text-decoration(?:-line)?\s*:[^;]*line-through/.test(normalized),
    verticalAlign: /vertical-align\s*:\s*super/.test(normalized)
      ? 'super'
      : /vertical-align\s*:\s*sub/.test(normalized)
        ? 'sub'
        : undefined,
  };
}

const DANGEROUS_ELEMENTS =
  'script,style,meta,link,iframe,object,embed,form,input,button,textarea,select';

const ALLOWED_TAGS = new Set([
  'P',
  'BR',
  'STRONG',
  'EM',
  'S',
  'SUP',
  'SUB',
  'A',
  'BLOCKQUOTE',
  'UL',
  'OL',
  'LI',
  'PRE',
  'CODE',
  'SPAN',
]);

/**
 * Browser-side paste cleanup for Word and other rich HTML sources.
 *
 * The function keeps semantic structure supported by Studio while removing
 * Office classes, inline presentation CSS, event handlers and active markup.
 */
export function sanitizeRichTextPasteHtml(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return html;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');

  document.querySelectorAll(DANGEROUS_ELEMENTS).forEach((element) => {
    element.remove();
  });

  const elements = Array.from(document.body.querySelectorAll('*'));

  for (const originalElement of elements) {
    if (!originalElement.isConnected) continue;

    let element = normalizeSemanticTag(originalElement, document);
    const style = detectSemanticInlineStyle(element.getAttribute('style') ?? undefined);
    const language = normalizeInlineLanguageTag(
      element.getAttribute('lang') ??
        element.getAttribute('xml:lang') ??
        undefined,
    );

    if (style.strong && element.tagName !== 'STRONG') {
      wrapChildren(element, 'strong', document);
    }
    if (style.emphasis && element.tagName !== 'EM') {
      wrapChildren(element, 'em', document);
    }
    if (style.strike && element.tagName !== 'S') {
      wrapChildren(element, 's', document);
    }
    if (style.verticalAlign === 'super' && element.tagName !== 'SUP') {
      wrapChildren(element, 'sup', document);
    }
    if (style.verticalAlign === 'sub' && element.tagName !== 'SUB') {
      wrapChildren(element, 'sub', document);
    }

    if (language) {
      if (element.tagName === 'SPAN') {
        element.setAttribute('lang', language);
      } else {
        const languageSpan = document.createElement('span');
        languageSpan.setAttribute('lang', language);
        while (element.firstChild) languageSpan.append(element.firstChild);
        element.append(languageSpan);
      }
    }

    if (element.tagName === 'A') {
      const href = normalizeExternalHref(element.getAttribute('href') ?? undefined);
      if (href) {
        element.setAttribute('href', href);
      } else {
        element.removeAttribute('href');
      }
    }

    removePresentationAttributes(element);

    if (!ALLOWED_TAGS.has(element.tagName)) {
      if (element.tagName === 'DIV') {
        element = renameElement(element, 'p', document);
        removePresentationAttributes(element);
      } else {
        unwrapElement(element);
      }
    }
  }

  return document.body.innerHTML;
}

function normalizeSemanticTag(
  element: Element,
  document: Document,
): Element {
  switch (element.tagName) {
    case 'B':
      return renameElement(element, 'strong', document);
    case 'I':
      return renameElement(element, 'em', document);
    case 'STRIKE':
      return renameElement(element, 's', document);
    default:
      return element;
  }
}

function renameElement(
  element: Element,
  tagName: string,
  document: Document,
): Element {
  const replacement = document.createElement(tagName);

  for (const attribute of Array.from(element.attributes)) {
    replacement.setAttribute(attribute.name, attribute.value);
  }
  while (element.firstChild) replacement.append(element.firstChild);
  element.replaceWith(replacement);
  return replacement;
}

function wrapChildren(
  element: Element,
  tagName: string,
  document: Document,
): void {
  if (!element.firstChild) return;

  const wrapper = document.createElement(tagName);
  while (element.firstChild) wrapper.append(element.firstChild);
  element.append(wrapper);
}

function removePresentationAttributes(element: Element): void {
  const href = element.tagName === 'A' ? element.getAttribute('href') : null;
  const title = element.tagName === 'A' ? element.getAttribute('title') : null;
  const lang = element.tagName === 'SPAN' ? element.getAttribute('lang') : null;

  for (const attribute of Array.from(element.attributes)) {
    element.removeAttribute(attribute.name);
  }

  if (href) element.setAttribute('href', href);
  if (title) element.setAttribute('title', title);
  if (lang) element.setAttribute('lang', lang);
}

function unwrapElement(element: Element): void {
  const parent = element.parentNode;
  if (!parent) return;

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  element.remove();
}
