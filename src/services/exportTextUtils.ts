import type { OmiBlock, OmiManuscript } from '../types/omi';

export function exportFileStem(manuscript: Pick<OmiManuscript, 'title' | 'id'>): string {
  return manuscript.title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || manuscript.id || 'manuscript';
}

export function blockPlainText(block: OmiBlock): string {
  if (block.visual) {
    const caption = 'caption' in block.visual ? block.visual.caption : undefined;
    const label = block.visual.kind.charAt(0).toUpperCase() + block.visual.kind.slice(1);
    return caption?.trim() ? `[${label}: ${caption.trim()}]` : `[${label}]`;
  }

  const value = block.content.trim();
  if (!value) return '';
  try {
    return textFromJson(JSON.parse(value) as unknown).replace(/\s+/g, ' ').trim();
  } catch {
    return value;
  }
}

function textFromJson(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown[]; type?: unknown };
  if (typeof node.text === 'string') return node.text;
  const separator = node.type === 'paragraph' || node.type === 'heading' ? '\n' : '';
  return (node.content ?? []).map(textFromJson).join(separator);
}

export function localizedPublicationLabel(
  locale: string,
  key: 'abstract' | 'keywords' | 'notes' | 'references',
): string {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  const labels = language === 'hu'
    ? { abstract: 'Absztrakt', keywords: 'Kulcsszavak', notes: 'Jegyzetek', references: 'Hivatkozások' }
    : language === 'de'
      ? { abstract: 'Zusammenfassung', keywords: 'Schlüsselwörter', notes: 'Anmerkungen', references: 'Literatur' }
      : { abstract: 'Abstract', keywords: 'Keywords', notes: 'Notes', references: 'References' };
  return labels[key];
}
