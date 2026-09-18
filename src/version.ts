function buildValue(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized || fallback;
}

const viteEnv = import.meta.env ?? {};

export const BUILD_INFO = {
  version: buildValue(viteEnv.VITE_APP_VERSION, 'dev'),
  build: buildValue(viteEnv.VITE_BUILD_NUMBER, '0'),
  commit: buildValue(viteEnv.VITE_COMMIT_SHA, '-'),
  builtAt: buildValue(viteEnv.VITE_BUILD_DATE, '-'),
};
