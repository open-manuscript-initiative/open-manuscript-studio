/**
 * OnlyOffice/EuroOffice callbacks contain a download URL created by the
 * document server. It is never an unrestricted SSRF destination.
 *
 * This check binds the callback to the configured Office origin. Actual
 * DNS answers are evaluated again and pinned at socket connect time by
 * fetchPinnedPublicUrl; preflight DNS checks alone are not sufficient.
 */
export function validateEuroOfficeCallbackSource(
  rawUrl: string,
  configuredOfficeUrl: string,
): URL {
  let source: URL;
  let office: URL;
  try {
    source = new URL(rawUrl);
    office = new URL(configuredOfficeUrl);
  } catch {
    throw new Error('Invalid EuroOffice callback URL.');
  }
  if (
    office.protocol !== 'https:' ||
    office.username || office.password || office.hash ||
    source.protocol !== 'https:' ||
    source.username || source.password || source.hash ||
    source.origin !== office.origin
  ) {
    throw new Error('EuroOffice callback URL must use the configured HTTPS origin.');
  }
  return source;
}
