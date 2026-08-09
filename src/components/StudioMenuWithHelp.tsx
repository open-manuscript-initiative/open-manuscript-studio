import { CircleHelp } from 'lucide-react';
import {
  useEffect,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { useTranslation } from '../i18n';
import { getHelpCopy } from '../i18n/help';
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

  useEffect(() => {
    if (!open) {
      setHelpOpen(false);
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
    </>
  );
}
