import { BookA, Bot, CircleHelp, CircleX, ListTree, Plug } from 'lucide-react';
import {
  useEffect,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { isDocumentClosedState } from '../app/documentCloseState';
import { closeCurrentDocument } from '../app/documentLifecycle';
import { useTranslation } from '../i18n';
import { getLocalizedHelpCopy } from '../i18n/helpResolver';
import type { OjsAssignmentLaunchContext } from '../services/ojsAssignmentApi';
import { HelpPanel } from './HelpPanel';
import { IndexPanel } from './IndexPanel';
import { IntegrationExecutionWorkspace } from './IntegrationExecutionWorkspace';
import { IntegrationsPanel } from './IntegrationsPanel';
import { OmiAgentsWorkspace } from './OmiAgentsWorkspace';
import { StudioMenu } from './StudioMenu';
import { TableOfContentsPanel } from './TableOfContentsPanel';
import './StudioMenuWithHelp.css';

interface StudioMenuWithHelpProps {
  open: boolean;
  onClose: () => void;
  ojsAssignment?: {
    actorMode: 'editor' | 'author';
    context: OjsAssignmentLaunchContext;
  } | null;
}

export function StudioMenuWithHelp({
  open,
  onClose,
  ojsAssignment = null,
}: StudioMenuWithHelpProps) {
  const { locale } = useTranslation();
  const copy = getLocalizedHelpCopy(locale);
  const integrationsLabel = getIntegrationsLabel(locale);
  const agentsLabel = getAgentsLabel(locale);
  const indexLabel = getIndexLabel(locale);
  const tocLabel = getTocLabel(locale);
  const closeDocumentCopy = getCloseDocumentCopy(locale);
  const documentAlreadyClosed = isDocumentClosedState();
  const [helpOpen, setHelpOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [indexOpen, setIndexOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [navigationHost, setNavigationHost] = useState<HTMLElement | null>(null);
  const [contentHost, setContentHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      setHelpOpen(false);
      setIntegrationsOpen(false);
      setAgentsOpen(false);
      setIndexOpen(false);
      setTocOpen(false);
      setNavigationHost(null);
      setContentHost(null);
      return;
    }
    setNavigationHost(document.querySelector<HTMLElement>('.studio-menu-navigation'));
    setContentHost(document.querySelector<HTMLElement>('.studio-menu-content'));
  }, [open]);

  useEffect(() => {
    if (!navigationHost) return;
    const closePortalOnOtherNavigation = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>('.studio-menu-nav-button');
      if (!button) return;
      if (button.dataset.helpNavigation !== 'true') setHelpOpen(false);
      if (button.dataset.integrationsNavigation !== 'true') setIntegrationsOpen(false);
      if (button.dataset.agentsNavigation !== 'true') setAgentsOpen(false);
      if (button.dataset.indexNavigation !== 'true') setIndexOpen(false);
      if (button.dataset.tocNavigation !== 'true') setTocOpen(false);
    };
    navigationHost.addEventListener('click', closePortalOnOtherNavigation);
    return () => navigationHost.removeEventListener('click', closePortalOnOtherNavigation);
  }, [navigationHost]);

  useEffect(() => {
    if (!navigationHost) return;
    const internalButtons = Array.from(
      navigationHost.querySelectorAll<HTMLButtonElement>(
        '.studio-menu-nav-button:not([data-help-navigation="true"]):not([data-integrations-navigation="true"]):not([data-agents-navigation="true"]):not([data-index-navigation="true"]):not([data-toc-navigation="true"]):not([data-document-close="true"])',
      ),
    );
    const externalNavigationOpen = helpOpen || integrationsOpen || agentsOpen || indexOpen || tocOpen;
    for (const button of internalButtons) {
      button.classList.remove('studio-menu-nav-button--external-suppressed');
      if (!button.classList.contains('studio-menu-nav-button--active')) {
        button.removeAttribute('aria-current');
        continue;
      }
      if (externalNavigationOpen) {
        button.classList.add('studio-menu-nav-button--external-suppressed');
        button.removeAttribute('aria-current');
      } else {
        button.setAttribute('aria-current', 'page');
      }
    }
    return () => {
      for (const button of internalButtons) {
        button.classList.remove('studio-menu-nav-button--external-suppressed');
        if (button.classList.contains('studio-menu-nav-button--active')) button.setAttribute('aria-current', 'page');
      }
    };
  }, [navigationHost, helpOpen, integrationsOpen, agentsOpen, indexOpen, tocOpen]);

  useEffect(() => {
    if (!contentHost) return;
    if (helpOpen || integrationsOpen || agentsOpen || indexOpen || tocOpen) {
      contentHost.classList.add('studio-menu-content--help-open');
    } else {
      contentHost.classList.remove('studio-menu-content--help-open');
    }
    return () => contentHost.classList.remove('studio-menu-content--help-open');
  }, [contentHost, helpOpen, integrationsOpen, agentsOpen, indexOpen, tocOpen]);

  const closeExternalViews = () => {
    setHelpOpen(false);
    setIntegrationsOpen(false);
    setAgentsOpen(false);
    setIndexOpen(false);
    setTocOpen(false);
  };

  const requestDocumentClose = () => {
    if (!window.confirm(closeDocumentCopy.confirm)) return;
    void closeCurrentDocument();
  };

  return (
    <>
      <StudioMenu open={open} onClose={onClose} ojsAssignment={ojsAssignment} />

      {navigationHost ? createPortal(
        <>
          <button type="button" data-toc-navigation="true" className={`studio-menu-nav-button${tocOpen ? ' studio-menu-nav-button--active' : ''}`} aria-current={tocOpen ? 'page' : undefined} onClick={() => { closeExternalViews(); setTocOpen(true); }}>
            <ListTree size={18} aria-hidden="true" /><span>{tocLabel}</span>
          </button>
          <button type="button" data-index-navigation="true" className={`studio-menu-nav-button${indexOpen ? ' studio-menu-nav-button--active' : ''}`} aria-current={indexOpen ? 'page' : undefined} onClick={() => { closeExternalViews(); setIndexOpen(true); }}>
            <BookA size={18} aria-hidden="true" /><span>{indexLabel}</span>
          </button>
          <button type="button" data-agents-navigation="true" className={`studio-menu-nav-button${agentsOpen ? ' studio-menu-nav-button--active' : ''}`} aria-current={agentsOpen ? 'page' : undefined} onClick={() => { closeExternalViews(); setAgentsOpen(true); }}>
            <Bot size={18} aria-hidden="true" /><span>{agentsLabel}</span>
          </button>
          <button type="button" data-integrations-navigation="true" className={`studio-menu-nav-button${integrationsOpen ? ' studio-menu-nav-button--active' : ''}`} aria-current={integrationsOpen ? 'page' : undefined} onClick={() => { closeExternalViews(); setIntegrationsOpen(true); }}>
            <Plug size={18} aria-hidden="true" /><span>{integrationsLabel}</span>
          </button>
          <button type="button" data-help-navigation="true" className={`studio-menu-nav-button${helpOpen ? ' studio-menu-nav-button--active' : ''}`} aria-current={helpOpen ? 'page' : undefined} onClick={() => { closeExternalViews(); setHelpOpen(true); }}>
            <CircleHelp size={18} aria-hidden="true" /><span>{copy.navigation}</span>
          </button>
          {!documentAlreadyClosed ? (
            <button
              type="button"
              data-document-close="true"
              className="studio-menu-nav-button studio-menu-nav-button--document-close"
              onClick={requestDocumentClose}
            >
              <CircleX size={18} aria-hidden="true" /><span>{closeDocumentCopy.label}</span>
            </button>
          ) : null}
        </>,
        navigationHost,
      ) : null}

      {contentHost && tocOpen ? createPortal(
        <div className="studio-help-portal studio-toc-portal"><TableOfContentsPanel onNavigate={onClose} /></div>,
        contentHost,
      ) : null}
      {contentHost && indexOpen ? createPortal(
        <div className="studio-help-portal studio-index-portal"><IndexPanel onNavigate={onClose} /></div>,
        contentHost,
      ) : null}
      {contentHost && agentsOpen ? createPortal(
        <div className="studio-help-portal studio-agents-portal"><OmiAgentsWorkspace /></div>,
        contentHost,
      ) : null}
      {contentHost && integrationsOpen ? createPortal(
        <div className="studio-help-portal studio-integrations-portal"><IntegrationsPanel /><IntegrationExecutionWorkspace /></div>,
        contentHost,
      ) : null}
      {contentHost && helpOpen ? createPortal(
        <div className="studio-help-portal"><HelpPanel /></div>,
        contentHost,
      ) : null}
    </>
  );
}

