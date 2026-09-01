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

  renderHTML() {
    return ['u', { 'data-omi-underline': 'true' }, 0];
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

/**
 * Provides a compact structural menu for the current ProseMirror text block.
 * The menu deliberately operates on the editor selection rather than the OMI
 * section container, so it can turn one paragraph (or a multi-block selection)
 * into a heading, quotation or list without changing the surrounding section.
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

export const OMI_RICH_TEXT_EXTENSIONS = [
  OmiManuscriptBoundaryEditingExtension,
  OmiManuscriptSelectionExtension,
  OmiLinkExtension,
  OmiSuperscriptExtension,
  OmiSubscriptExtension,
  OmiSmallCapsExtension,
  OmiUnderlineExtension,
  OmiLanguageExtension,
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

  const select = document.createElement('select');
  select.className = 'omi-block-type-menu__select';
  select.setAttribute('aria-label', copy.label);
  select.title = copy.label;

  appendOption(select, 'paragraph', copy.paragraph);
  const headings = document.createElement('optgroup');
  headings.label = copy.headings;
  for (const level of [1, 2, 3, 4, 5, 6] as HeadingLevel[]) {
    appendOption(headings, `heading-${level}`, copy.heading(level));
  }
  select.append(headings);
  appendOption(select, 'blockquote', copy.quote);
  appendOption(select, 'bulletList', copy.bulletList);
  appendOption(select, 'orderedList', copy.orderedList);
  appendOption(select, 'codeBlock', copy.codeBlock);

  const onChange = () => {
    applyBlockType(editor, select.value as BlockType);
    syncBlockTypeSelect(editor, select);
  };
  const preserveSelection = (event: MouseEvent) => {
    event.stopPropagation();
  };

  select.addEventListener('change', onChange);
  select.addEventListener('mousedown', preserveSelection);
  container.append(select);
  host.classList.add('omi-block-type-menu-host');
  host.append(container);
  syncBlockTypeSelect(editor, select);

  return {
    update: () => syncBlockTypeSelect(editor, select),
    destroy: () => {
      select.removeEventListener('change', onChange);
      select.removeEventListener('mousedown', preserveSelection);
      container.remove();
      host.classList.remove('omi-block-type-menu-host');
    },
  };
}

function appendOption(
  parent: HTMLSelectElement | HTMLOptGroupElement,
  value: BlockType,
  label: string,
): void {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  parent.append(option);
}

function syncBlockTypeSelect(editor: Editor, select: HTMLSelectElement): void {
  select.disabled = !editor.isEditable;
  select.value = getActiveBlockType(editor);
}

function getActiveBlockType(editor: Editor): BlockType {
  if (editor.isActive('bulletList')) return 'bulletList';
  if (editor.isActive('orderedList')) return 'orderedList';
  if (editor.isActive('blockquote')) return 'blockquote';
  if (editor.isActive('codeBlock')) return 'codeBlock';
  for (const level of [1, 2, 3, 4, 5, 6] as HeadingLevel[]) {
    if (editor.isActive('heading', { level })) return `heading-${level}`;
  }
  return 'paragraph';
}

function applyBlockType(editor: Editor, target: BlockType): void {
  if (!editor.isEditable || getActiveBlockType(editor) === target) {
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

function getBlockTypeCopy(): BlockTypeCopy {
  const locale = (document.documentElement.lang || navigator.language || 'en')
    .toLowerCase()
    .split('-')[0];
  if (locale === 'hu' || locale === 'de') return BLOCK_TYPE_COPY[locale];
  return BLOCK_TYPE_COPY.en;
}

function sanitizeLinkAttributes(
  attributes: HtmlAttributeMap,
): HtmlAttributeMap {
  return typeof attributes.title === 'string' && attributes.title.trim()
    ? { title: attributes.title.trim() }
    : {};
}
