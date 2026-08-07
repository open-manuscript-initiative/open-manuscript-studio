import {
  Mark,
  mergeAttributes,
} from '@tiptap/core';

import {
  normalizeExternalHref,
  normalizeInlineLanguageTag,
} from '../../model/richText';

type HtmlAttributeMap = Record<string, unknown>;

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

export const OMI_RICH_TEXT_EXTENSIONS = [
  OmiLinkExtension,
  OmiSuperscriptExtension,
  OmiSubscriptExtension,
  OmiLanguageExtension,
];

function sanitizeLinkAttributes(
  attributes: HtmlAttributeMap,
): HtmlAttributeMap {
  return typeof attributes.title === 'string' && attributes.title.trim()
    ? { title: attributes.title.trim() }
    : {};
}
