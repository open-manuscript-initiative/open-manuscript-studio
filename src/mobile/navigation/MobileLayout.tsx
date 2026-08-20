import type { ReactNode } from 'react';
import {
  FileText,
  Menu,
  Pencil,
  SlidersHorizontal,
  User,
} from 'lucide-react';

import '../styles/mobile.css';

interface MobileLayoutProps {
  children: ReactNode;
  onOpenMenu: () => void;
}

export function MobileLayout({
  children,
  onOpenMenu,
}: MobileLayoutProps) {
  return (
    <div className="mobile-shell">
      <header className="mobile-header">
        <button
          type="button"
          className="mobile-icon-button"
          onClick={onOpenMenu}
          aria-label="Open Studio menu"
        >
          <Menu size={22} aria-hidden="true" />
        </button>
        <div className="mobile-header-title">Open Manuscript Studio</div>
        <div className="mobile-header-spacer" aria-hidden="true" />
      </header>

      <main className="mobile-workspace">
        {children}
      </main>

      <nav className="mobile-bottom-nav" aria-label="Mobile Studio navigation">
        <button type="button" className="mobile-nav-item" disabled>
          <FileText size={20} aria-hidden="true" />
          <span>Document</span>
        </button>
        <button
          type="button"
          className="mobile-nav-item mobile-nav-item--active"
          aria-current="page"
        >
          <Pencil size={20} aria-hidden="true" />
          <span>Editor</span>
        </button>
        <button type="button" className="mobile-nav-item" disabled>
          <SlidersHorizontal size={20} aria-hidden="true" />
          <span>Details</span>
        </button>
        <button type="button" className="mobile-nav-item" disabled>
          <User size={20} aria-hidden="true" />
          <span>Account</span>
        </button>
      </nav>
    </div>
  );
}
