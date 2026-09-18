import {
  DOMParser as XmlParser,
  type Document as XmlDocument,
  type Element as XmlElement,
  type Node as XmlNode,
} from '@xmldom/xmldom';

import {
  OMI_JATS4R_PROFILE_SCOPE,
  OMI_JATS4R_PROFILE_VERSION,
  OMI_JATS4R_UPSTREAM_REPOSITORY,
  OMI_JATS4R_UPSTREAM_SCHEMATRON_VERSION,
} from '../model/jatsPublicationProfiles';

const XLINK_NS = 'http://www.w3.org/1999/xlink';
const ALI_NS = 'http://www.niso.org/schemas/ali/1.0/';

export type Jats4rDiagnosticSeverity = 'error' | 'warning' | 'info';

export interface Jats4rProfileDiagnostic {
  code: string;
  severity: Jats4rDiagnosticSeverity;
  message: string;
  category:
    | 'abstract'
    | 'accessibility'
    | 'authors-affiliations'
    | 'citations'
    | 'data-citations'
    | 'keywords'
    | 'math'
    | 'permissions'
    | 'language'
    | 'document';
  sourceRule: string;
  path?: string;
}

export interface Jats4rProfileValidationResult {
  profile: 'jats4r';
  profileVersion: typeof OMI_JATS4R_PROFILE_VERSION;
  scope: typeof OMI_JATS4R_PROFILE_SCOPE;
  upstream: {
    repository: typeof OMI_JATS4R_UPSTREAM_REPOSITORY;
    schematronVersion: typeof OMI_JATS4R_UPSTREAM_SCHEMATRON_VERSION;
  };
  valid: boolean;
  diagnostics: Jats4rProfileDiagnostic[];
  evaluatedRuleIds: string[];
  categories: string[];
}

/**
 * Offline JATS4R publication-profile validation for the semantic surface that
 * Open Manuscript Studio currently emits.
 *
 * This deliberately does not claim to be the official JATS4R Schematron
 * engine. Each implemented rule is traced to JATS4R/jats-schematrons v0.0.17,
 * the version pinned by the official JATS4R validator Docker image. Keeping the
 * checks local avoids sending unpublished manuscripts to an external service
 * and gives CI a deterministic release boundary.
 */
export function validateJats4rProfile(
  xml: string,
): Jats4rProfileValidationResult {
  const diagnostics: Jats4rProfileDiagnostic[] = [];
  const evaluated = new Set<string>();

  if (/<!ENTITY\b/i.test(xml)) {
    add(
      diagnostics,
      evaluated,
      'document.no-input-entities',
      'error',
      'document',
      'Input-side entity declarations are not accepted by the local publication-profile validator.',
      'omi-security-boundary',
    );
    return result(diagnostics, evaluated);
  }

  let document: XmlDocument;
  try {
    document = new XmlParser({
      onError: () => {
        throw new Error('Invalid XML.');
      },
    }).parseFromString(xml, 'application/xml');
  } catch {
    add(
      diagnostics,
      evaluated,
      'document.well-formed',
      'error',
      'document',
      'The JATS document is not well-formed XML.',
      'omi-parser',
    );
    return result(diagnostics, evaluated);
  }

  const article = document.documentElement;
  if (!article || article.localName !== 'article') {
    add(
      diagnostics,
      evaluated,
      'document.article-root',
      'error',
      'document',
      'The JATS4R publication profile expects an article root element.',
      'omi-profile',
      article,
    );
    return result(diagnostics, evaluated);
  }

  validateAbstracts(document, diagnostics, evaluated);
  validateAccessibility(document, diagnostics, evaluated);
  validateAuthorsAndAffiliations(document, diagnostics, evaluated);
  validateCitations(document, diagnostics, evaluated);
  validateDataCitations(document, diagnostics, evaluated);
  validateKeywords(document, diagnostics, evaluated);
  validateMath(document, diagnostics, evaluated);
  validatePermissions(document, diagnostics, evaluated);
  validateLanguage(document, diagnostics, evaluated);

  return result(diagnostics, evaluated);
}

