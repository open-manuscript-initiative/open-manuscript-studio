import { getResearchModuleCopyByLocale } from '../moduleTranslationCatalog';
import { normalizeModuleLocale } from '../moduleLocale';
import { useRef } from 'react';
import './mathematics.css';
import { renderLatexMath, sanitizeMathMlForPreview } from '../../model/equationRendering';

const templates = [
  ['fraction', '\\frac{a}{b}'],
  ['root', '\\sqrt[n]{x}'],
  ['scripts', 'x_{i}^{2}'],
  ['sum', '\\sum_{i=1}^{n} x_i'],
  ['integral', '\\int_{a}^{b} f(x)\\,dx'],
  ['matrix', '\\begin{pmatrix}a & b \\\\ c & d\\end{pmatrix}'],
  ['cases', 'f(x)=\\begin{cases}x^2 & x\\ge 0 \\\\ -x & x<0\\end{cases}'],
  ['aligned', '\\begin{aligned}a+b &= c \\\\ a &= c-b\\end{aligned}'],
] as const;

const labels = getResearchModuleCopyByLocale('mathematics-equation-editor/labels');

interface Props {
  value: string;
  onChange: (value: string) => void;
  locale: string;
  /** Retain imported MathML preview until the author explicitly edits LaTeX. */
  mathmlSource?: string;
}

export function EquationEditor({ value, onChange, locale, mathmlSource }: Props) {
  const input = useRef<HTMLTextAreaElement>(null);
  const copy = labels[normalizeModuleLocale(locale)];
  const result = renderLatexMath(value);
  const preview = mathmlSource !== undefined ? sanitizeMathMlForPreview(mathmlSource) : result.mathml;

  function insertTemplate(template: string) {
    const start = input.current?.selectionStart ?? value.length;
    const end = input.current?.selectionEnd ?? start;
    onChange(value.slice(0, start) + template + value.slice(end));
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(start, start + template.length);
    });
  }

  return <div className="omi-equation-editor">
    <label><span>{copy.source}</span>
      <textarea ref={input} spellCheck={false} value={value}
        onChange={(event) => onChange(event.target.value)} />
    </label>
    <small>{copy.hint}</small>
    <div className="omi-visual-insert-actions" role="group" aria-label={copy.templates}>
      {templates.map(([key, template]) => <button key={key} type="button"
        onClick={() => insertTemplate(template)}>{copy[key]}</button>)}
    </div>
    <div className="omi-equation-preview" aria-label={copy.preview}
      dangerouslySetInnerHTML={{ __html: preview }} />
    {mathmlSource === undefined && value.trim() && result.error
      ? <p role="alert">{copy.error}: {result.error}</p> : null}
  </div>;
}
