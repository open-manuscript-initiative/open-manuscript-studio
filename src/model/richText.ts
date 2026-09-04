export interface SemanticInlineStyle {
  strong: boolean;
  emphasis: boolean;
  strike: boolean;
  underline: boolean;
  smallCaps: boolean;
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
 * Extracts the subset of Word/Office inline CSS that carries durable scholarly
 * or typographic semantics. Font family, size, color and other presentation-only
 * CSS are deliberately ignored.
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
    underline: /text-decoration(?:-line)?\s*:[^;]*underline/.test(normalized),
    smallCaps:
      /font-variant(?:-caps)?\s*:\s*(?:small-caps|all-small-caps)/.test(normalized) ||
      /mso-style-textfill-type\s*:\s*solid/.test(normalized) &&
        /font-variant\s*:\s*small-caps/.test(normalized),
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
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'STRONG',
  'EM',
  'S',
  'U',
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
 * Word heading styles are promoted to real heading elements, and unsupported
 * Word tables are flattened row-by-row rather than silently losing cell
 * boundaries.
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

  flattenUnsupportedTables(document);

  const elements = Array.from(document.body.querySelectorAll('*'));

  for (const originalElement of elements) {
    if (!originalElement.isConnected) continue;

    let element = normalizeWordStructuralTag(originalElement, document);
    element = normalizeSemanticTag(element, document);
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
    if (style.underline && element.tagName !== 'U') {
      wrapChildren(element, 'u', document);
    }
    if (style.smallCaps) {
      wrapChildrenWithAttribute(
        element,
        'span',
        'data-omi-small-caps',
        'true',
        document,
      );
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
      const rawHref = element.getAttribute('href') ?? undefined;
      const href = rawHref?.startsWith('#')
        ? undefined
        : normalizeExternalHref(rawHref);
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

function normalizeWordStructuralTag(
  element: Element,
  document: Document,
): Element {
  if (element.tagName !== 'P' && element.tagName !== 'DIV') return element;

  const className = element.getAttribute('class') ?? '';
  const style = element.getAttribute('style') ?? '';
  const headingLevel = detectWordHeadingLevel(className, style);
  if (!headingLevel) return element;

  return renameElement(element, `h${headingLevel}`, document);
}

export function detectWordHeadingLevel(
  className: string | undefined,
  style: string | undefined,
): 1 | 2 | 3 | 4 | 5 | 6 | undefined {
  const classes = (className ?? '').toLowerCase();
  const css = (style ?? '').toLowerCase();
  const classMatch = classes.match(/(?:mso)?heading\s*([1-6])|msoheading([1-6])/i);
  const styleNameMatch = css.match(/mso-style-name\s*:\s*['"]?heading\s*([1-6])/i);
  const outlineMatch = css.match(/mso-outline-level\s*:\s*([0-5])/i);
  const raw = classMatch?.[1] ?? classMatch?.[2] ?? styleNameMatch?.[1];

  if (raw) return Number(raw) as 1 | 2 | 3 | 4 | 5 | 6;
  if (outlineMatch?.[1]) {
    return (Number(outlineMatch[1]) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
  }
  return undefined;
}

function flattenUnsupportedTables(document: Document): void {
  document.querySelectorAll('table').forEach((table) => {
    const replacement = document.createElement('div');
    const rows = Array.from(table.querySelectorAll('tr'));

    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll(':scope > th, :scope > td'));
      const paragraph = document.createElement('p');
      cells.forEach((cell, index) => {
        if (index > 0) paragraph.append(document.createTextNode(' — '));
        while (cell.firstChild) paragraph.append(cell.firstChild);
      });
      if (paragraph.textContent?.trim()) replacement.append(paragraph);
    }

    table.replaceWith(replacement);
  });
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

function wrapChildrenWithAttribute(
  element: Element,
  tagName: string,
  attribute: string,
  value: string,
  document: Document,
): void {
  if (!element.firstChild) return;
  const wrapper = document.createElement(tagName);
  wrapper.setAttribute(attribute, value);
  while (element.firstChild) wrapper.append(element.firstChild);
  element.append(wrapper);
}

function removePresentationAttributes(element: Element): void {
  const href = element.tagName === 'A' ? element.getAttribute('href') : null;
  const title = element.tagName === 'A' ? element.getAttribute('title') : null;
  const lang = element.tagName === 'SPAN' ? element.getAttribute('lang') : null;
  const smallCaps = element.tagName === 'SPAN'
    ? element.getAttribute('data-omi-small-caps')
    : null;

  for (const attribute of Array.from(element.attributes)) {
    element.removeAttribute(attribute.name);
  }

  if (href) element.setAttribute('href', href);
  if (title) element.setAttribute('title', title);
  if (lang) element.setAttribute('lang', lang);
  if (smallCaps) element.setAttribute('data-omi-small-caps', smallCaps);
}

function unwrapElement(element: Element): void {
  const parent = element.parentNode;
  if (!parent) return;

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  element.remove();
}
