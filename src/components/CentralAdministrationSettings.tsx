import {
  Building2,
  KeyRound,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import {
  addCentralInstitutionAdmin,
  createCentralInstitution,
  createInstitutionApiCredential,
  getCentralAuditEvents,
  getCentralInstitutionAdmins,
  getCentralInstitutions,
  getInstitutionApiCredentials,
  removeCentralInstitutionAdmin,
  revokeInstitutionApiCredential,
  updateCentralInstitution,
  type CentralAdminRole,
  type CentralAuditEvent,
  type CentralInstitution,
  type CentralInstitutionAdmin,
  type InstitutionApiCredential,
  type InstitutionApiScope,
} from '../services/centralAdminApi';

interface CentralAdministrationSettingsProps {
  locale: string;
  role: CentralAdminRole;
}

const API_SCOPES: InstitutionApiScope[] = [
  'institution:read',
  'members:read',
  'members:write',
  'integrations:read',
  'integrations:write',
];

const copy = {
  en: {
    title: 'Central administration',
    description: 'Manage institutions, institutional administrators and scoped Admin API credentials. Central access does not grant manuscript access.',
    refresh: 'Refresh',
    addInstitution: 'Add institution',
    institutionName: 'Institution name',
    ror: 'ROR identifier',
    create: 'Create',
    active: 'Active',
    disabled: 'Disabled',
    manage: 'Manage',
    members: 'members',
    apiKeys: 'API credentials',
    admins: 'Institution administrators',
    addAdmin: 'Add administrator',
    email: 'Studio account e-mail',
    adminRole: 'Role',
    remove: 'Remove admin role',
    apiTitle: 'Institution Admin API',
    apiDescription: 'Tokens are institution-bound, scoped and shown only once when created.',
    label: 'Credential label',
    expires: 'Expires in days',
    createToken: 'Create API token',
    revoke: 'Revoke',
    tokenOnce: 'Copy this token now. It will not be shown again.',
    audit: 'Recent audit events',
    none: 'No records yet.',
  },
  hu: {
    title: 'Központi adminisztráció',
    description: 'Intézmények, intézményi adminisztrátorok és scope-olt Admin API-hozzáférések kezelése. A központi jogosultság nem ad hozzáférést a kéziratokhoz.',
    refresh: 'Frissítés',
    addInstitution: 'Intézmény hozzáadása',
    institutionName: 'Intézmény neve',
    ror: 'ROR-azonosító',
    create: 'Létrehozás',
    active: 'Aktív',
    disabled: 'Letiltva',
    manage: 'Kezelés',
    members: 'tag',
    apiKeys: 'API-hozzáférések',
    admins: 'Intézményi adminisztrátorok',
    addAdmin: 'Adminisztrátor hozzáadása',
    email: 'Studio-fiók e-mail-címe',
    adminRole: 'Szerepkör',
    remove: 'Adminjog visszavonása',
    apiTitle: 'Intézményi Admin API',
    apiDescription: 'A tokenek intézményhez kötöttek, scope-oltak, és létrehozáskor csak egyszer láthatók.',
    label: 'API-hozzáférés neve',
    expires: 'Lejárat napokban',
    createToken: 'API-token létrehozása',
    revoke: 'Visszavonás',
    tokenOnce: 'Másold ki most a tokent. Később nem jelenik meg újra.',
    audit: 'Legutóbbi auditbejegyzések',
    none: 'Még nincs bejegyzés.',
  },
  de: {
    title: 'Zentrale Administration',
    description: 'Institutionen, Institutionsadministratoren und bereichsgebundene Admin-API-Zugänge verwalten. Zentrale Rechte gewähren keinen Manuskriptzugriff.',
    refresh: 'Aktualisieren',
    addInstitution: 'Institution hinzufügen',
    institutionName: 'Name der Institution',
    ror: 'ROR-Kennung',
    create: 'Erstellen',
    active: 'Aktiv',
    disabled: 'Deaktiviert',
    manage: 'Verwalten',
    members: 'Mitglieder',
    apiKeys: 'API-Zugänge',
    admins: 'Institutionsadministratoren',
    addAdmin: 'Administrator hinzufügen',
    email: 'E-Mail des Studio-Kontos',
    adminRole: 'Rolle',
    remove: 'Adminrolle entfernen',
    apiTitle: 'Institution Admin API',
    apiDescription: 'Tokens sind institutionsgebunden, bereichsbeschränkt und werden bei der Erstellung nur einmal angezeigt.',
    label: 'Bezeichnung',
    expires: 'Ablauf in Tagen',
    createToken: 'API-Token erstellen',
    revoke: 'Widerrufen',
    tokenOnce: 'Kopieren Sie den Token jetzt. Er wird später nicht erneut angezeigt.',
    audit: 'Letzte Audit-Ereignisse',
    none: 'Noch keine Einträge.',
  },
} as const;

export function CentralAdministrationSettings({ locale, role }: CentralAdministrationSettingsProps) {
  const labels = copy[locale as keyof typeof copy] ?? copy.en;
  const [institutions, setInstitutions] = useState<CentralInstitution[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [admins, setAdmins] = useState<CentralInstitutionAdmin[]>([]);
  const [credentials, setCredentials] = useState<InstitutionApiCredential[]>([]);
  const [audit, setAudit] = useState<CentralAuditEvent[]>([]);
  const [institutionName, setInstitutionName] = useState('');
  const [rorId, setRorId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminRole, setAdminRole] = useState<'ADMIN' | 'OWNER'>('ADMIN');
  const [credentialLabel, setCredentialLabel] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('365');
  const [scopes, setScopes] = useState<InstitutionApiScope[]>(['institution:read', 'members:read']);
  const [newToken, setNewToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const selected = useMemo(
    () => institutions.find((institution) => institution.id === selectedId) ?? null,
    [institutions, selectedId],
  );

  const refreshInstitutions = useCallback(async () => {
    setError('');
    try {
      const next = await getCentralInstitutions();
      setInstitutions(next);
      setSelectedId((current) => current && next.some((item) => item.id === current) ? current : next[0]?.id ?? '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Central administration could not be loaded.');
    }
  }, []);

  const refreshSelected = useCallback(async () => {
    if (!selectedId) {
      setAdmins([]);
      setCredentials([]);
      setAudit([]);
      return;
    }
    try {
      const [nextAdmins, nextCredentials, nextAudit] = await Promise.all([
        getCentralInstitutionAdmins(selectedId),
        getInstitutionApiCredentials(selectedId),
        getCentralAuditEvents(selectedId),
      ]);
      setAdmins(nextAdmins);
      setCredentials(nextCredentials);
      setAudit(nextAudit);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Institution administration could not be loaded.');
    }
  }, [selectedId]);

  useEffect(() => { void refreshInstitutions(); }, [refreshInstitutions]);
  useEffect(() => { void refreshSelected(); }, [refreshSelected]);

  async function createInstitution(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const institution = await createCentralInstitution({ name: institutionName, rorId: rorId.trim() || null });
      setInstitutionName(''); setRorId('');
      await refreshInstitutions();
      setSelectedId(institution.id);
    } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  }

  async function toggleInstitution(institution: CentralInstitution): Promise<void> {
    setBusy(true); setError('');
    try {
      await updateCentralInstitution(institution.id, { status: institution.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' });
      await refreshInstitutions();
    } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  }

  async function addAdmin(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!selectedId) return;
    setBusy(true); setError('');
    try {
      await addCentralInstitutionAdmin(selectedId, adminEmail, adminRole);
      setAdminEmail('');
      await refreshSelected();
    } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  }

  async function removeAdmin(membershipId: string): Promise<void> {
    if (!selectedId) return;
    setBusy(true); setError('');
    try {
      await removeCentralInstitutionAdmin(selectedId, membershipId);
      await refreshSelected();
    } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  }

  async function createCredential(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!selectedId) return;
    setBusy(true); setError(''); setNewToken('');
    try {
      const result = await createInstitutionApiCredential({
        institutionId: selectedId,
        label: credentialLabel,
        scopes,
        expiresInDays: Math.max(1, Number(expiresInDays) || 365),
      });
      setNewToken(result.token);
      setCredentialLabel('');
      await refreshSelected();
    } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  }

  async function revokeCredential(credentialId: string): Promise<void> {
    if (!selectedId) return;
    setBusy(true); setError('');
    try {
      await revokeInstitutionApiCredential(selectedId, credentialId);
      await refreshSelected();
    } catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  }

  function toggleScope(scope: InstitutionApiScope): void {
    setScopes((current) => current.includes(scope) ? current.filter((value) => value !== scope) : [...current, scope]);
  }

  return (
    <section className="central-admin-settings">
      <div className="account-section-heading">
        <div>
          <h2>{labels.title}</h2>
          <p>{labels.description}</p>
          <small><ShieldCheck size={13} aria-hidden="true" /> {role}</small>
        </div>
        <button type="button" className="account-identity-action" onClick={() => void refreshInstitutions()} disabled={busy}>
          <RefreshCw size={14} aria-hidden="true" /> {labels.refresh}
        </button>
      </div>

      {error ? <div className="account-error" role="alert">{error}</div> : null}

      <form className="central-admin-inline-form" onSubmit={(event) => void createInstitution(event)}>
        <h3>{labels.addInstitution}</h3>
        <input required maxLength={300} value={institutionName} placeholder={labels.institutionName} onChange={(event) => setInstitutionName(event.target.value)} />
        <input maxLength={128} value={rorId} placeholder={labels.ror} onChange={(event) => setRorId(event.target.value)} />
        <button className="account-primary" type="submit" disabled={busy}><Plus size={15} aria-hidden="true" /> {labels.create}</button>
      </form>

      <div className="central-admin-institution-list">
        {institutions.map((institution) => (
          <article className={`central-admin-institution${selectedId === institution.id ? ' central-admin-institution--selected' : ''}`} key={institution.id}>
            <Building2 size={18} aria-hidden="true" />
            <div>
              <strong>{institution.name}</strong>
              <small>{institution.rorId ?? '—'} · {institution.memberCount} {labels.members} · {institution.apiCredentialCount} {labels.apiKeys}</small>
            </div>
            <span>{institution.status === 'ACTIVE' ? labels.active : labels.disabled}</span>
            <button type="button" className="account-identity-action" onClick={() => setSelectedId(institution.id)}>{labels.manage}</button>
            <button type="button" className="account-identity-action" disabled={busy} onClick={() => void toggleInstitution(institution)}>
              {institution.status === 'ACTIVE' ? labels.disabled : labels.active}
            </button>
          </article>
        ))}
      </div>

      {selected ? (
        <div className="central-admin-detail">
          <h3>{selected.name}</h3>

          <section>
            <h4>{labels.admins}</h4>
            <form className="central-admin-inline-form" onSubmit={(event) => void addAdmin(event)}>
              <input required type="email" value={adminEmail} placeholder={labels.email} onChange={(event) => setAdminEmail(event.target.value)} />
              <select value={adminRole} aria-label={labels.adminRole} onChange={(event) => setAdminRole(event.target.value as 'ADMIN' | 'OWNER')}>
                <option value="ADMIN">ADMIN</option><option value="OWNER">OWNER</option>
              </select>
              <button className="account-primary" type="submit" disabled={busy}><Plus size={15} aria-hidden="true" /> {labels.addAdmin}</button>
            </form>
            {admins.map((admin) => (
              <div className="central-admin-row" key={admin.id}>
                <div><strong>{admin.fullName}</strong><small>{admin.email} · {admin.role}</small></div>
                <button type="button" className="account-identity-action account-identity-action--danger" disabled={busy} onClick={() => void removeAdmin(admin.id)}>
                  <Trash2 size={14} aria-hidden="true" /> {labels.remove}
                </button>
              </div>
            ))}
          </section>

          <section>
            <h4>{labels.apiTitle}</h4>
            <p>{labels.apiDescription}</p>
            <form className="central-admin-token-form" onSubmit={(event) => void createCredential(event)}>
              <input required maxLength={160} value={credentialLabel} placeholder={labels.label} onChange={(event) => setCredentialLabel(event.target.value)} />
              <input type="number" min="1" max="3650" value={expiresInDays} aria-label={labels.expires} onChange={(event) => setExpiresInDays(event.target.value)} />
              <div className="central-admin-scope-list">
                {API_SCOPES.map((scope) => (
                  <label key={scope}><input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} /> {scope}</label>
                ))}
              </div>
              <button className="account-primary" type="submit" disabled={busy || scopes.length === 0}><KeyRound size={15} aria-hidden="true" /> {labels.createToken}</button>
            </form>
            {newToken ? <div className="central-admin-token-once"><strong>{labels.tokenOnce}</strong><code>{newToken}</code></div> : null}
            {credentials.map((credential) => (
              <div className="central-admin-row" key={credential.id}>
                <div><strong>{credential.label}</strong><small>{credential.tokenPrefix} · {credential.status} · {credential.scopes.join(', ')}</small></div>
                {credential.status === 'ACTIVE' ? <button type="button" className="account-identity-action account-identity-action--danger" disabled={busy} onClick={() => void revokeCredential(credential.id)}>{labels.revoke}</button> : null}
              </div>
            ))}
          </section>

          <section>
            <h4>{labels.audit}</h4>
            {audit.length ? audit.slice(0, 30).map((event) => (
              <div className="central-admin-audit-row" key={event.id}><code>{event.action}</code><span>{new Date(event.createdAt).toLocaleString(locale)}</span></div>
            )) : <p>{labels.none}</p>}
          </section>
        </div>
      ) : null}
    </section>
  );
}

function errorText(reason: unknown): string {
  return reason instanceof Error ? reason.message : 'Central administration request failed.';
}
