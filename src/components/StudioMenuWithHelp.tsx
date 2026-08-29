import { Bot, CircleHelp, CircleX, FolderOpen, ListTree, Plug } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  clearDocumentClosedState,
  isDocumentClosedState,
} from '../app/documentCloseState';
import { closeCurrentDocument } from '../app/documentLifecycle';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getLocalizedHelpCopy } from '../i18n/helpResolver';
import { getLocalFileLabels } from '../i18n/nativeStorageTranslations';
import { getStudioPlatform } from '../mobile/platform/platform';
import { isNativeStudio } from '../services/nativeManuscriptFile';
import type { OjsAssignmentLaunchContext } from '../services/ojsAssignmentApi';
import type { OmiManuscript } from '../types/omi';
import { Footer } from './Footer';
import { HelpPanel } from './HelpPanel';
import { IntegrationExecutionWorkspace } from './IntegrationExecutionWorkspace';
import { IntegrationsPanel } from './IntegrationsPanel';
import { ListsPanel } from './ListsPanel';
import { OmiAgentsWorkspace } from './OmiAgentsWorkspace';
import { StudioMenu } from './StudioMenu';
import './StudioMenuWithHelp.css';

interface StudioMenuWithHelpProps {
  open: boolean;
  onClose: () => void;
  ojsAssignment?: { actorMode: 'editor' | 'author'; context: OjsAssignmentLaunchContext } | null;
}

