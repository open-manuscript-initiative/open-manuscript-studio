import { authorFontStyle } from '../../services/embeddedCss';
import { LIST_ATTRIBUTE_NAMES, normalizeListAttribute, listPresentation } from '../../model/directListFormatting';
import { normalizeSourceStyle } from '../../model/sourceWordStyles';
import { PARAGRAPH_FORMAT_NAMES, normalizeParagraphValue, paragraphFormattingCss } from '../../model/directParagraphFormatting';
import { DIRECT_FORMAT_NAMES, normalizeDirectValue, directFormattingCss, normalizeUnderlineStyle, underlineCss } from '../../model/directFormatting';
import {
  Extension,
  Mark,
  mergeAttributes,
  type Editor,
} from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

import {
  normalizeExternalHref,
  normalizeInlineLanguageTag,
} from '../../model/richText';
import { OmiManuscriptBoundaryEditingExtension } from './OmiManuscriptBoundaryEditingExtension';
import { OmiManuscriptSelectionExtension } from './OmiManuscriptSelectionExtension';
import { OmiNonPrintingMarksExtension } from './OmiNonPrintingMarksExtension';
import { OmiTabExtension } from './OmiTabExtension';
import './OmiBlockTypeMenu.css';

type HtmlAttributeMap = Record<string, unknown>;
type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type BlockType =
  | 'paragraph'
  | `heading-${HeadingLevel}`
  | 'blockquote'
  | 'bulletList'
  | 'orderedList'
  | 'codeBlock';

interface BlockTypeCopy {
  label: string;
  paragraph: string;
  headings: string;
  heading: (level: HeadingLevel) => string;
  quote: string;
  bulletList: string;
  orderedList: string;
  codeBlock: string;
}

const BLOCK_TYPE_COPY: Record<'en' | 'hu' | 'de', BlockTypeCopy> = {
  en: {
    label: 'Paragraph type',
    paragraph: 'Paragraph',
    headings: 'Headings',
    heading: (level) => `Heading ${level}`,
    quote: 'Block quotation',
    bulletList: 'Bullet list',
    orderedList: 'Numbered list',
    codeBlock: 'Code block',
  },
  hu: {
    label: 'Bekezdéstípus',
    paragraph: 'Sima bekezdés',
    headings: 'Címsorok',
    heading: (level) => `Címsor ${level}`,
    quote: 'Blokkidézet',
    bulletList: 'Felsorolás',
    orderedList: 'Számozott lista',
    codeBlock: 'Kódblokk',
  },
  de: {
    label: 'Absatztyp',
    paragraph: 'Absatz',
    headings: 'Überschriften',
    heading: (level) => `Überschrift ${level}`,
    quote: 'Blockzitat',
    bulletList: 'Aufzählung',
    orderedList: 'Nummerierte Liste',
    codeBlock: 'Codeblock',
  },
};

export const OmiLinkExtension = Mark.create({
  name: 'omiLink',
  priority: 1000,
  keepOnSplit: false,
  inclusive: false,

  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          normalizeExternalHref(element.getAttribute('href') ?? undefined) ?? null,
      },
      title: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'a[href]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const href = normalizeExternalHref(
      typeof HTMLAttributes.href === 'string'
        ? HTMLAttributes.href
        : undefined,
    );

    if (!href) {
      return ['span', {}, 0];
    }

    return [
      'a',
      mergeAttributes(
        sanitizeLinkAttributes(HTMLAttributes),
        {
          href,
          target: '_blank',
          rel: 'noopener noreferrer',
          'data-omi-external-link': 'true',
        },
      ),
      0,
    ];
  },
});

export const OmiSuperscriptExtension = Mark.create({
  name: 'omiSuperscript',
  excludes: 'omiSubscript',

  parseHTML() {
    return [{ tag: 'sup' }];
  },

  renderHTML() {
    return ['sup', { 'data-omi-superscript': 'true' }, 0];
  },
});

export const OmiSubscriptExtension = Mark.create({
  name: 'omiSubscript',
  excludes: 'omiSuperscript',

  parseHTML() {
    return [{ tag: 'sub' }];
  },

  renderHTML() {
    return ['sub', { 'data-omi-subscript': 'true' }, 0];
  },
});

export const OmiSmallCapsExtension = Mark.create({
  name: 'omiSmallCaps',

  parseHTML() {
    return [
      { tag: 'span[data-omi-small-caps]' },
      {
        style: 'font-variant',
        getAttrs: (value) =>
          typeof value === 'string' && /small-caps/i.test(value) ? {} : false,
      },
    ];
  },

  renderHTML() {
    return [
      'span',
      {
        'data-omi-small-caps': 'true',
        style: 'font-variant: small-caps',
      },
      0,
    ];
  },
});

