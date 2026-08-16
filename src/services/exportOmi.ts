import type { OmiManuscript } from '../types/omi';
import { getPublicationSignatures } from './authorSignatureApi';

export function serializeOmiJson(
  manuscript: OmiManuscript,
): string {
  const portableManuscript = {
    ...manuscript,
    publicationSignatures: getPublicationSignatures(manuscript.id),
  } as OmiManuscript & {
    publicationSignatures: ReturnType<typeof getPublicationSignatures>;
  };

  // `authors` is retained only as an import compatibility field.
  // Canonical exports use agents and contextual contributions.
  delete portableManuscript.authors;

  return JSON.stringify(portableManuscript, null, 2);
}

export function downloadOmiJson(manuscript: OmiManuscript): void {
  const blob = new Blob([serializeOmiJson(manuscript)], {
    type: 'application/vnd.openmanuscript+json;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slugify(manuscript.title || 'manuscript')}.omi.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