export function StudioMenuWithHelp({ open, onClose, ojsAssignment = null }: StudioMenuWithHelpProps) {
  const { locale } = useTranslation();
  const copy = getLocalizedHelpCopy(locale);
  const integrationsLabel = getIntegrationsLabel(locale);
  const agentsLabel = getAgentsLabel(locale);
  const listsLabel = getListsLabel(locale);
  const closeDocumentCopy = getCloseDocumentCopy(locale);
  const platform = getStudioPlatform();
  const localFileLabels = getLocalFileLabels(locale, platform);
  const native = isNativeStudio();
  const manuscript = useStudioStore((state) => state.manuscript);
  const loadManuscript = useStudioStore((state) => state.loadManuscript);
  const previousManuscriptRef = useRef(manuscript);
  const browserFileInputRef = useRef<HTMLInputElement>(null);
  const [documentAlreadyClosed, setDocumentAlreadyClosed] = useState(() => isDocumentClosedState());
  const [browserOpenMessage, setBrowserOpenMessage] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [listsOpen, setListsOpen] = useState(false);
  const [navigationHost, setNavigationHost] = useState<HTMLElement | null>(null);
  const [contentHost, setContentHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (previousManuscriptRef.current === manuscript) return;
    previousManuscriptRef.current = manuscript;
    clearDocumentClosedState();
    setDocumentAlreadyClosed(false);
  }, [manuscript]);

  useEffect(() => {
    if (!open) {
      setHelpOpen(false); setIntegrationsOpen(false); setAgentsOpen(false); setListsOpen(false);
      setNavigationHost(null); setContentHost(null); return;
    }
    setNavigationHost(document.querySelector<HTMLElement>('.studio-menu-navigation'));
    setContentHost(document.querySelector<HTMLElement>('.studio-menu-content'));
  }, [open]);

  useEffect(() => {
    if (!navigationHost) return;
    const closePortalOnOtherNavigation = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('.studio-menu-nav-button');
      if (!button) return;
      if (button.dataset.helpNavigation !== 'true') setHelpOpen(false);
      if (button.dataset.integrationsNavigation !== 'true') setIntegrationsOpen(false);
      if (button.dataset.agentsNavigation !== 'true') setAgentsOpen(false);
      if (button.dataset.listsNavigation !== 'true') setListsOpen(false);
    };
    navigationHost.addEventListener('click', closePortalOnOtherNavigation);
    return () => navigationHost.removeEventListener('click', closePortalOnOtherNavigation);
  }, [navigationHost]);

  useEffect(() => {
    if (!navigationHost) return;
    const internalButtons = Array.from(navigationHost.querySelectorAll<HTMLButtonElement>(
      '.studio-menu-nav-button:not([data-help-navigation="true"]):not([data-integrations-navigation="true"]):not([data-agents-navigation="true"]):not([data-lists-navigation="true"])',
    ));
    const externalNavigationOpen = helpOpen || integrationsOpen || agentsOpen || listsOpen;
    for (const button of internalButtons) {
      button.classList.remove('studio-menu-nav-button--external-suppressed');
      if (!button.classList.contains('studio-menu-nav-button--active')) { button.removeAttribute('aria-current'); continue; }
      if (externalNavigationOpen) { button.classList.add('studio-menu-nav-button--external-suppressed'); button.removeAttribute('aria-current'); }
      else button.setAttribute('aria-current', 'page');
    }
    return () => { for (const button of internalButtons) button.classList.remove('studio-menu-nav-button--external-suppressed'); };
  }, [navigationHost, helpOpen, integrationsOpen, agentsOpen, listsOpen]);

  useEffect(() => {
    if (!contentHost) return;
    contentHost.classList.toggle('studio-menu-content--help-open', helpOpen || integrationsOpen || agentsOpen || listsOpen);
    return () => contentHost.classList.remove('studio-menu-content--help-open');
  }, [contentHost, helpOpen, integrationsOpen, agentsOpen, listsOpen]);

  const closeExternalViews = () => { setHelpOpen(false); setIntegrationsOpen(false); setAgentsOpen(false); setListsOpen(false); };
  const requestDocumentClose = () => { if (window.confirm(closeDocumentCopy.confirm)) void closeCurrentDocument(); };

  async function openBrowserDocument(file: File | undefined): Promise<void> {
    if (!file) return;
    setBrowserOpenMessage('');
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;
      if (!isOmiManuscript(parsed)) throw new Error(getInvalidDocumentMessage(locale));
      loadManuscript(parsed);
      clearDocumentClosedState();
      setDocumentAlreadyClosed(false);
      setBrowserOpenMessage(localFileLabels.opened);
    } catch (error) {
      setBrowserOpenMessage(error instanceof Error ? error.message : String(error));
    } finally {
      if (browserFileInputRef.current) browserFileInputRef.current.value = '';
    }
  }

  const listsNavigation = (
    <button type="button" data-lists-navigation="true" className={`studio-menu-nav-button${listsOpen ? ' studio-menu-nav-button--active' : ''}`} aria-current={listsOpen ? 'page' : undefined} onClick={() => { closeExternalViews(); setListsOpen(true); }}><ListTree size={18} aria-hidden="true" /><span>{listsLabel}</span></button>
  );
  const workflowServicesNavigation = <>
    <button type="button" data-agents-navigation="true" className={`studio-menu-nav-button${agentsOpen ? ' studio-menu-nav-button--active' : ''}`} aria-current={agentsOpen ? 'page' : undefined} onClick={() => { closeExternalViews(); setAgentsOpen(true); }}><Bot size={18} aria-hidden="true" /><span>{agentsLabel}</span></button>
    <button type="button" data-integrations-navigation="true" className={`studio-menu-nav-button${integrationsOpen ? ' studio-menu-nav-button--active' : ''}`} aria-current={integrationsOpen ? 'page' : undefined} onClick={() => { closeExternalViews(); setIntegrationsOpen(true); }}><Plug size={18} aria-hidden="true" /><span>{integrationsLabel}</span></button>
  </>;
  const utilityNavigation = (
    <button type="button" data-help-navigation="true" className={`studio-menu-nav-button${helpOpen ? ' studio-menu-nav-button--active' : ''}`} aria-current={helpOpen ? 'page' : undefined} onClick={() => { closeExternalViews(); setHelpOpen(true); }}><CircleHelp size={18} aria-hidden="true" /><span>{copy.navigation}</span></button>
  );
  const documentCloseAction = (
    <>
      {!native ? (
        <>
          <input
            ref={browserFileInputRef}
            type="file"
            accept=".omi.json,.json,application/json,application/vnd.openmanuscript+json"
            hidden
            onChange={(event) => void openBrowserDocument(event.target.files?.[0])}
          />
          <button
            type="button"
            className="studio-menu-primary-action"
            onClick={() => browserFileInputRef.current?.click()}
          >
            <FolderOpen size={16} aria-hidden="true" />
            <span>{localFileLabels.open}</span>
          </button>
          {browserOpenMessage ? <span role="status" aria-live="polite">{browserOpenMessage}</span> : null}
        </>
      ) : null}
      {!documentAlreadyClosed ? (
        <button type="button" data-document-close="true" className="studio-menu-secondary-action studio-menu-danger-action" onClick={requestDocumentClose}><CircleX size={16} aria-hidden="true" /><span>{closeDocumentCopy.label}</span></button>
      ) : null}
    </>
  );

  return <>
    <StudioMenu
      open={open}
      onClose={onClose}
      ojsAssignment={ojsAssignment}
      navigationAfterReferences={listsNavigation}
      navigationBeforeTools={workflowServicesNavigation}
      navigationAfterSettings={utilityNavigation}
      documentCloseAction={documentCloseAction}
    />
    {contentHost && listsOpen ? createPortal(<div className="studio-help-portal studio-lists-portal"><ListsPanel onNavigate={onClose} /></div>, contentHost) : null}
    {contentHost && agentsOpen ? createPortal(<div className="studio-help-portal studio-agents-portal"><OmiAgentsWorkspace /></div>, contentHost) : null}
    {contentHost && integrationsOpen ? createPortal(<div className="studio-help-portal studio-integrations-portal"><IntegrationsPanel /><IntegrationExecutionWorkspace /></div>, contentHost) : null}
    {contentHost && helpOpen ? createPortal(<div className="studio-help-portal"><HelpPanel /></div>, contentHost) : null}
    {contentHost && platform === 'android' ? createPortal(<div className="studio-help-portal studio-menu-mobile-footer"><Footer /></div>, contentHost) : null}
  </>;
}

