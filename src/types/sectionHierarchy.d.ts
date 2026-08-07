import './omi';

declare module './omi' {
  interface OmiSection {
    /**
     * Stable semantic parent section. Undefined means a top-level section.
     * The ordered manuscript `sections` array remains the canonical preorder.
     */
    parentSectionId?: string;
  }
}

export {};