function validateAbstracts(
  document: XmlDocument,
  diagnostics: Jats4rProfileDiagnostic[],
  evaluated: Set<string>,
): void {
  const articleMetas = elements(document, 'article-meta');
  for (const meta of articleMetas) {
    const vanilla = directChildren(meta, 'abstract').filter(
      (abstract) =>
        !abstract.hasAttribute('abstract-type') &&
        !abstract.hasAttribute('xml:lang') &&
        !abstract.hasAttribute('specific-use'),
    );
    check(
      diagnostics,
      evaluated,
      vanilla.length <= 1,
      'abstract.multiple-untyped',
      'error',
      'abstract',
      'When multiple abstracts are present, secondary abstracts need abstract-type, xml:lang, or specific-use.',
      'abstract-errors.sch',
      meta,
    );
  }

  for (const abstract of [
    ...elements(document, 'abstract'),
    ...elements(document, 'trans-abstract'),
  ]) {
    if (abstract.localName === 'trans-abstract') {
      check(
        diagnostics,
        evaluated,
        Boolean(abstract.getAttribute('xml:lang')?.trim()),
        'abstract.translated-language',
        'error',
        'abstract',
        'Translated abstracts need an xml:lang value.',
        'abstract-errors.sch',
        abstract,
      );
    }

    for (const sec of elements(abstract, 'sec')) {
      check(
        diagnostics,
        evaluated,
        directChildren(sec, 'title').length > 0,
        'abstract.section-title',
        'error',
        'abstract',
        'Sections inside abstracts need a title.',
        'abstract-errors.sch',
        sec,
      );
    }
  }
}

function validateAccessibility(
  document: XmlDocument,
  diagnostics: Jats4rProfileDiagnostic[],
  evaluated: Set<string>,
): void {
  for (const graphic of elements(document, 'graphic')) {
    const alt = directChildren(graphic, 'alt-text');
    check(
      diagnostics,
      evaluated,
      alt.length > 0,
      'accessibility.graphic-alt-text',
      'error',
      'accessibility',
      'Every graphic needs an alt-text element.',
      'accessibility-errors.sch',
      graphic,
    );
    if (alt.length > 0) {
      check(
        diagnostics,
        evaluated,
        normalizeText(alt[0]!) !== '',
        'accessibility.graphic-alt-text-empty',
        'warning',
        'accessibility',
        'Empty alt text should be replaced by descriptive text, or by the literal value “null” for a decorative image.',
        'accessibility-warnings.sch',
        alt[0],
      );
    }
  }

  for (const wrap of elements(document, 'table-wrap')) {
    check(
      diagnostics,
      evaluated,
      elements(wrap, 'table').length > 0,
      'accessibility.table-wrap-table',
      'error',
      'accessibility',
      'Each table-wrap needs an XHTML table.',
      'accessibility-errors.sch',
      wrap,
    );
  }

  for (const table of elements(document, 'table')) {
    check(
      diagnostics,
      evaluated,
      elements(table, 'th').length > 0,
      'accessibility.table-header',
      'error',
      'accessibility',
      'Data tables need at least one th header cell.',
      'accessibility-errors.sch',
      table,
    );
  }

  for (const sec of elements(document, 'sec')) {
    check(
      diagnostics,
      evaluated,
      directChildren(sec, 'title').length > 0,
      'accessibility.section-title',
      'error',
      'accessibility',
      'Each sec element needs a title.',
      'accessibility-errors.sch',
      sec,
    );
    check(
      diagnostics,
      evaluated,
      !sec.hasAttribute('disp-level'),
      'accessibility.section-disp-level',
      'error',
      'accessibility',
      'Section hierarchy should be expressed by nesting, not by disp-level.',
      'accessibility-errors.sch',
      sec,
    );
  }

  for (const link of [
    ...elements(document, 'ext-link'),
    ...elements(document, 'uri'),
    ...elements(document, 'self-uri'),
  ]) {
    const href = xlinkHref(link);
    const text = normalizeText(link);
    const title = xlinkTitle(link);
    const textIsUri = /^https?:\/\/|^s?ftp:\/\//i.test(text);
    const undescribed =
      text === '' ||
      (Boolean(href) && text === href) ||
      textIsUri;
    check(
      diagnostics,
      evaluated,
      !undescribed || Boolean(title),
      'accessibility.descriptive-link',
      'error',
      'accessibility',
      'Links need descriptive text or an xlink:title.',
      'accessibility-errors.sch',
      link,
    );
    if (Boolean(href) && (text === href || textIsUri)) {
      add(
        diagnostics,
        evaluated,
        'accessibility.uri-as-link-text',
        'warning',
        'accessibility',
        'A bare URI is not recommended as the visible link text.',
        'accessibility-warnings.sch',
        link,
      );
    }
  }

  for (const formula of [
    ...elements(document, 'disp-formula'),
    ...elements(document, 'inline-formula'),
  ]) {
    if (
      directChildren(formula, 'graphic').length > 0 &&
      elements(formula, 'math').length === 0 &&
      elements(formula, 'tex-math').length === 0
    ) {
      add(
        diagnostics,
        evaluated,
        'accessibility.formula-graphic-only',
        'error',
        'accessibility',
        'Mathematics should not be represented only by a graphic.',
        'accessibility-errors.sch',
        formula,
      );
    }
  }
}