export const OmiUnderlineExtension = Mark.create({
  name: 'omiUnderline',
  addAttributes() {
    return { variant: { default: null, parseHTML: (element: HTMLElement) => normalizeUnderlineStyle(element.getAttribute('data-omi-underline-variant')) ?? null } };
  },
  parseHTML() {
    return [
      { tag: 'u' },
      {
        style: 'text-decoration',
        getAttrs: (value) =>
          typeof value === 'string' && /underline/i.test(value) ? {} : false,
      },
    ];
  },

  renderHTML({ mark }) {
    const variant = normalizeUnderlineStyle(mark.attrs.variant);
    return ['u', { 'data-omi-underline': 'true', ...(variant ? { 'data-omi-underline-variant': variant, style: underlineCss(variant) } : {}) }, 0];
  },
});

export const OmiLanguageExtension = Mark.create({
  name: 'omiLanguage',
  inclusive: true,

  addAttributes() {
    return {
      lang: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          normalizeInlineLanguageTag(element.getAttribute('lang') ?? undefined) ?? null,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[lang]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const lang = normalizeInlineLanguageTag(
      typeof HTMLAttributes.lang === 'string'
        ? HTMLAttributes.lang
        : undefined,
    );

    if (!lang) {
      return ['span', {}, 0];
    }

    return [
      'span',
      {
        lang,
        'data-omi-language': lang,
      },
      0,
    ];
  },
});

export const OmiSourceFontExtension = Mark.create({
  name: 'omiSourceFont',
  inclusive: false,

  addAttributes() {
    return {
      family: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          normalizeSourceFontFamily(element.getAttribute('data-omi-source-font')),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-omi-source-font]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const family = normalizeSourceFontFamily(
      typeof HTMLAttributes.family === 'string' ? HTMLAttributes.family : null,
    );
    return family
      ? ['span', { 'data-omi-source-font': family, style: authorFontStyle(family) }, 0]
      : ['span', {}, 0];
  },
});

/**
 * Provides a compact structural menu for the current ProseMirror text block.
 * The menu follows the paragraph containing the editor selection and collapses
 * a wider selection to that paragraph before changing its structural type.
 */
export const OmiBlockTypeMenuExtension = Extension.create({
  name: 'omiBlockTypeMenu',

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        key: new PluginKey('omiBlockTypeMenu'),
        view: () => createBlockTypeMenuView(editor),
      }),
    ];
  },
});

/** Individual marks let editing one attribute preserve all other selected formatting. */
export const OMI_DIRECT_FORMATTING_EXTENSIONS = DIRECT_FORMAT_NAMES.map(name => Mark.create({
  name,
  addAttributes() {
    return { value: { default: null, parseHTML: (element: HTMLElement) => normalizeDirectValue(name, element.getAttribute('data-omi-format-value')) ?? null } };
  },
  parseHTML() { return [{ tag: 'span[data-omi-format="' + name + '"]' }]; },
  renderHTML({ mark }) {
    const value = normalizeDirectValue(name, mark.attrs.value);
    return value === undefined ? ['span', {}, 0] : ['span', { 'data-omi-format': name, 'data-omi-format-value': String(value), style: directFormattingCss(name, value) }, 0];
  },
}));

export const OmiDirectParagraphFormattingExtension = Extension.create({
  name: 'omiDirectParagraphFormatting',
  addGlobalAttributes() {
    return [{
      types: ['paragraph'],
      attributes: Object.fromEntries(PARAGRAPH_FORMAT_NAMES.map(name => [name, {
        default: null,
        parseHTML: (element: HTMLElement) => normalizeParagraphValue(name, element.getAttribute('data-' + name.toLowerCase())) ?? null,
        renderHTML: (attrs: Record<string, unknown>) => {
          const value = normalizeParagraphValue(name, attrs[name]);
          if (value === undefined) return {};
          // Tiptap merges styles from individual global attributes. Line height
          // depends on both value and rule, so emit it only from the value.
          const css = name === 'omiLineRule' ? '' : paragraphFormattingCss(
            { [name]: value, ...(name === 'omiLineSpacing' ? { omiLineRule: attrs.omiLineRule } : {}) }, 'editor');
          return { ['data-' + name.toLowerCase()]: String(value), ...(css ? { style: css } : {}) };
        },
      }])),
    }];
  },
});

