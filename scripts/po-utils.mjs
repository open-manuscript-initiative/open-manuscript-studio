export function escapePointerToken(value) {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}

export function unescapePointerToken(value) {
  return value.replace(/~1/g, '/').replace(/~0/g, '~');
}

export function flattenStrings(value, pointer = '', out = []) {
  if (typeof value === 'string') {
    out.push([pointer || '/', value]);
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      flattenStrings(item, `${pointer}/${index}`, out);
    });
    return out;
  }

  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flattenStrings(child, `${pointer}/${escapePointerToken(key)}`, out);
    }
    return out;
  }

  throw new TypeError(`Unsupported translation value at ${pointer || '<root>'}.`);
}

export function setAtPointer(root, pointer, value) {
  if (pointer === '/') {
    throw new Error('Root-level string dictionaries are not supported.');
  }

  const tokens = pointer
    .split('/')
    .slice(1)
    .map(unescapePointerToken);

  let target = root;
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index];
    if (!(token in target)) {
      throw new Error(`Unknown translation path: ${pointer}`);
    }
    target = target[token];
  }

  const finalToken = tokens.at(-1);
  if (finalToken === undefined || !(finalToken in target)) {
    throw new Error(`Unknown translation path: ${pointer}`);
  }

  target[finalToken] = value;
}

export function poQuote(value) {
  return JSON.stringify(value);
}

export function renderPo({ locale, entries }) {
  const lines = [
    'msgid ""',
    'msgstr ""',
    '"Project-Id-Version: Open Manuscript Studio\\n"',
    `"Language: ${locale}\\n"`,
    '"MIME-Version: 1.0\\n"',
    '"Content-Type: text/plain; charset=UTF-8\\n"',
    '"Content-Transfer-Encoding: 8bit\\n"',
    '',
  ];

  for (const { pointer, source, translation } of entries) {
    lines.push(`#. OMI translation key: ${pointer}`);
    lines.push(`msgctxt ${poQuote(pointer)}`);
    lines.push(`msgid ${poQuote(source)}`);
    lines.push(`msgstr ${poQuote(translation)}`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function parseQuoted(value, lineNumber) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(
      `Invalid PO string at line ${lineNumber}: ${error.message}`,
      { cause: error },
    );
  }
}

export function parsePo(source) {
  const entries = [];
  let current = {};
  let activeField = null;

  const flush = () => {
    if (Object.keys(current).length === 0) return;
    if (current.msgctxt !== undefined) {
      if (current.msgid === undefined || current.msgstr === undefined) {
        throw new Error(`Incomplete PO entry for ${current.msgctxt}.`);
      }
      entries.push({
        pointer: current.msgctxt,
        source: current.msgid,
        translation: current.msgstr,
      });
    }
    current = {};
    activeField = null;
  };

  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();

    if (line.length === 0) {
      flush();
      return;
    }

    if (line.startsWith('#')) return;

    const fieldMatch = line.match(/^(msgctxt|msgid|msgstr)\s+(".*")$/);
    if (fieldMatch) {
      const [, field, quoted] = fieldMatch;
      current[field] = parseQuoted(quoted, lineNumber);
      activeField = field;
      return;
    }

    if (line.startsWith('"')) {
      if (!activeField) {
        // Header continuation lines are intentionally ignored.
        return;
      }
      current[activeField] += parseQuoted(line, lineNumber);
      return;
    }

    throw new Error(`Unsupported PO syntax at line ${lineNumber}: ${rawLine}`);
  });

  flush();
  return entries;
}
