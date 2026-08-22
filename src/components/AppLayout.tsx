import type { ReactNode } from 'react';

import { Footer } from './Footer';
import { Header } from './Header';

interface AppLayoutProps {
  children: ReactNode;
  onOpenMenu: () => void;
  outlineOpen: boolean;
  onToggleOutline: () => void;
}

export function AppLayout({
  children,
  onOpenMenu,
  outlineOpen,
  onToggleOutline,
}: AppLayoutProps) {
  return (
    <div className="app-layout">
      <Header
        onOpenMenu={onOpenMenu}
        outlineOpen={outlineOpen}
        onToggleOutline={onToggleOutline}
      />
      <main className="app-layout-main">{children}</main>
      <Footer />
    </div>
  );
}