export const OmiSourceWordParagraphStyle = Extension.create({
  name: 'omiSourceWordParagraphStyle',
  addGlobalAttributes() {
    return [{ types:['paragraph'], attributes: {
      omiWordParagraphStyle: {
        default:null,
        parseHTML:(element:HTMLElement)=>normalizeSourceStyle(element.getAttribute('data-omi-word-paragraph-style')) ?? null,
        renderHTML:(attrs:Record<string,unknown>)=>{
          const definition=normalizeSourceStyle(attrs.omiWordParagraphStyle);
          return definition ? {'data-omi-word-paragraph-style':definition} : {};
        },
      },
    }}];
  },
});
export const OmiSourceWordCharacterStyle = Mark.create({
  name:'omiWordCharacterStyle',
  inclusive:false,
  addAttributes() {
    return {definition:{default:null,parseHTML:(element:HTMLElement)=>normalizeSourceStyle(element.getAttribute('data-omi-word-character-style')) ?? null}};
  },
  parseHTML(){return [{tag:'span[data-omi-word-character-style]'}];},
  renderHTML({mark}){
    const definition=normalizeSourceStyle(mark.attrs.definition);
    return ['span',definition?{'data-omi-word-character-style':definition}:{},0];
  },
});

export const OmiListFormattingExtension = Extension.create({
  name: 'omiListFormatting',
  addGlobalAttributes() {
    return [{
      types: ['orderedList','bulletList'],
      attributes: Object.fromEntries(LIST_ATTRIBUTE_NAMES.map(name => [name, {
        default: null,
        parseHTML: (element: HTMLElement) => normalizeListAttribute(name,element.getAttribute('data-'+name.toLowerCase())) ?? null,
        renderHTML: (attrs: Record<string, unknown>) => {
          const value = normalizeListAttribute(name,attrs[name]);
          if (value === undefined) return {};
          return { ['data-'+name.toLowerCase()]: String(value), ...(name === 'omiListFormat' ? listPresentation(attrs) : {}) };
        },
      }])),
    }];
  },
});

export const OMI_RICH_TEXT_EXTENSIONS = [
  OmiManuscriptBoundaryEditingExtension,
  OmiManuscriptSelectionExtension,
  OmiLinkExtension,
  OmiSuperscriptExtension,
  OmiSubscriptExtension,
  OmiSmallCapsExtension,
  OmiUnderlineExtension,
  OmiLanguageExtension,
  OmiSourceFontExtension,
  ...OMI_DIRECT_FORMATTING_EXTENSIONS,
  OmiDirectParagraphFormattingExtension,
  OmiSourceWordParagraphStyle,
  OmiSourceWordCharacterStyle,
  OmiListFormattingExtension,
  OmiTabExtension,
  OmiNonPrintingMarksExtension,
  OmiBlockTypeMenuExtension,
];

/**
 * The continuous manuscript has one ProseMirror selection and one native
 * editing surface. The legacy boundary and multi-host selection bridges must
 * therefore stay out of this extension set.
 */
export const OMI_CONTINUOUS_RICH_TEXT_EXTENSIONS = [
  OmiLinkExtension,
  OmiSuperscriptExtension,
  OmiSubscriptExtension,
  OmiSmallCapsExtension,
  OmiUnderlineExtension,
  OmiLanguageExtension,
  OmiSourceFontExtension,
  ...OMI_DIRECT_FORMATTING_EXTENSIONS,
  OmiDirectParagraphFormattingExtension,
  OmiSourceWordParagraphStyle,
  OmiSourceWordCharacterStyle,
  OmiListFormattingExtension,
  OmiTabExtension,
  OmiNonPrintingMarksExtension,
  OmiBlockTypeMenuExtension,
];

