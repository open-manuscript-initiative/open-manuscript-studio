import type { ReactNode } from 'react';
import { Footer } from './Footer';
import { Header } from './Header';
interface AppLayoutProps { children:ReactNode; onOpenMenu:()=>void; onOpenAccount:()=>void; accountActive?:boolean; }
export function AppLayout({children,onOpenMenu,onOpenAccount,accountActive=false}:AppLayoutProps){return <div className="app-layout"><Header onOpenMenu={onOpenMenu} onOpenAccount={onOpenAccount} accountActive={accountActive}/><main className="app-layout-main">{children}</main><Footer/></div>;}