function validateAuthorsAndAffiliations(
  document: XmlDocument,
  diagnostics: Jats4rProfileDiagnostic[],
  evaluated: Set<string>,
): void {
  const contribs = elements(document, 'contrib');
  if (contribs.length > 0) {
    check(
      diagnostics,
      evaluated,
      contribs.some((contrib) => contrib.getAttribute('contrib-type') === 'author'),
      'authors.author-contrib-type',
      'warning',
      'authors-affiliations',
      'Articles with contributors should identify authors with contrib-type="author".',
      'auths-affs-warnings.sch',
      contribs[0],
    );
  }

  for (const contribId of elements(document, 'contrib-id')) {
    check(
      diagnostics,
      evaluated,
      Boolean(contribId.getAttribute('contrib-id-type')?.trim()),
      'authors.contrib-id-type',
      'error',
      'authors-affiliations',
      'contrib-id needs a non-empty contrib-id-type.',
      'auths-affs-errors.sch',
      contribId,
    );
  }

  for (const institutionId of elements(document, 'institution-id')) {
    check(
      diagnostics,
      evaluated,
      Boolean(institutionId.getAttribute('institution-id-type')?.trim()),
      'authors.institution-id-type',
      'error',
      'authors-affiliations',
      'institution-id needs an institution-id-type.',
      'auths-affs-errors.sch',
      institutionId,
    );
  }

  for (const aff of elements(document, 'aff')) {
    const hasInstitution =
      directChildren(aff, 'institution').length > 0 ||
      elements(aff, 'institution-wrap').some(
        (wrap) => elements(wrap, 'institution').length > 0,
      );
    check(
      diagnostics,
      evaluated,
      hasInstitution,
      'authors.affiliation-institution',
      'info',
      'authors-affiliations',
      'Affiliations are most reusable when the institution is tagged explicitly.',
      'auths-affs-warnings.sch',
      aff,
    );
  }
}

function validateCitations(
  document: XmlDocument,
  diagnostics: Jats4rProfileDiagnostic[],
  evaluated: Set<string>,
): void {
  const citations = [
    ...elements(document, 'element-citation'),
    ...elements(document, 'mixed-citation'),
  ];
  for (const citation of citations) {
    const publicationType = citation.getAttribute('publication-type')?.trim() ?? '';
    check(
      diagnostics,
      evaluated,
      Boolean(publicationType),
      'citations.publication-type',
      'error',
      'citations',
      'Every structured citation needs publication-type.',
      'general-citations-errors.sch',
      citation,
    );
    if (publicationType === 'other') {
      add(
        diagnostics,
        evaluated,
        'citations.publication-type-other',
        'warning',
        'citations',
        'publication-type="other" reduces citation reuse and should be replaced by a specific type where possible.',
        'general-citations-warnings.sch',
        citation,
      );
    }

    const hasContributorGroup = directChildren(citation, 'person-group').some(
      (group) => Boolean(group.getAttribute('person-group-type')?.trim()),
    );
    check(
      diagnostics,
      evaluated,
      hasContributorGroup || elements(citation, 'name').length === 0,
      'citations.person-group-role',
      'warning',
      'citations',
      'Citation contributors should be grouped in person-group with person-group-type.',
      'general-citations-warnings.sch',
      citation,
    );

    const hasElocation = directChildren(citation, 'elocation-id').length > 0;
    const hasPages =
      directChildren(citation, 'fpage').length > 0 ||
      directChildren(citation, 'lpage').length > 0 ||
      directChildren(citation, 'page-range').length > 0;
    check(
      diagnostics,
      evaluated,
      !(hasElocation && hasPages),
      'citations.elocation-or-pages',
      'error',
      'citations',
      'A citation should use either an electronic location identifier or page information, not both.',
      'general-citations-errors.sch',
      citation,
    );

    for (const year of directChildren(citation, 'year')) {
      const value = normalizeText(year);
      const iso = year.getAttribute('iso-8601-date')?.trim() ?? '';
      check(
        diagnostics,
        evaluated,
        /^\d{4}$/.test(value) || /^\d{4}$/.test(iso),
        'citations.four-digit-year',
        'error',
        'citations',
        'Citation years need a four-digit year value or iso-8601-date.',
        'general-citations-errors.sch',
        year,
      );
    }

    for (const pubId of directChildren(citation, 'pub-id')) {
      check(
        diagnostics,
        evaluated,
        Boolean(pubId.getAttribute('pub-id-type')?.trim()),
        'citations.pub-id-type',
        'error',
        'citations',
        'Citation pub-id needs a pub-id-type.',
        'general-citations-errors.sch',
        pubId,
      );
    }
  }

  for (const ref of elements(document, 'ref')) {
    check(
      diagnostics,
      evaluated,
      Boolean(ref.getAttribute('id')?.trim()),
      'citations.ref-id',
      'error',
      'citations',
      'Every ref element needs an id.',
      'data-citations-errors.sch',
      ref,
    );
  }
}