function isOmiManuscript(value: unknown): value is OmiManuscript {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OmiManuscript>;
  return typeof candidate.id === 'string'
    && typeof candidate.title === 'string'
    && Array.isArray(candidate.sections);
}

function getInvalidDocumentMessage(locale: string): string {
  if (locale === 'hu') return 'A kiválasztott fájl nem érvényes OMI-kézirat.';
  if (locale === 'de') return 'Die ausgewählte Datei ist kein gültiges OMI-Manuskript.';
  return 'The selected file is not a valid OMI manuscript.';
}

function getAgentsLabel(locale: string): string { return ({ de: 'OMI Agents', en: 'OMI Agents', hu: 'OMI Agents' } as Record<string, string>)[locale] ?? 'OMI Agents'; }
function getListsLabel(locale: string): string { return ({ de: 'Verzeichnisse', en: 'Lists', hu: 'Jegyzékek' } as Record<string, string>)[locale] ?? 'Lists'; }
function getIntegrationsLabel(locale: string): string {
  const labels: Record<string, string> = { bg: 'Интеграции', cs: 'Integrace', da: 'Integrationer', de: 'Integrationen', el: 'Ενσωματώσεις', en: 'Integrations', es: 'Integraciones', et: 'Integratsioonid', fi: 'Integraatiot', fr: 'Intégrations', ga: 'Comhtháthuithe', hr: 'Integracije', hu: 'Integrációk', it: 'Integrazioni', lt: 'Integracijos', lv: 'Integrācijas', mt: 'Integrazzjonijiet', nl: 'Integraties', pl: 'Integracje', pt: 'Integrações', ro: 'Integrări', sk: 'Integrácie', sl: 'Integracije', sv: 'Integrationer' };
  return labels[locale] ?? labels.en;
}
function getCloseDocumentCopy(locale: string) {
  if (locale === 'hu') return { label: 'Dokumentum bezárása', confirm: 'Bezárja az aktuális dokumentumot? A dokumentum kikerül a visszaállított munkamenetből. A külön fájlba vagy külső rendszerbe még el nem mentett tartalom elveszhet.' };
  if (locale === 'de') return { label: 'Dokument schließen', confirm: 'Aktuelles Dokument schließen? Es wird aus der wiederhergestellten Sitzung entfernt. Inhalte, die noch nicht in einer separaten Datei oder einem externen System gespeichert wurden, können verloren gehen.' };
  return { label: 'Close document', confirm: 'Close the current document? It will be removed from the restored session. Content not yet saved to a separate file or external system may be lost.' };
}
