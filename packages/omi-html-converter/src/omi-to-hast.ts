import type {
  Element,
  ElementContent,
  Properties,
  Root as HastRoot,
  RootContent,
  Text as HastText,
} from 'hast';
import type {Plugin, Transformer} from 'unified';

import type {
  OmiBlockNode,
  OmiInlineNode,
  OmiNote,
  OmiParagraph,
  OmiRoot,
  OmiText,
} from './omi-ast.js';

/**
 * A konverter konfigurációja.
 */
export interface OmiToHastOptions {
  /**
   * A jegyzetjelölő HTML-eleme.
   *
   * - span: passzív, csak megjelenített jelölő
   * - button: interaktív jegyzetmegnyitó
   */
  noteElement?: 'span' | 'button';

  /**
   * A jegyzet metaadatai JSON-ként bekerüljenek-e
   * a data-omi-note-metadata attribútumba.
   */
  includeMetadata?: boolean;

  /**
   * A jegyzet teljes szövege bekerüljön-e adat-attribútumba.
   *
   * Nagy jegyzetek vagy érzékeny tartalom esetén ezt
   * célszerű kikapcsolni, és csak noteId-t exportálni.
   */
  includeNoteContent?: boolean;
}

type BlockHandler<TNode extends OmiBlockNode = OmiBlockNode> = (
  node: TNode,
  context: ConversionContext,
) => RootContent;

type InlineHandler<TNode extends OmiInlineNode = OmiInlineNode> = (
  node: TNode,
  context: ConversionContext,
) => ElementContent;

/**
 * A konverzió során használt kontextus.
 *
 * A handler-regiszter lehetővé teszi, hogy a node-konverziók
 * elkülönüljenek egymástól.
 */
interface ConversionContext {
  options: Required<OmiToHastOptions>;

  convertBlock(node: OmiBlockNode): RootContent;
  convertInline(node: OmiInlineNode): ElementContent;
}

/**
 * OMI blokkcsomópont-kezelők.
 *
 * Később itt regisztrálható például:
 *
 * - heading
 * - blockquote
 * - table
 * - figure
 * - bibliography
 */
const blockHandlers = {
  paragraph: convertParagraph,
} satisfies {
  [Type in OmiBlockNode['type']]: BlockHandler<
    Extract<OmiBlockNode, {type: Type}>
  >;
};

/**
 * OMI inline csomópont-kezelők.
 *
 * Később itt regisztrálható például:
 *
 * - emphasis
 * - strong
 * - citation
 * - link
 * - cross-reference
 * - inline-formula
 */
const inlineHandlers = {
  text: convertText,
  'omi-note': convertNote,
} satisfies {
  [Type in OmiInlineNode['type']]: InlineHandler<
    Extract<OmiInlineNode, {type: Type}>
  >;
};

/**
 * Egyedi unified plugin.
 *
 * Bemenet:
 *   OmiRoot
 *
 * Kimenet:
 *   hast.Root
 */
export const omiToHast: Plugin<[OmiToHastOptions?], OmiRoot, HastRoot> =
  function omiToHastPlugin(options = {}) {
    const normalizedOptions: Required<OmiToHastOptions> = {
      noteElement: options.noteElement ?? 'button',
      includeMetadata: options.includeMetadata ?? true,
      includeNoteContent: options.includeNoteContent ?? true,
    };

    const transformer: Transformer<OmiRoot, HastRoot> = (tree) => {
      const context = createConversionContext(normalizedOptions);
      return convertRoot(tree, context);
    };

    return transformer;
  };

function createConversionContext(
  options: Required<OmiToHastOptions>,
): ConversionContext {
  return {
    options,

    convertBlock(node): RootContent {
      switch (node.type) {
        case 'paragraph':
          return blockHandlers.paragraph(node, this);

        default:
          return assertNever(node);
      }
    },

    convertInline(node): ElementContent {
      switch (node.type) {
        case 'text':
          return inlineHandlers.text(node, this);

        case 'omi-note':
          return inlineHandlers['omi-note'](node, this);

        default:
          return assertNever(node);
      }
    },
  };
}

/**
 * Root konvertálása.
 *
 * A HAST root önmagában nem hoz létre <html> vagy <body> elemet,
 * ezért az eredmény HTML-fragmentum lesz.
 */
function convertRoot(
  node: OmiRoot,
  context: ConversionContext,
): HastRoot {
  const children = node.children.map((child) =>
    context.convertBlock(child),
  );

  return {
    type: 'root',
    children,
    data: {
      omiDocumentId: node.id,
      omiVersion: node.version,
    },
  };
}

function convertParagraph(
  node: OmiParagraph,
  context: ConversionContext,
): Element {
  return {
    type: 'element',
    tagName: 'p',
    properties: {
      className: ['omi-paragraph'],
    },
    children: node.children.map((child) =>
      context.convertInline(child),
    ),
  };
}

function convertText(
  node: OmiText,
  _context: ConversionContext,
): HastText {
  return {
    type: 'text',
    value: node.value,
  };
}

function convertNote(
  node: OmiNote,
  context: ConversionContext,
): Element {
  const properties: Properties = {
    className: ['omi-note'],
    dataOmiNodeType: 'omi-note',
    dataOmiNoteId: node.noteId,
  };

  if (context.options.includeMetadata) {
    properties.dataOmiNoteMetadata = JSON.stringify(node.metadata);
  }

  if (context.options.includeNoteContent) {
    properties.dataOmiNoteContent = node.content;
  }

  if (context.options.noteElement === 'button') {
    properties.type = 'button';
    properties.ariaLabel = `Jegyzet ${node.label}: ${node.content}`;
    properties.ariaExpanded = false;
    properties.ariaControls = `omi-note-content-${node.noteId}`;
  } else {
    properties.role = 'note';
    properties.ariaLabel = `Jegyzet ${node.label}: ${node.content}`;
  }

  return {
    type: 'element',
    tagName: context.options.noteElement,
    properties,
    children: [
      {
        type: 'text',
        value: node.label,
      },
    ],
  };
}

/**
 * Exhaustiveness check.
 *
 * Új OMI node-típus hozzáadásakor a TypeScript hibát jelez,
 * amíg annak konverzióját nem kezeljük.
 */
function assertNever(value: never): never {
  throw new Error(
    `Nem támogatott OMI csomópont: ${JSON.stringify(value)}`,
  );
}
