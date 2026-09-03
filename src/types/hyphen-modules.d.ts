declare module 'hyphen/*/index.js' {
  export interface HyphenationOptions {
    minWordLength?: number;
    hyphenChar?: string;
  }

  export type HyphenateSync = (
    text: string,
    options?: HyphenationOptions,
  ) => string;

  export const hyphenateSync: HyphenateSync;
  const module: { hyphenateSync: HyphenateSync };
  export default module;
}
