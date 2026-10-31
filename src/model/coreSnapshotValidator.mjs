/** OMI Core Snapshot Draft profile 0.1.0. Pure, bounded, non-mutating validation.
 * This inspects a projection of OMI-SPEC-320@0.3.0, not the complete file format.
 * No network access, rendering, source modification, authentication or repair.
 */
export const CORE_PROFILE = 'urn:omi:profile:core-snapshot-review:0.1.0';
export const CORE_SPECIFICATIONS = { 'OMI-SPEC-000': '0.2.0', 'OMI-SPEC-120': '0.3.0', 'OMI-SPEC-100': '0.2.0', 'OMI-SPEC-140': '0.2.0' };
const COLLECTIONS = ['agents', 'contributions', 'annotations', 'bibliographicRecords', 'citations', 'citationClusters', 'crossReferences', 'namedAnchors', 'assets', 'sourceAttributions', 'publicationCorrections'];
const BLOCK_TYPES = new Set(['heading', 'paragraph', 'quote', 'figure', 'image', 'table', 'chart', 'equation', 'music-score']);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const escape = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');

export function validateCoreSnapshot(value, options = {}) {
  const mode = options.mode ?? 'authoring';
  const maxNodes = options.maxNodes ?? 100_000;
  const maxDepth = options.maxDepth ?? 64;
  const maxDiagnostics = options.maxDiagnostics ?? 200;
  if (!['authoring', 'exchange'].includes(mode) || ![maxNodes, maxDepth, maxDiagnostics].every(number => Number.isSafeInteger(number) && number > 0)) throw new TypeError('Invalid core validation options.');
  const diagnostics = [];
  let complete = true, invalid = false, nodes = 0, limited = false;
  function finding(code, path, severity = 'error') {
    if (severity === 'error') invalid = true;
    if (diagnostics.length < maxDiagnostics) diagnostics.push({ code, path, severity });
    else complete = false;
  }
  function limit(path) { complete = false; if (!limited) { limited = true; finding('RESOURCE_LIMIT', path, 'warning'); } }
  const jsonSeen = new WeakSet();
  function inspectJson(item, path, depth) {
    if (++nodes > maxNodes || depth > maxDepth) { limit(path); return; }
    if (typeof item === 'string') {
      if (hasUnpairedSurrogate(item)) finding('INVALID_UNICODE', path);
    } else if (typeof item === 'number') { if (!Number.isFinite(item)) finding('NON_JSON_VALUE', path); }
    else if (item && typeof item === 'object') {
      if (jsonSeen.has(item)) { finding('SHARED_OR_CYCLIC_OBJECT', path); return; }
      jsonSeen.add(item);
      if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) { finding('NON_JSON_VALUE', path); return; }
      for (const key of Object.keys(item)) {
        if (nodes >= maxNodes) { limit(path); break; }
        if (hasUnpairedSurrogate(key)) finding('INVALID_UNICODE', `${path}/${escape(key)}`);
        inspectJson(item[key], `${path}/${escape(key)}`, depth + 1);
      }
      jsonSeen.delete(item);
    } else if (item !== null && typeof item !== 'boolean') finding('NON_JSON_VALUE', path);
  }
  inspectJson(value, '', 0);
  if (!record(value)) finding('INVALID_ROOT', '');
  else if (!limited && !diagnostics.some(item => item.code === 'SHARED_OR_CYCLIC_OBJECT' || item.code === 'NON_JSON_VALUE')) {
    const ids = new Map(), sections = new Map();
    function object(item, path) {
      if (!record(item)) { finding('INVALID_OBJECT', path); return false; }
      if (!nonempty(item.id)) finding('INVALID_ID', `${path}/id`);
      else if (ids.has(item.id)) finding('DUPLICATE_ID', `${path}/id`);
      else ids.set(item.id, path);
      return true;
    }
    function array(items, path, visitor) {
      if (!Array.isArray(items)) { finding('INVALID_ARRAY', path); return; }
      items.forEach((item, index) => visitor(item, `${path}/${index}`));
    }
    function blocks(items, path) {
      array(items, path, (item, location) => {
        if (!object(item, location)) return;
        if (!nonempty(item.type)) finding('INVALID_BLOCK_TYPE', `${location}/type`);
        else if (!BLOCK_TYPES.has(item.type)) { complete = false; finding('UNKNOWN_BLOCK_TYPE', `${location}/type`, 'warning'); }
        if (typeof item.content !== 'string') finding('INVALID_CONTENT', `${location}/content`);
        if (item.children !== undefined) blocks(item.children, `${location}/children`);
      });
    }
    function sectionList(items, path, enclosing) {
      array(items, path, (item, location) => {
        if (!object(item, location)) return;
        if (typeof item.title !== 'string') finding('INVALID_TITLE', `${location}/title`);
        if (item.parentSectionId !== undefined && !nonempty(item.parentSectionId)) finding('INVALID_PARENT', `${location}/parentSectionId`);
        const explicit = item.parentSectionId;
        if (enclosing && explicit !== undefined && explicit !== enclosing) finding('CONFLICTING_PARENT', `${location}/parentSectionId`);
        if (nonempty(item.id) && !sections.has(item.id)) sections.set(item.id, { parent: explicit ?? enclosing, path: location });
        blocks(item.blocks, `${location}/blocks`);
        if (item.children !== undefined) sectionList(item.children, `${location}/children`, item.id);
      });
    }
    object(value, '');
    if (typeof value.title !== 'string' || mode === 'exchange' && !value.title.trim()) finding('INVALID_TITLE', '/title');
    if (!validLanguage(value.locale)) finding('INVALID_LANGUAGE', '/locale');
    if (value.keywords !== undefined && (!Array.isArray(value.keywords) || value.keywords.some(item => !nonempty(item)))) finding('INVALID_KEYWORDS', '/keywords');
    for (const field of ['createdAt', 'updatedAt']) if (!validTimestamp(value[field])) finding('INVALID_TIMESTAMP', `/${field}`);
    if (validTimestamp(value.createdAt) && validTimestamp(value.updatedAt) && Date.parse(value.updatedAt) < Date.parse(value.createdAt)) finding('TIMESTAMP_ORDER', '/updatedAt');
    sectionList(value.sections, '/sections');
    for (const key of COLLECTIONS) if (value[key] !== undefined) array(value[key], `/${key}`, object);
    for (const [id, section] of sections) {
      if (section.parent !== undefined && !sections.has(section.parent)) finding('UNRESOLVED_PARENT', `${section.path}/parentSectionId`);
      const chain = new Set([id]);
      let parent = section.parent;
      while (parent !== undefined && sections.has(parent)) {
        if (chain.has(parent)) { finding('CYCLIC_CONTAINMENT', `${section.path}/parentSectionId`); break; }
        if (chain.size > maxDepth) { limit(section.path); break; }
        chain.add(parent); parent = sections.get(parent).parent;
      }
    }
  }
  return { profile: CORE_PROFILE, profileVersion: '0.1.0', specifications: { ...CORE_SPECIFICATIONS }, mode,
    outcome: invalid ? 'invalid' : complete ? 'valid' : 'indeterminate', complete, diagnostics,
    exclusions: ['full-file-format-schema', 'embedded-editor-content-semantics', 'all-relationship-targets', 'rights-and-identity-verification', 'rendering', 'independent-conformance'] };
}

function hasUnpairedSurrogate(text) {
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index++;
    } else if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
}
function validLanguage(value) {
  if (!nonempty(value) || value.length > 100 || value.includes('_') || value !== value.trim()) return false;
  if (/^x(?:-[a-z0-9]{1,8})+$/i.test(value)) return true;
  try { return Intl.getCanonicalLocales(value).length === 1; } catch { return false; }
}
function validTimestamp(value) {
  if (typeof value !== 'string') return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!parts) return false;
  const [year, month, day, hour, minute, second] = parts.slice(1, 7).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] && hour < 24 && minute < 60 && second < 60
    && (parts[7] === 'Z' || Number(parts[8]) < 24 && Number(parts[9]) < 60) && Number.isFinite(Date.parse(value));
}
