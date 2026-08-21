function buildValue(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized || fallback;
}

export const BUILD_INFO = {
  version: buildValue(import.meta.env.VITE_APP_VERSION, 'dev'),
  build: buildValue(import.meta.env.VITE_BUILD_NUMBER, '0'),
  commit: buildValue(import.meta.env.VITE_COMMIT_SHA, '-'),
  builtAt: buildValue(import.meta.env.VITE_BUILD_DATE, '-'),
};
