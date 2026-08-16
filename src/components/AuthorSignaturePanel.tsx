import { CheckCircle2, Fingerprint, KeyRound, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  getAuthorSignatureStatus,
  getPublicationSignatures,
  registerAuthorSigningCredential,
  signCurrentManuscriptRevision,
  type AuthorSignatureStatus,
  type OmiPublicationSignature,
} from '../services/authorSignatureApi';

export function AuthorSignaturePanel() {
  const { locale } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const [status, setStatus] = useState<AuthorSignatureStatus | null>(null);
  const [signatures, setSignatures] = useState<OmiPublicationSignature[]>(() => getPublicationSignatures(manuscript.id));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const copy = locale === 'hu'
    ? {
        title: 'Szerzői kriptográfiai aláírás',
        description: 'A kézirat aktuális, változtathatatlan revízióját WebAuthn/passkey kulccsal írhatja alá. Az identitást a Studio ORCID-on keresztül ellenőrzi.',
        identity: 'Hitelesített identitás',
        noIdentity: 'Nincs hitelesített ORCID-identitás ehhez a munkamenethez.',
        credential: 'Aláírókulcs regisztrálása',
        sign: 'Aktuális revízió aláírása',
        noCredential: 'Az aláírás előtt regisztráljon egy eszközhöz/passkeyhez kötött aláírókulcsot.',
        signed: 'A revízió kriptográfiai aláírása elkészült.',
        registered: 'Az aláírókulcs regisztrálva.',
        current: 'aktuális revízió',
        historical: 'korábbi revízió',
        signatures: 'Aláírások',
        none: 'Ehhez a kézirathoz még nincs tárolt aláírás.',
      }
    : locale === 'de'
      ? {
          title: 'Kryptografische Autorensignatur',
          description: 'Signieren Sie die aktuelle unveränderliche Manuskriptrevision mit einem WebAuthn-/Passkey-Schlüssel. Studio verifiziert die Identität über ORCID.',
          identity: 'Verifizierte Identität',
          noIdentity: 'Für diese Sitzung ist keine verifizierte ORCID-Identität verfügbar.',
          credential: 'Signaturschlüssel registrieren',
          sign: 'Aktuelle Revision signieren',
          noCredential: 'Registrieren Sie vor dem Signieren einen geräte-/passkeygebundenen Signaturschlüssel.',
          signed: 'Die Revision wurde kryptografisch signiert.',
          registered: 'Der Signaturschlüssel wurde registriert.',
          current: 'aktuelle Revision',
          historical: 'frühere Revision',
          signatures: 'Signaturen',
          none: 'Für dieses Manuskript ist noch keine Signatur gespeichert.',
        }
      : {
          title: 'Cryptographic author signature',
          description: 'Sign the current immutable manuscript revision with a WebAuthn/passkey key. Studio verifies the signer identity through ORCID.',
          identity: 'Verified identity',
          noIdentity: 'No verified ORCID identity is available for this session.',
          credential: 'Register signing key',
          sign: 'Sign current revision',
          noCredential: 'Register a device/passkey-bound signing key before signing.',
          signed: 'The revision was cryptographically signed.',
          registered: 'The signing key was registered.',
          current: 'current revision',
          historical: 'older revision',
          signatures: 'Signatures',
          none: 'No signature is stored for this manuscript yet.',
        };

  useEffect(() => {
    setSignatures(getPublicationSignatures(manuscript.id));
    void refreshStatus();
  }, [manuscript.id]);

  const currentSignatures = useMemo(
    () => signatures.filter((signature) => signature.payload.revisionId === manuscript.headRevisionId),
    [signatures, manuscript.headRevisionId],
  );

  async function refreshStatus(): Promise<void> {
    try {
      setStatus(await getAuthorSignatureStatus());
    } catch {
      setStatus(null);
    }
  }

  async function registerCredential(): Promise<void> {
    setBusy(true);
    setMessage('');
    try {
      await registerAuthorSigningCredential('Open Manuscript Studio author signing key');
      await refreshStatus();
      setMessage(copy.registered);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function sign(): Promise<void> {
    if (!status) return;
    setBusy(true);
    setMessage('');
    try {
      const signature = await signCurrentManuscriptRevision(manuscript, status);
      setSignatures((current) => [...current.filter((item) => item.signatureId !== signature.signatureId), signature]);
      setMessage(copy.signed);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="publication-profile-selector" aria-labelledby="author-signatures-title">
      <div className="publication-profile-section-heading">
        <div>
          <h4 id="author-signatures-title">{copy.title}</h4>
          <p>{copy.description}</p>
        </div>
        <ShieldCheck size={22} aria-hidden="true" />
      </div>

      <div className="studio-tool-card">
        <div>
          <strong>{copy.identity}</strong>
          {status ? (
            <p><CheckCircle2 size={15} aria-hidden="true" /> {status.identity.displayName} · ORCID {status.identity.orcid}</p>
          ) : (
            <p><TriangleAlert size={15} aria-hidden="true" /> {copy.noIdentity}</p>
          )}
          {status && status.credentials.length === 0 ? <small>{copy.noCredential}</small> : null}
        </div>
        <div className="studio-tool-actions">
          <button type="button" className="studio-menu-secondary-action" disabled={busy || !status} onClick={() => void registerCredential()}>
            <KeyRound size={16} aria-hidden="true" />{copy.credential}
          </button>
          <button type="button" className="studio-menu-primary-action" disabled={busy || !status || status.credentials.length === 0} onClick={() => void sign()}>
            <Fingerprint size={16} aria-hidden="true" />{copy.sign}
          </button>
        </div>
      </div>

      {message ? <div className="publication-profile-status" role="status">{message}</div> : null}

      <div className="publication-profile-section-heading">
        <div><h5>{copy.signatures}</h5><p>{currentSignatures.length} / {signatures.length} · {copy.current}</p></div>
      </div>
      {signatures.length === 0 ? <p className="publication-profile-no-issues">{copy.none}</p> : (
        <ul className="publication-profile-issue-list">
          {[...signatures].reverse().map((signature) => {
            const current = signature.payload.revisionId === manuscript.headRevisionId;
            return (
              <li className="publication-profile-issue publication-profile-issue--info" key={signature.signatureId}>
                <ShieldCheck size={15} aria-hidden="true" />
                <span>
                  <strong>{signature.payload.signer.displayName}</strong> · ORCID {signature.payload.signer.orcid} · {new Date(signature.payload.signedAt).toLocaleString(locale)} · {current ? copy.current : copy.historical}
                  <br /><code>{signature.payload.revisionId}</code>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
