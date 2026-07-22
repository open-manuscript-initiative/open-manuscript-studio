import type { ReactNode } from 'react';

import { Header } from './Header';
import { Footer } from './Footer';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({
  children,
}: AppLayoutProps) {
  return (
    <div className="app-layout">
      <Header />

      <main className="app-layout-main">
        {children}
      </main>

      <Footer />
    </div>
  );
}