function validateDataCitations(
  document: XmlDocument,
  diagnostics: Jats4rProfileDiagnostic[],
  evaluated: Set<string>,
): void {
  const citations = [
    ...elements(document, 'element-citation'),
    ...elements(document, 'mixed-citation'),
  ];

  for (const citation of citations) {
    const publicationType = citation.getAttribute('publication-type')?.trim();
    const hasDataTitle = directChildren(citation, 'data-title').length > 0;
    const hasSource = directChildren(citation, 'source').length > 0;
    const hasArticleTitle = directChildren(citation, 'article-title').length > 0;

    if (hasDataTitle) {
      check(
        diagnostics,
        evaluated,
        publicationType === 'data',
        'data-citations.data-title-type',
        'error',
        'data-citations',
        'Citations containing data-title need publication-type="data".',
        'data-citations-errors.sch',
        citation,
      );
    }

    if (publicationType === 'data') {
      check(
        diagnostics,
        evaluated,
        hasDataTitle || hasSource,
        'data-citations.title-or-source',
        'error',
        'data-citations',
        'Data citations need data-title and/or source.',
        'data-citations-errors.sch',
        citation,
      );
      check(
        diagnostics,
        evaluated,
        !hasArticleTitle || hasDataTitle,
        'data-citations.no-article-title',
        'error',
        'data-citations',
        'Data citations should use data-title instead of article-title.',
        'data-citations-errors.sch',
        citation,
      );
    }

    check(
      diagnostics,
      evaluated,
      !citation.hasAttribute('citation-type'),
      'data-citations.no-citation-type',
      'error',
      'data-citations',
      'Use publication-type rather than the deprecated citation-type attribute.',
      'data-citations-errors.sch',
      citation,
    );
  }

  for (const version of elements(document, 'version')) {
    check(
      diagnostics,
      evaluated,
      Boolean(version.getAttribute('designator')?.trim()),
      'data-citations.version-designator',
      'error',
      'data-citations',
      'version needs a machine-readable designator attribute.',
      'data-citations-errors.sch',
      version,
    );
  }
}

function validateKeywords(
  document: XmlDocument,
  diagnostics: Jats4rProfileDiagnostic[],
  evaluated: Set<string>,
): void {
  for (const parent of allElements(document)) {
    const groups = directChildren(parent, 'kwd-group');
    if (groups.length < 2) continue;
    const vanilla = groups.filter(
      (group) =>
        !group.hasAttribute('xml:lang') &&
        !group.hasAttribute('kwd-group-type'),
    );
    check(
      diagnostics,
      evaluated,
      vanilla.length <= 1,
      'keywords.multiple-untyped-groups',
      'warning',
      'keywords',
      'Multiple keyword groups should be differentiated by kwd-group-type or xml:lang.',
      'kwd-warnings.sch',
      parent,
    );
  }
}

