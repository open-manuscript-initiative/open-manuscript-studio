import type { OmiManuscript } from '../types/omi';
import { getPublicationSignatures } from './authorSignatureApi';
import { toPortableOmiManuscript } from './omiPortableFormat';

export function serializeOmiJson(
  manuscript: OmiManuscript,
): string {
  const portableManuscript = {
    ...toPortableOmiManuscript(manuscript),
    publicationSignatures: getPublicationSignatures(manuscript.id),
  };

  return JSON.stringify(portableManuscript, null, 2);
}

export function omiJsonFileName(manuscript: Pick<OmiManuscript, 'title'>): string {
  return `${slugify(manuscript.title || 'manuscript') || 'manuscript'}.omi.json`;
}

export function downloadOmiJson(manuscript: OmiManuscript): void {
  const blob = new Blob([serializeOmiJson(manuscript)], {
    type: 'application/vnd.openmanuscript+json;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = omiJsonFileName(manuscript);
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
