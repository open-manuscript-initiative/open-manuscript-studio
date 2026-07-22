export const BUILD_INFO = {
  version: import.meta.env.VITE_APP_VERSION ?? "dev",
  build: import.meta.env.VITE_BUILD_NUMBER ?? "-",
  commit: import.meta.env.VITE_COMMIT_SHA ?? "-",
  builtAt: import.meta.env.VITE_BUILD_DATE ?? "-",
};