function validateMath(
  document: XmlDocument,
  diagnostics: Jats4rProfileDiagnostic[],
  evaluated: Set<string>,
): void {
  for (const math of [
    ...elements(document, 'math'),
    ...elements(document, 'tex-math'),
  ]) {
    const parent = elementParent(math);
    const grandparent = parent ? elementParent(parent) : null;
    const allowed =
      parent?.localName === 'disp-formula' ||
      parent?.localName === 'inline-formula' ||
      (parent?.localName === 'alternatives' &&
        (grandparent?.localName === 'disp-formula' ||
          grandparent?.localName === 'inline-formula'));
    check(
      diagnostics,
      evaluated,
      allowed,
      'math.formula-wrapper',
      'error',
      'math',
      'Mathematical expressions need a disp-formula or inline-formula wrapper.',
      'math-errors.sch',
      math,
    );
  }

  for (const formula of [
    ...elements(document, 'disp-formula'),
    ...elements(document, 'inline-formula'),
  ]) {
    const directRepresentationCount =
      directChildren(formula, 'graphic').length +
      directChildren(formula, 'tex-math').length +
      directChildren(formula, 'math').length;
    check(
      diagnostics,
      evaluated,
      directRepresentationCount < 2,
      'math.single-direct-representation',
      'error',
      'math',
      'A formula should contain one direct expression; alternate representations belong in alternatives.',
      'math-errors.sch',
      formula,
    );

    const graphicOnly =
      directChildren(formula, 'graphic').length > 0 &&
      directChildren(formula, 'tex-math').length === 0 &&
      directChildren(formula, 'math').length === 0;
    check(
      diagnostics,
      evaluated,
      !graphicOnly,
      'math.prefer-markup',
      'warning',
      'math',
      'Mathematics should be supplied as MathML or TeX markup rather than only as a graphic.',
      'math-warnings.sch',
      formula,
    );
  }
}

function validatePermissions(
  document: XmlDocument,
  diagnostics: Jats4rProfileDiagnostic[],
  evaluated: Set<string>,
): void {
  for (const meta of elements(document, 'article-meta')) {
    check(
      diagnostics,
      evaluated,
      directChildren(meta, 'permissions').length > 0,
      'permissions.top-level',
      'error',
      'permissions',
      'JATS4R articles need a top-level permissions element in article-meta.',
      'permissions-errors.sch',
      meta,
    );
  }

  for (const permissions of elements(document, 'permissions')) {
    const statement = directChildren(permissions, 'copyright-statement');
    const years = directChildren(permissions, 'copyright-year');
    const holders = directChildren(permissions, 'copyright-holder');

    check(
      diagnostics,
      evaluated,
      (statement.length === 0 && holders.length === 0) || years.length > 0,
      'permissions.copyright-year-required',
      'error',
      'permissions',
      'Copyright statements or holders require a copyright-year.',
      'permissions-errors.sch',
      permissions,
    );
    check(
      diagnostics,
      evaluated,
      (statement.length === 0 && years.length === 0) || holders.length > 0,
      'permissions.copyright-holder-required',
      'error',
      'permissions',
      'Copyright statements or years require a copyright-holder.',
      'permissions-errors.sch',
      permissions,
    );

    for (const year of years) {
      check(
        diagnostics,
        evaluated,
        /^\d{4}$/.test(year.textContent ?? ''),
        'permissions.copyright-year-format',
        'error',
        'permissions',
        'copyright-year must contain exactly four digits without surrounding whitespace.',
        'permissions-errors.sch',
        year,
      );
    }
  }

  for (const license of elements(document, 'license')) {
    const href = xlinkHref(license);
    const refs = directChildrenByNamespace(license, 'license_ref', ALI_NS);
    const refValues = refs.map(normalizeText).filter(Boolean);

    if (href && refValues.length > 0) {
      check(
        diagnostics,
        evaluated,
        refValues.includes(href),
        'permissions.license-uri-match',
        'error',
        'permissions',
        'When both xlink:href and ali:license_ref are present, the license URIs must match.',
        'permissions-errors.sch',
        license,
      );
    }

    check(
      diagnostics,
      evaluated,
      refs.length > 0 || !href,
      'permissions.ali-license-ref',
      'warning',
      'permissions',
      'For modern JATS, canonical license URIs should be supplied with ali:license_ref.',
      'permissions-warnings.sch',
      license,
    );

    const canonical = refValues[0] ?? href ?? '';
    if (/creativecommons\.org/i.test(canonical)) {
      check(
        diagnostics,
        evaluated,
        /^https:\/\/creativecommons\.org\/(?:licenses\/[a-z-]+\/(?:[1-4]\.\d)\/|publicdomain\/(?:zero|mark)\/1\.0\/)$/i.test(
          canonical,
        ),
        'permissions.creative-commons-url',
        'warning',
        'permissions',
        'Creative Commons license URLs should use HTTPS and the canonical trailing-slash form.',
        'permissions-warnings.sch',
        license,
      );
    }
  }
}

