/** Accept the server origin used by production or an explicit API base path. */
export function normalizeIntegrationApiBaseUrl(value: string): string {
  const base = value.trim().replace(/\/+$/, '');
  return base.endsWith('/api') ? base : `${base}/api`;
}
