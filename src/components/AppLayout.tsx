import type { ReactNode } from 'react';
import { CrossSectionClipboardController } from './CrossSectionClipboardController';
import { Footer } from './Footer';
import { Header } from './Header';

interface AppLayoutProps {
  children: ReactNode;
  onOpenMenu: () => void;
  onHome: () => void;
}

export function AppLayout({ children, onOpenMenu, onHome }: AppLayoutProps) {
  return (
    <div className="app-layout">
      <CrossSectionClipboardController />
      <Header onOpenMenu={onOpenMenu} onHome={onHome} />
      <main className="app-layout-main">{children}</main>
      <Footer />
    </div>
  );
}