function validateLanguage(
  document: XmlDocument,
  diagnostics: Jats4rProfileDiagnostic[],
  evaluated: Set<string>,
): void {
  for (const localName of [
    'fig',
    'fig-group',
    'table-wrap',
    'table-wrap-group',
    'disp-formula',
    'disp-formula-group',
    'boxed-text',
  ]) {
    for (const element of elements(document, localName)) {
      const lang = element.getAttribute('xml:lang')?.trim();
      if (!lang) continue;
      check(
        diagnostics,
        evaluated,
        isLanguageTag(lang),
        'language.bcp47-object',
        'error',
        'language',
        'Object xml:lang values need a valid BCP 47 language tag.',
        'xml-lang-errors.sch',
        element,
      );
    }
  }
}

function isLanguageTag(value: string): boolean {
  try {
    return Intl.getCanonicalLocales(value).length === 1;
  } catch {
    return false;
  }
}

function result(
  diagnostics: Jats4rProfileDiagnostic[],
  evaluated: Set<string>,
): Jats4rProfileValidationResult {
  return {
    profile: 'jats4r',
    profileVersion: OMI_JATS4R_PROFILE_VERSION,
    scope: OMI_JATS4R_PROFILE_SCOPE,
    upstream: {
      repository: OMI_JATS4R_UPSTREAM_REPOSITORY,
      schematronVersion: OMI_JATS4R_UPSTREAM_SCHEMATRON_VERSION,
    },
    valid: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
    diagnostics,
    evaluatedRuleIds: [...evaluated].sort(),
    categories: Array.from(
      new Set(diagnostics.map((diagnostic) => diagnostic.category)),
    ).sort(),
  };
}

function check(
  diagnostics: Jats4rProfileDiagnostic[],
  evaluated: Set<string>,
  condition: boolean,
  code: string,
  severity: Jats4rDiagnosticSeverity,
  category: Jats4rProfileDiagnostic['category'],
  message: string,
  sourceRule: string,
  element?: XmlElement | null,
): void {
  evaluated.add(code);
  if (!condition) {
    diagnostics.push({
      code,
      severity,
      category,
      message,
      sourceRule,
      ...(element ? { path: elementPath(element) } : {}),
    });
  }
}

function add(
  diagnostics: Jats4rProfileDiagnostic[],
  evaluated: Set<string>,
  code: string,
  severity: Jats4rDiagnosticSeverity,
  category: Jats4rProfileDiagnostic['category'],
  message: string,
  sourceRule: string,
  element?: XmlElement | null,
): void {
  evaluated.add(code);
  diagnostics.push({
    code,
    severity,
    category,
    message,
    sourceRule,
    ...(element ? { path: elementPath(element) } : {}),
  });
}

function elements(
  root: XmlDocument | XmlElement,
  localName: string,
): XmlElement[] {
  return Array.from(root.getElementsByTagName('*')).filter(
    (node): node is XmlElement => node.localName === localName,
  );
}

function allElements(root: XmlDocument | XmlElement): XmlElement[] {
  return Array.from(root.getElementsByTagName('*')) as XmlElement[];
}

function directChildren(
  element: XmlElement,
  localName: string,
): XmlElement[] {
  return Array.from(element.childNodes).filter(
    (node): node is XmlElement =>
      node.nodeType === 1 && (node as XmlElement).localName === localName,
  );
}

function directChildrenByNamespace(
  element: XmlElement,
  localName: string,
  namespace: string,
): XmlElement[] {
  return Array.from(element.childNodes).filter(
    (node): node is XmlElement =>
      node.nodeType === 1 &&
      (node as XmlElement).localName === localName &&
      (node as XmlElement).namespaceURI === namespace,
  );
}

function normalizeText(node: XmlNode): string {
  return (node.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function xlinkHref(element: XmlElement): string {
  return (
    element.getAttributeNS(XLINK_NS, 'href') ??
    element.getAttribute('xlink:href') ??
    ''
  ).trim();
}

function xlinkTitle(element: XmlElement): string {
  return (
    element.getAttributeNS(XLINK_NS, 'title') ??
    element.getAttribute('xlink:title') ??
    ''
  ).trim();
}

function elementParent(element: XmlElement): XmlElement | null {
  const parent = element.parentNode;
  return parent?.nodeType === 1 ? (parent as XmlElement) : null;
}

function elementPath(element: XmlElement): string {
  const id = element.getAttribute('id')?.trim();
  const base = id ? `${element.tagName}#${id}` : element.tagName;
  const parent = elementParent(element);
  if (!parent || parent.localName === 'article') {
    return `/${base}`;
  }
  return `${elementPath(parent)}/${base}`;
}