function getAgentsLabel(locale: string): string {
  const labels: Record<string, string> = { de: 'OMI Agents', en: 'OMI Agents', hu: 'OMI Agents' };
  return labels[locale] ?? labels.en;
}

function getIntegrationsLabel(locale: string): string {
  const labels: Record<string, string> = {
    bg: 'Интеграции', cs: 'Integrace', da: 'Integrationer', de: 'Integrationen', el: 'Ενσωματώσεις', en: 'Integrations', es: 'Integraciones', et: 'Integratsioonid', fi: 'Integraatiot', fr: 'Intégrations', ga: 'Comhtháthuithe', hr: 'Integracije', hu: 'Integrációk', it: 'Integrazioni', lt: 'Integracijos', lv: 'Integrācijas', mt: 'Integrazzjonijiet', nl: 'Integraties', pl: 'Integracje', pt: 'Integrações', ro: 'Integrări', sk: 'Integrácie', sl: 'Integracije', sv: 'Integrationer',
  };
  return labels[locale] ?? labels.en;
}

function getIndexLabel(locale: string): string {
  const labels: Record<string, string> = { de: 'Register', en: 'Indexes', hu: 'Mutatók' };
  return labels[locale] ?? labels.en;
}

function getTocLabel(locale: string): string {
  const labels: Record<string, string> = { de: 'Inhaltsverzeichnis', en: 'Table of contents', hu: 'Tartalomjegyzék' };
  return labels[locale] ?? labels.en;
}

function getCloseDocumentCopy(locale: string) {
  if (locale === 'hu') {
    return {
      label: 'Dokumentum bezárása',
      confirm: 'Bezárja az aktuális dokumentumot? A dokumentum kikerül a visszaállított munkamenetből. A külön fájlba vagy külső rendszerbe még el nem mentett tartalom elveszhet.',
    };
  }

  if (locale === 'de') {
    return {
      label: 'Dokument schließen',
      confirm: 'Aktuelles Dokument schließen? Es wird aus der wiederhergestellten Sitzung entfernt. Inhalte, die noch nicht in einer separaten Datei oder einem externen System gespeichert wurden, können verloren gehen.',
    };
  }

  return {
    label: 'Close document',
    confirm: 'Close the current document? It will be removed from the restored session. Content not yet saved to a separate file or external system may be lost.',
  };
}
