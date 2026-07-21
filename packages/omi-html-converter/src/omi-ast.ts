import type {Node} from 'unist';

/**
 * Az OMI AST összes lehetséges csomópontja.
 *
 * Új csomópont hozzáadásakor ezt az uniót is bővíteni kell.
 */
export type OmiNode =
  | OmiRoot
  | OmiParagraph
  | OmiText
  | OmiNote;

/**
 * Olyan OMI csomópontok, amelyek közvetlenül
 * a dokumentum gyökerében szerepelhetnek.
 */
export type OmiBlockNode =
  | OmiParagraph;

/**
 * Bekezdésen belül használható inline csomópontok.
 */
export type OmiInlineNode =
  | OmiText
  | OmiNote;

/**
 * Az OMI dokumentum gyökércsomópontja.
 */
export interface OmiRoot extends Node {
  type: 'root';

  /**
   * Az OMI dokumentummodell vagy séma verziója.
   */
  version: string;

  /**
   * A dokumentum opcionális stabil azonosítója.
   */
  id?: string;

  children: OmiBlockNode[];
}

/**
 * Egyszerű bekezdés.
 */
export interface OmiParagraph extends Node {
  type: 'paragraph';
  children: OmiInlineNode[];
}

/**
 * Egyszerű szöveges csomópont.
 */
export interface OmiText extends Node {
  type: 'text';
  value: string;
}

/**
 * Jegyzethez tartozó egyszerű metaadatok.
 *
 * Később ez lecserélhető egy teljes OMI Annotation
 * vagy Note modellre.
 */
export interface OmiNoteMetadata {
  /**
   * A jegyzet szerkezeti szerepe.
   */
  kind: 'footnote' | 'endnote' | 'comment' | 'annotation';

  /**
   * A jegyzet szerzője vagy létrehozója.
   */
  author?: string;

  /**
   * ISO 8601 formátumú időpont.
   */
  createdAt?: string;

  /**
   * Tetszőleges további, egyszerű metaadat.
   */
  [key: string]: string | number | boolean | undefined;
}

/**
 * Szövegközi OMI-jegyzetjelölő.
 *
 * Ebben az egyszerű modellben maga a jegyzetszöveg
 * is a csomópont része. Egy fejlettebb modellben
 * a noteId egy külön jegyzettár-bejegyzésre mutathat.
 */
export interface OmiNote extends Node {
  type: 'omi-note';

  /**
   * Stabil jegyzetazonosító.
   */
  noteId: string;

  /**
   * A jegyzet kijelzett jelölése, például „1” vagy „*”.
   */
  label: string;

  /**
   * A jegyzet teljes szövege.
   */
  content: string;

  metadata: OmiNoteMetadata;
}
