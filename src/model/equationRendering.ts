const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ',
  pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  sum: '∑', prod: '∏', int: '∫', infty: '∞', pm: '±', times: '×', cdot: '·',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', approx: '≈', to: '→', rightarrow: '→', leftarrow: '←',
  in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆', cup: '∪', cap: '∩', partial: '∂', nabla: '∇',
};

export function latexToMathMl(latex: string): string {
  const parser = new LatexMathParser(latex);
  return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mrow>${parser.parse()}</mrow></math>`;
}

class LatexMathParser {
  private index = 0;
  private readonly source: string;

  constructor(source: string) {
    this.source = source;
  }

  parse(stop?: string): string {
    let output = '';

    while (this.index < this.source.length) {
      const character = this.source[this.index] ?? '';
      if (stop && character === stop) {
        this.index += 1;
        break;
      }
      if (/\s/.test(character)) {
        this.index += 1;
        output += '<mspace width="0.25em" />';
        continue;
      }
      if (character === '{') {
        this.index += 1;
        output += `<mrow>${this.parse('}')}</mrow>`;
        continue;
      }
      if (character === '\\') {
        output += this.parseCommand();
        continue;
      }
      if (character === '^' || character === '_') {
        this.index += 1;
        const script = this.parseAtom();
        const base = takeLastMathElement(output);
        output = base.before + (character === '^'
          ? `<msup>${base.element || '<mi>□</mi>'}${script}</msup>`
          : `<msub>${base.element || '<mi>□</mi>'}${script}</msub>`);
        continue;
      }
      output += this.renderCharacter(character);
      this.index += 1;
    }

    return output;
  }

  private parseCommand(): string {
    this.index += 1;
    const start = this.index;
    while (/[A-Za-z]/.test(this.source[this.index] ?? '')) this.index += 1;
    const command = this.source.slice(start, this.index);

    if (!command) {
      const escaped = this.source[this.index] ?? '';
      this.index += 1;
      return `<mo>${escapeXml(escaped)}</mo>`;
    }

    if (command === 'frac') {
      const numerator = this.parseRequiredGroup();
      const denominator = this.parseRequiredGroup();
      return `<mfrac>${numerator}${denominator}</mfrac>`;
    }

    if (command === 'sqrt') {
      const degree = this.parseOptionalGroup('[', ']');
      const radicand = this.parseRequiredGroup();
      return degree
        ? `<mroot>${radicand}${degree}</mroot>`
        : `<msqrt>${radicand}</msqrt>`;
    }

    if (command === 'text' || command === 'mathrm' || command === 'operatorname') {
      const text = this.readRawRequiredGroup();
      return `<mtext>${escapeXml(text)}</mtext>`;
    }

    if (command === 'left' || command === 'right') {
      this.skipSpaces();
      const delimiter = this.source[this.index] ?? '';
      this.index += 1;
      return `<mo stretchy="true">${escapeXml(delimiter === '.' ? '' : delimiter)}</mo>`;
    }

    if (command === 'begin') {
      const environment = this.readRawRequiredGroup();
      if (environment === 'matrix' || environment === 'pmatrix' || environment === 'bmatrix') {
        return this.parseMatrix(environment);
      }
    }

    const symbol = SYMBOLS[command];
    if (symbol) {
      return `<mo>${escapeXml(symbol)}</mo>`;
    }

    return `<mi>${escapeXml(command)}</mi>`;
  }

  private parseMatrix(environment: string): string {
    const endToken = `\\end{${environment}}`;
    const endIndex = this.source.indexOf(endToken, this.index);
    const body = endIndex >= 0 ? this.source.slice(this.index, endIndex) : this.source.slice(this.index);
    this.index = endIndex >= 0 ? endIndex + endToken.length : this.source.length;
    const rows = body.split(/\\\\/).map((row) => row.split('&'));
    const table = rows.map((row) =>
      `<mtr>${row.map((cell) => `<mtd><mrow>${new LatexMathParser(cell.trim()).parse()}</mrow></mtd>`).join('')}</mtr>`,
    ).join('');
    const matrix = `<mtable>${table}</mtable>`;
    if (environment === 'pmatrix') return `<mrow><mo>(</mo>${matrix}<mo>)</mo></mrow>`;
    if (environment === 'bmatrix') return `<mrow><mo>[</mo>${matrix}<mo>]</mo></mrow>`;
    return matrix;
  }

  private parseRequiredGroup(): string {
    this.skipSpaces();
    if (this.source[this.index] !== '{') {
      return this.parseAtom();
    }
    this.index += 1;
    return `<mrow>${this.parse('}')}</mrow>`;
  }

  private readRawRequiredGroup(): string {
    this.skipSpaces();
    if (this.source[this.index] !== '{') return '';
    this.index += 1;
    const start = this.index;
    let depth = 1;
    while (this.index < this.source.length && depth > 0) {
      const character = this.source[this.index] ?? '';
      if (character === '{') depth += 1;
      if (character === '}') depth -= 1;
      this.index += 1;
    }
    return this.source.slice(start, Math.max(start, this.index - 1));
  }

  private parseOptionalGroup(open: string, close: string): string | null {
    this.skipSpaces();
    if (this.source[this.index] !== open) return null;
    this.index += 1;
    const start = this.index;
    while (this.index < this.source.length && this.source[this.index] !== close) this.index += 1;
    const raw = this.source.slice(start, this.index);
    if (this.source[this.index] === close) this.index += 1;
    return `<mrow>${new LatexMathParser(raw).parse()}</mrow>`;
  }

  private parseAtom(): string {
    this.skipSpaces();
    const character = this.source[this.index] ?? '';
    if (character === '{') {
      this.index += 1;
      return `<mrow>${this.parse('}')}</mrow>`;
    }
    if (character === '\\') return this.parseCommand();
    this.index += 1;
    return this.renderCharacter(character);
  }

  private renderCharacter(character: string): string {
    if (/\d/.test(character)) return `<mn>${character}</mn>`;
    if (/[A-Za-z]/.test(character)) return `<mi>${character}</mi>`;
    if ('+-=<>×÷·±∑∏∫∞()[]|,.'.includes(character)) return `<mo>${escapeXml(character)}</mo>`;
    return `<mi>${escapeXml(character)}</mi>`;
  }

  private skipSpaces(): void {
    while (/\s/.test(this.source[this.index] ?? '')) this.index += 1;
  }
}

function takeLastMathElement(output: string): { before: string; element: string } {
  if (!output) return { before: '', element: '' };
  const tags = ['mrow', 'mfrac', 'msqrt', 'mroot', 'msup', 'msub', 'mtable', 'mi', 'mn', 'mo', 'mtext'];

  for (const tag of tags) {
    const close = `</${tag}>`;
    if (!output.endsWith(close)) continue;
    let depth = 0;
    for (let index = output.length - close.length; index >= 0; index -= 1) {
      if (output.startsWith(close, index)) depth += 1;
      if (output.startsWith(`<${tag}`, index)) {
        depth -= 1;
        if (depth === 0) {
          return { before: output.slice(0, index), element: output.slice(index) };
        }
      }
    }
  }

  return { before: output, element: '' };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
