/**
 * A linked federated identity by itself does not prove ownership of the
 * Studio account's email address. Elevated roles may be bootstrapped only
 * when the trusted identity provider explicitly verified the same address.
 *
 * This check is intentionally fail-closed for missing profile attributes,
 * unverified claims and unrelated linked SSO accounts.
 */
export function findVerifiedFederatedIdentity<T extends {
  provider: string;
  profile: unknown;
}>(accountEmail: string, identities: readonly T[]): T | undefined {
  const expected = accountEmail.trim().toLowerCase();
  if (!expected) return undefined;

  return identities.find((identity) => {
    if (identity.provider !== 'OIDC' && identity.provider !== 'SAML') return false;
    const profile = identity.profile;
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return false;
    const claims = profile as Record<string, unknown>;
    return (
      claims.emailVerified === true &&
      typeof claims.email === 'string' &&
      claims.email.trim().toLowerCase() === expected
    );
  });
}
