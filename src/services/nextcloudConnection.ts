export function normalizeNextcloudWebDavUrl(
  serverUrl: string,
  username: string,
): string {
  const trimmedServerUrl = serverUrl.trim();
  const trimmedUsername = username.trim();
  if (!trimmedServerUrl || !trimmedUsername) return trimmedServerUrl;

  const url = new URL(trimmedServerUrl);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Nextcloud server URL must use HTTP or HTTPS.');
  }

  const normalizedPath = url.pathname.replace(/\/+$/, '');
  const existingDavMarker = '/remote.php/dav/files/';
  const markerIndex = normalizedPath.indexOf(existingDavMarker);

  if (markerIndex >= 0) {
    url.pathname = `${normalizedPath}/`;
    url.search = '';
    url.hash = '';
    return url.toString();
  }

  const installationPath = normalizedPath === '/' ? '' : normalizedPath;
  url.pathname = `${installationPath}/remote.php/dav/files/${encodeURIComponent(trimmedUsername)}/`;
  url.search = '';
  url.hash = '';
  return url.toString();
}
