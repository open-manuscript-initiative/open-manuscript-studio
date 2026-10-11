import { DOMParser } from '@xmldom/xmldom';

export type EurostatCatalogueRecord = {
  id: string;
  title: string;
  description: string;
  url: string;
  meta: string;
};

const EUROSTAT_DATA_BROWSER = 'https://ec.europa.eu/eurostat/databrowser/view/';

/** Search Eurostat's official multilingual table-of-contents XML. */
export function searchEurostatCatalogue(xml: string, query: string, locale = 'en'): { records: EurostatCatalogueRecord[]; total: number } {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return { records: [], total: 0 };

  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const rootName = document.documentElement?.localName || document.documentElement?.nodeName;
  if (!rootName || /parsererror/i.test(rootName)) throw new Error('Invalid Eurostat catalogue XML');

  const nodes = Array.from(document.getElementsByTagName('*')) as Element[];
  const matches: Array<{ record: EurostatCatalogueRecord; score: number }> = [];
  for (const node of nodes) {
    const name = node.localName || node.nodeName.split(':').pop() || '';
    if (name !== 'leaf') continue;
    const type = (node.getAttribute('type') || '').toLowerCase();
    if (type !== 'dataset' && type !== 'table') continue;

    const code = (node.getAttribute('code') || '').trim();
    if (!/^[a-z0-9_-]+$/i.test(code)) continue;
    const children = Array.from(node.getElementsByTagName('*')) as Element[];
    const title = readLocalizedField(children, 'title', locale) || code;
    const description = readLocalizedField(children, 'shortDescription', locale);
    const unit = readLocalizedField(children, 'unit', locale);
    const searchable = normalize([title, description, unit, code].join(' '));
    if (!terms.every((term) => searchable.includes(term))) continue;

    const titleText = normalize(title);
    const score = terms.reduce((value, term) => value + (titleText.includes(term) ? 3 : 0), 0)
      + (titleText === terms.join(' ') ? 10 : 0);
    const language = locale === 'de' ? 'de' : 'en';
    matches.push({
      score,
      record: {
        id: code,
        title,
        description: description || unit,
        url: EUROSTAT_DATA_BROWSER + encodeURIComponent(code) + '/default/table?lang=' + language,
        meta: code + ' · ' + type,
      },
    });
  }

  matches.sort((left, right) => right.score - left.score || left.record.title.localeCompare(right.record.title));
  return { records: matches.slice(0, 8).map(({ record }) => record), total: matches.length };
}

function readLocalizedField(nodes: Element[], field: string, locale: string): string {
  const candidates = nodes.filter((node) => (node.localName || node.nodeName.split(':').pop()) === field);
  const preferred = locale === 'de' ? 'de' : 'en';
  const getLanguage = (node: Element) => node.getAttribute('lang') || node.getAttribute('xml:lang') || node.getAttributeNS('http://www.w3.org/XML/1998/namespace', 'lang') || '';
  const match = candidates.find((node) => getLanguage(node).toLowerCase() === preferred)
    || candidates.find((node) => getLanguage(node).toLowerCase().startsWith(preferred + '-'))
    || candidates[0];
  return match?.textContent?.replace(/\s+/g, ' ').trim() || '';
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}