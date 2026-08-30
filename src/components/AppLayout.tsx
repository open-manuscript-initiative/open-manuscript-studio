import type { ReactNode } from 'react';
import { CrossSectionClipboardController } from './CrossSectionClipboardController';
import { Footer } from './Footer';
import { Header } from './Header';

interface AppLayoutProps {
  children: ReactNode;
  onOpenMenu: () => void;
}

export function AppLayout({ children, onOpenMenu }: AppLayoutProps) {
  return (
    <div className="app-layout">
      <CrossSectionClipboardController />
      <Header onOpenMenu={onOpenMenu} />
      <main className="app-layout-main">{children}</main>
      <Footer />
    </div>
  );
}