function createBlockTypeMenuView(editor: Editor) {
  const host = editor.view.dom.parentElement;
  if (!host) {
    return { destroy: () => undefined };
  }

  const copy = getBlockTypeCopy();
  const container = document.createElement('div');
  container.className = 'omi-block-type-menu';
  container.dataset.blockTypeMenu = 'true';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'omi-block-type-menu__trigger';
  trigger.textContent = '¶';
  trigger.setAttribute('aria-label', copy.label);
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.title = copy.label;

  const menu = document.createElement('div');
  menu.className = 'omi-block-type-menu__popover';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', copy.label);
  menu.hidden = true;

  const items: HTMLButtonElement[] = [];
  appendBlockTypeItem(menu, items, 'paragraph', copy.paragraph);
  const headingLabel = document.createElement('span');
  headingLabel.className = 'omi-block-type-menu__group-label';
  headingLabel.textContent = copy.headings;
  menu.append(headingLabel);
  for (const level of [1, 2, 3, 4, 5, 6] as HeadingLevel[]) {
    appendBlockTypeItem(menu, items, `heading-${level}`, copy.heading(level));
  }
  appendBlockTypeItem(menu, items, 'blockquote', copy.quote);
  appendBlockTypeItem(menu, items, 'bulletList', copy.bulletList);
  appendBlockTypeItem(menu, items, 'orderedList', copy.orderedList);
  appendBlockTypeItem(menu, items, 'codeBlock', copy.codeBlock);

  let menuTargetPosition = editor.state.selection.head;

  const sync = () => {
    if (menu.hidden) menuTargetPosition = editor.state.selection.head;
    syncBlockTypeMenu(editor, container, trigger, items, menuTargetPosition);
  };

  const setOpen = (open: boolean, returnFocus = false) => {
    container.classList.toggle('omi-block-type-menu--open', open);
    trigger.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    if (open) {
      const activeItem = items.find((item) => item.getAttribute('aria-checked') === 'true');
      requestAnimationFrame(() => (activeItem ?? items[0])?.focus());
    } else if (returnFocus) {
      trigger.focus();
    }
  };

  const onTriggerMouseDown = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const onTriggerPointerDown = () => {
    menuTargetPosition = editor.state.selection.head;
  };
  const onTriggerClick = () => {
    const open = menu.hidden !== false;
    // The pointerdown handler captured the editor selection before the menu
    // control could take focus. Open the popover first so sync() keeps that
    // captured paragraph instead of replacing it with a blur/focus-induced
    // editor selection (which may resolve to the end of a long document).
    setOpen(open);
    if (open) sync();
  };
  const onMenuClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const item = target.closest<HTMLButtonElement>('[data-block-type]');
    if (!item) return;
    applyBlockType(editor, item.dataset.blockType as BlockType, menuTargetPosition);
    setOpen(false);
    sync();
  };
  const onMenuKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    setOpen(false, true);
  };
  const onDocumentPointerDown = (event: PointerEvent) => {
    const target = event.target;
    if (target instanceof Node && !container.contains(target)) setOpen(false);
  };

  trigger.addEventListener('mousedown', onTriggerMouseDown);
  trigger.addEventListener('pointerdown', onTriggerPointerDown);
  trigger.addEventListener('click', onTriggerClick);
  menu.addEventListener('click', onMenuClick);
  menu.addEventListener('keydown', onMenuKeyDown);
  document.addEventListener('pointerdown', onDocumentPointerDown, true);
  container.append(trigger, menu);
  host.classList.add('omi-block-type-menu-host');
  host.append(container);
  sync();

  let syncFrame = 0;
  const scheduleSync = () => {
    cancelAnimationFrame(syncFrame);
    syncFrame = requestAnimationFrame(sync);
  };
  const resizeObserver = typeof ResizeObserver === 'undefined'
    ? null
    : new ResizeObserver(scheduleSync);
  resizeObserver?.observe(editor.view.dom);
  window.addEventListener('resize', scheduleSync);

  return {
    update: sync,
    destroy: () => {
      cancelAnimationFrame(syncFrame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleSync);
      trigger.removeEventListener('mousedown', onTriggerMouseDown);
      trigger.removeEventListener('pointerdown', onTriggerPointerDown);
      trigger.removeEventListener('click', onTriggerClick);
      menu.removeEventListener('click', onMenuClick);
      menu.removeEventListener('keydown', onMenuKeyDown);
      document.removeEventListener('pointerdown', onDocumentPointerDown, true);
      container.remove();
      host.classList.remove('omi-block-type-menu-host');
    },
  };
}

function appendBlockTypeItem(
  parent: HTMLElement,
  items: HTMLButtonElement[],
  value: BlockType,
  label: string,
): void {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'omi-block-type-menu__item';
  item.dataset.blockType = value;
  item.setAttribute('role', 'menuitemradio');
  item.setAttribute('aria-checked', 'false');
  item.textContent = label;
  items.push(item);
  parent.append(item);
}

function syncBlockTypeMenu(
  editor: Editor,
  container: HTMLDivElement,
  trigger: HTMLButtonElement,
  items: HTMLButtonElement[],
  targetPosition: number,
): void {
  trigger.disabled = !editor.isEditable;
  const target = resolveBlockTypeTarget(editor, targetPosition);
  container.hidden = !editor.isEditable || !target?.element;
  if (!target) return;

  if (target.element) {
    const host = container.parentElement;
    if (host) {
      const hostRect = host.getBoundingClientRect();
      const targetRect = target.element.getBoundingClientRect();
      const top = Math.max(0, targetRect.top - hostRect.top + host.scrollTop);
      container.style.setProperty('--omi-block-type-menu-top', `${Math.round(top)}px`);
    }
  }

  const activeType = getActiveBlockType(editor, target.selectionPosition);
  for (const item of items) {
    const active = item.dataset.blockType === activeType;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-checked', String(active));
  }
}

