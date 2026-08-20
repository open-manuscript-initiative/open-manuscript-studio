import { CircleHelp, Plug } from 'lucide-react';
import {
  useEffect,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { useTranslation } from '../i18n';
import { getLocalizedHelpCopy } from '../i18n/helpResolver';
import type { OjsAssignmentLaunchContext } from '../services/ojsAssignmentApi';
import { HelpPanel } from './HelpPanel';
import { IntegrationsPanel } from './IntegrationsPanel';
import { StudioMenu } from './StudioMenu';
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [navigationHost, setNavigationHost] = useState<HTMLElement | null>(null);
  const [contentHost, setContentHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      setHelpOpen(false);
      setIntegrationsOpen(false);
      setNavigationHost(null);
      setContentHost(null);
      return;
    }

    const navigation = document.querySelector<HTMLElement>(
      '.studio-menu-navigation',
    );
    const content = document.querySelector<HTMLElement>(
      '.studio-menu-content',
    );

    setNavigationHost(navigation);
    setContentHost(content);
  }, [open]);

  useEffect(() => {
    if (!navigationHost) return;

    const closePortalOnOtherNavigation = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>(
        '.studio-menu-nav-button',
      );

      if (!button) return;
      if (button.dataset.helpNavigation !== 'true') setHelpOpen(false);
      if (button.dataset.integrationsNavigation !== 'true') setIntegrationsOpen(false);
    };

    navigationHost.addEventListener('click', closePortalOnOtherNavigation);
    return () => {
      navigationHost.removeEventListener('click', closePortalOnOtherNavigation);
    };
  }, [navigationHost]);

  useEffect(() => {
    if (!contentHost) return;

    if (helpOpen || integrationsOpen) {
      contentHost.classList.add('studio-menu-content--help-open');
    } else {
      contentHost.classList.remove('studio-menu-content--help-open');
    }

    return () => {
      contentHost.classList.remove('studio-menu-content--help-open');
    };
  }, [contentHost, helpOpen, integrationsOpen]);

  return (
    <>
      <StudioMenu open={open} onClose={onClose} ojsAssignment={ojsAssignment} />

      {navigationHost
        ? createPortal(
            <>
              <button
                type="button"
                data-integrations-navigation="true"
                className={`studio-menu-nav-button${
                  integrationsOpen ? ' studio-menu-nav-button--active' : ''
                }`}
                aria-current={integrationsOpen ? 'page' : undefined}
                onClick={() => {
                  setHelpOpen(false);
                  setIntegrationsOpen(true);
                }}
              >
                <Plug size={18} aria-hidden="true" />
                <span>{integrationsLabel}</span>
              </button>

              <button
                type="button"
                data-help-navigation="true"
                className={`studio-menu-nav-button${
                  helpOpen ? ' studio-menu-nav-button--active' : ''
                }`}
                aria-current={helpOpen ? 'page' : undefined}
                onClick={() => {
                  setIntegrationsOpen(false);
                  setHelpOpen(true);
                }}
              >
                <CircleHelp size={18} aria-hidden="true" />
                <span>{copy.navigation}</span>
              </button>
            </>,
            navigationHost,
          )
        : null}

      {contentHost && integrationsOpen
        ? createPortal(
            <div className="studio-help-portal studio-integrations-portal">
              <IntegrationsPanel />
            </div>,
            contentHost,
          )
        : null}

      {contentHost && helpOpen
        ? createPortal(
            <div className="studio-help-portal">
              <HelpPanel />
            </div>,
            contentHost,
          )
        : null}
    </>
  );
}

function getIntegrationsLabel(locale: string): string {
  const labels: Record<string, string> = {
    bg: 'Интеграции',
    cs: 'Integrace',
    da: 'Integrationer',
    de: 'Integrationen',
    el: 'Ενσωματώσεις',
    en: 'Integrations',
    es: 'Integraciones',
    et: 'Integratsioonid',
    fi: 'Integraatiot',
    fr: 'Intégrations',
    ga: 'Comhtháthuithe',
    hr: 'Integracije',
    hu: 'Integrációk',
    it: 'Integrazioni',
    lt: 'Integracijos',
    lv: 'Integrācijas',
    mt: 'Integrazzjonijiet',
    nl: 'Integraties',
    pl: 'Integracje',
    pt: 'Integrações',
    ro: 'Integrări',
    sk: 'Integrácie',
    sl: 'Integracije',
    sv: 'Integrationer',
  };
  return labels[locale] ?? labels.en;
}
