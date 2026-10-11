import { renderToString } from 'katex';

const MATHML_NAMESPACE = 'http://www.w3.org/1998/Math/MathML';
const ALLOWED_MATHML_ELEMENTS = new Set([
  'math', 'mrow', 'mi', 'mn', 'mo', 'mtext', 'mspace',
  'mfrac', 'msqrt', 'mroot', 'msup', 'msub', 'msubsup',
  'munder', 'mover', 'munderover', 'mmultiscripts', 'mprescripts', 'none',
  'mtable', 'mtr', 'mtd', 'mfenced', 'menclose', 'mstyle',
  'semantics', 'annotation', 'mpadded', 'mphantom',
]);
const ALLOWED_MATHML_ATTRIBUTES = new Set([
  'display', 'mathvariant', 'stretchy', 'fence', 'separator', 'separators',
  'form', 'accent', 'accentunder', 'largeop', 'movablelimits', 'symmetric',
  'lspace', 'rspace', 'minsize', 'maxsize', 'linethickness', 'bevelled',
  'notation', 'rowspan', 'columnspan', 'columnalign', 'rowalign',
  'columnspacing', 'rowspacing', 'scriptlevel', 'displaystyle', 'encoding',
]);

export interface LatexRenderResult {
  mathml: string;
  error?: string;
}

export const MAX_EQUATION_SOURCE_LENGTH = 8192;

/** Preserve input on error; never silently reinterpret an unsupported command. */
export function renderLatexMath(latex: string): LatexRenderResult {
  try {
    if (latex.length > MAX_EQUATION_SOURCE_LENGTH) throw new Error('Equation source exceeds 8192 characters.');
    if (!latex.trim()) throw new Error('Enter a mathematical expression.');
    let untrustedCommand = false;
    const rendered = renderToString(latex, {
      output: 'mathml', displayMode: true, throwOnError: true,
      strict: 'error', maxExpand: 1000, maxSize: 20,
      macros: {},
      trust: () => { untrustedCommand = true; return false; },
    });
    if (untrustedCommand) throw new Error('Links, external images and HTML commands are not permitted in equations.');
    const start = rendered.indexOf('<math');
    const end = rendered.lastIndexOf('</math>');
    if (start < 0 || end < start) throw new Error('No MathML representation was generated.');
    return { mathml: rendered.slice(start, end + '</math>'.length) };
  } catch (error) {
    return {
      mathml: textOnlyMathMl(latex),
      error: error instanceof Error ? error.message : 'Invalid or unsupported LaTeX.',
    };
  }
}

export function latexToMathMl(latex: string): string {
  return renderLatexMath(latex).mathml;
}

/**
 * Sanitizes MathML that originated outside Studio before it reaches
 * dangerouslySetInnerHTML. Only MathML elements and presentation attributes
 * are retained; links, event handlers, style and foreign XML/HTML are removed.
 */
export function sanitizeMathMlForPreview(source: string): string {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return textOnlyMathMl(source.replace(/<[^>]*>/g, ' '));
  }

  const document = new DOMParser().parseFromString(source, 'application/xml');
  if (document.querySelector('parsererror')) {
    return textOnlyMathMl(source);
  }

  const root = document.documentElement;
  if (root.localName !== 'math') {
    return textOnlyMathMl(root.textContent ?? source);
  }

  const elements = [root, ...Array.from(root.getElementsByTagName('*'))];

  for (const element of elements) {
    if (!element.isConnected && element !== root) {
      continue;
    }

    if (!ALLOWED_MATHML_ELEMENTS.has(element.localName)) {
      element.replaceWith(document.createTextNode(element.textContent ?? ''));
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      const attributeName = attribute.localName.toLowerCase();
      const qualifiedName = attribute.name.toLowerCase();
      const allowedNamespaceDeclaration =
        element === root && qualifiedName === 'xmlns';

      if (
        allowedNamespaceDeclaration ||
        ALLOWED_MATHML_ATTRIBUTES.has(attributeName)
      ) {
        continue;
      }

      element.removeAttributeNode(attribute);
    }
  }

  root.setAttribute('xmlns', MATHML_NAMESPACE);
  root.setAttribute('display', 'block');
  return new XMLSerializer().serializeToString(root);
}

function textOnlyMathMl(value: string): string {
  return `<math xmlns="${MATHML_NAMESPACE}" display="block"><mtext>${escapeXml(value.trim())}</mtext></math>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
