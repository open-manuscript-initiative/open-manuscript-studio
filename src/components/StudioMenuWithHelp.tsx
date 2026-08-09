import { CircleHelp } from 'lucide-react';
import {
  useEffect,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { useTranslation } from '../i18n';
import { getHelpCopy } from '../i18n/help';
import { ExportFormatsPanel } from './ExportFormatsPanel';
import { HelpPanel } from './HelpPanel';
import { StudioMenu } from './StudioMenu';
import './StudioMenuWithHelp.css';

interface StudioMenuWithHelpProps {
  open: boolean;
  onClose: () => void;
}

export function StudioMenuWithHelp({
  open,
  onClose,
}: StudioMenuWithHelpProps) {
  const { locale } = useTranslation();
  const copy = getHelpCopy(locale);
  const [helpOpen, setHelpOpen] = useState(false);
  const [navigationHost, setNavigationHost] = useState<HTMLElement | null>(null);
  const [contentHost, setContentHost] = useState<HTMLElement | null>(null);
  const [exportHost, setExportHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      setHelpOpen(false);
      setNavigationHost(null);
      setContentHost(null);
      setExportHost(null);
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

    const closeHelpOnOtherNavigation = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>(
        '.studio-menu-nav-button',
      );

      if (button && button.dataset.helpNavigation !== 'true') {
        setHelpOpen(false);
      }
    };

    navigationHost.addEventListener('click', closeHelpOnOtherNavigation);
    return () => {
      navigationHost.removeEventListener('click', closeHelpOnOtherNavigation);
    };
  }, [navigationHost]);

  useEffect(() => {
    if (!contentHost) return;

    const syncExportHost = () => {
      const toolView = Array.from(
        contentHost.querySelectorAll<HTMLElement>('.studio-menu-view'),
      ).find((view) => Boolean(view.querySelector('.studio-json-view')));

      if (!toolView) {
        setExportHost(null);
        return;
      }

      const existing = toolView.querySelector<HTMLElement>(
        ':scope > .studio-export-portal-host',
      );
      if (existing) {
        setExportHost(existing);
        return;
      }

      const firstLegacyExportCard = toolView.querySelector<HTMLElement>(
        ':scope > .studio-tool-card',
      );
      const host = document.createElement('div');
      host.className = 'studio-export-portal-host';
      if (firstLegacyExportCard) {
        firstLegacyExportCard.classList.add('studio-legacy-export-card');
        toolView.insertBefore(host, firstLegacyExportCard);
      } else {
        toolView.appendChild(host);
      }
      setExportHost(host);
    };

    syncExportHost();
    const observer = new MutationObserver(syncExportHost);
    observer.observe(contentHost, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      setExportHost(null);
    };
  }, [contentHost]);

  useEffect(() => {
    if (!contentHost) return;

    if (helpOpen) {
      contentHost.classList.add('studio-menu-content--help-open');
    } else {
      contentHost.classList.remove('studio-menu-content--help-open');
    }

    return () => {
      contentHost.classList.remove('studio-menu-content--help-open');
    };
  }, [contentHost, helpOpen]);

  return (
    <>
      <StudioMenu open={open} onClose={onClose} />

      {navigationHost
        ? createPortal(
            <button
              type="button"
              data-help-navigation="true"
              className={`studio-menu-nav-button${
                helpOpen ? ' studio-menu-nav-button--active' : ''
              }`}
              aria-current={helpOpen ? 'page' : undefined}
              onClick={() => setHelpOpen(true)}
            >
              <CircleHelp size={18} aria-hidden="true" />
              <span>{copy.navigation}</span>
            </button>,
            navigationHost,
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

      {exportHost ? createPortal(<ExportFormatsPanel />, exportHost) : null}
    </>
  );
}