function getActiveBlockType(editor: Editor, position: number): BlockType {
  const resolved = editor.state.doc.resolve(clampDocumentPosition(editor, position));
  for (let depth = resolved.depth; depth > 0; depth -= 1) {
    const node = resolved.node(depth);
    if (node.type.name === 'bulletList') return 'bulletList';
    if (node.type.name === 'orderedList') return 'orderedList';
    if (node.type.name === 'blockquote') return 'blockquote';
    if (node.type.name === 'codeBlock') return 'codeBlock';
    if (node.type.name === 'heading') {
      const level = Number(node.attrs.level);
      if (level >= 1 && level <= 6) return `heading-${level as HeadingLevel}`;
    }
  }
  return 'paragraph';
}

function applyBlockType(editor: Editor, target: BlockType, targetPosition: number): void {
  const blockTarget = resolveBlockTypeTarget(editor, targetPosition);
  if (!editor.isEditable || !blockTarget) {
    editor.commands.focus();
    return;
  }

  editor.commands.setTextSelection(blockTarget.selectionPosition);
  if (getActiveBlockType(editor, blockTarget.selectionPosition) === target) {
    editor.commands.focus();
    return;
  }

  let chain = editor.chain().focus();

  if (editor.isActive('bulletList') && target !== 'bulletList') {
    chain = chain.toggleBulletList();
  }
  if (editor.isActive('orderedList') && target !== 'orderedList') {
    chain = chain.toggleOrderedList();
  }
  if (editor.isActive('blockquote') && target !== 'blockquote') {
    chain = chain.toggleBlockquote();
  }
  if (editor.isActive('codeBlock') && target !== 'codeBlock') {
    chain = chain.toggleCodeBlock();
  }

  if (target === 'paragraph') {
    chain.setParagraph().run();
    return;
  }
  if (target === 'blockquote') {
    chain.setParagraph().toggleBlockquote().run();
    return;
  }
  if (target === 'bulletList') {
    chain.setParagraph().toggleBulletList().run();
    return;
  }
  if (target === 'orderedList') {
    chain.setParagraph().toggleOrderedList().run();
    return;
  }
  if (target === 'codeBlock') {
    chain.setCodeBlock().run();
    return;
  }

  const level = Number(target.replace('heading-', '')) as HeadingLevel;
  chain.setHeading({ level }).run();
}

function resolveBlockTypeTarget(
  editor: Editor,
  position: number,
): { selectionPosition: number; element: HTMLElement | null } | null {
  const clamped = clampDocumentPosition(editor, position);
  const resolved = editor.state.doc.resolve(clamped);
  let depth = resolved.depth;

  while (depth > 0 && !resolved.node(depth).isTextblock) depth -= 1;

  if (depth === 0) {
    const adjacent = resolved.nodeAfter;
    if (!adjacent?.isTextblock) return null;
    return {
      selectionPosition: Math.min(editor.state.doc.content.size, clamped + 1),
      element: asElement(editor.view.nodeDOM(clamped)),
    };
  }

  const start = resolved.start(depth);
  const end = resolved.end(depth);
  return {
    selectionPosition: Math.max(start, Math.min(clamped, end)),
    element: asElement(editor.view.nodeDOM(resolved.before(depth))),
  };
}

function clampDocumentPosition(editor: Editor, position: number): number {
  return Math.max(0, Math.min(position, editor.state.doc.content.size));
}

function asElement(node: Node | null): HTMLElement | null {
  if (node instanceof HTMLElement) return node;
  return node?.parentElement ?? null;
}

function getBlockTypeCopy(): BlockTypeCopy {
  const locale = (document.documentElement.lang || navigator.language || 'en')
    .toLowerCase()
    .split('-')[0];
  if (locale === 'hu' || locale === 'de') return BLOCK_TYPE_COPY[locale];
  return BLOCK_TYPE_COPY.en;
}

function normalizeSourceFontFamily(value: string | null): string | null {
  const family = value?.trim();
  return family && family.length <= 128 && Array.from(family).every((character) => { const code = character.charCodeAt(0); return code >= 32 && code !== 127; })
    ? family
    : null;
}

function sanitizeLinkAttributes(
  attributes: HtmlAttributeMap,
): HtmlAttributeMap {
  return typeof attributes.title === 'string' && attributes.title.trim()
    ? { title: attributes.title.trim() }
    : {};
}
