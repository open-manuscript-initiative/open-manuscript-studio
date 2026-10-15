/** Web-origin WebAuthn only. Native clients need a separately verified auth handoff. */
export async function hasPlatformPasskey(): Promise<boolean> {
  const location = globalThis.location;
  if (!location || !['https:', 'http:'].includes(location.protocol)
    || location.hostname === 'tauri.localhost'
    || '__TAURI_INTERNALS__' in globalThis
    || !globalThis.isSecureContext) return false;
  const credential = globalThis.PublicKeyCredential;
  try {
    return await credential?.isUserVerifyingPlatformAuthenticatorAvailable?.() ?? false;
  } catch { return false; }
}
