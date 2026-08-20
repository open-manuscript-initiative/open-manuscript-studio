import { CheckCircle2, Clock3, LogOut, Menu, Search, UserRound } from 'lucide-react';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { useAuthStore } from '../store/authStore';
import { HeaderInsertMenu } from './HeaderInsertMenu';
import { LanguageSwitcher } from './LanguageSwitcher';
interface HeaderProps { onOpenMenu:()=>void; onOpenAccount:()=>void; accountActive?:boolean; }
const searchLabels:Record<string,string>={bg:'Търсене',cs:'Hledat',da:'Søg',de:'Suchen',el:'Αναζήτηση',en:'Search',es:'Buscar',et:'Otsi',fi:'Haku',fr:'Rechercher',ga:'Cuardaigh',hr:'Pretraži',hu:'Keresés',it:'Cerca',lt:'Ieškoti',lv:'Meklēt',mt:'Fittex',nl:'Zoeken',pl:'Szukaj',pt:'Pesquisar',ro:'Căutare',sk:'Hľadať',sl:'Iskanje',sv:'Sök'};
const accountLabels:Record<string,string>={en:'Account',hu:'Fiók',de:'Konto'};
export function Header({onOpenMenu,onOpenAccount,accountActive=false}:HeaderProps){
 const {t,locale}=useTranslation(); const manuscript=useStudioStore(s=>s.manuscript); const pendingChangeSet=useStudioStore(s=>s.pendingChangeSet); const selectedSectionId=useStudioStore(s=>s.selectedSectionId); const logout=useAuthStore(s=>s.logout); const isAuthLoading=useAuthStore(s=>s.isLoading); const selectedSection=manuscript.sections.find(s=>s.id===selectedSectionId); const searchLabel=searchLabels[locale]??searchLabels.en; const accountLabel=accountLabels[locale]??accountLabels.en;
 const handleLogout=()=>{void logout().catch(()=>{});}; const handleSearch=()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'f',ctrlKey:true,bubbles:true}));
 return <header className="app-header focus-header"><div className="focus-header-identity">
  <button type="button" className="focus-menu-button" aria-label={t('studio.menu')} title={t('studio.menu')} onClick={onOpenMenu}><Menu size={19}/></button>
  <button type="button" className="focus-menu-button focus-search-button" aria-label={searchLabel} title={`${searchLabel} (Ctrl+F)`} onClick={handleSearch}><Search size={18}/></button>
  <div className="focus-brand-lockup" aria-label="Open Manuscript Studio"><img className="focus-brand-mark" src="/studio-icon.svg" width="34" height="34" alt=""/><span className="focus-brand-copy"><span className="focus-brand-initiative">Open Manuscript Initiative</span><strong>Studio</strong></span></div>
 </div>
 <div className="focus-header-context" title={selectedSection?.title??manuscript.title}><span className="focus-header-context-label">{accountActive?accountLabel:'Manuscript'}</span><span className="focus-header-manuscript-title">{accountActive?accountLabel:manuscript.title}</span>{!accountActive&&selectedSection?.title&&selectedSection.title!==manuscript.title?<><span className="focus-header-context-divider">/</span><span className="focus-header-section">{selectedSection.title}</span></>:null}</div>
 <div className="focus-header-primary-action">{accountActive?null:<HeaderInsertMenu/>}</div>
 <div className="focus-header-actions"><div className={`focus-save-state${pendingChangeSet?' focus-save-state--pending':''}`} role="status">{pendingChangeSet?<Clock3 size={15}/>:<CheckCircle2 size={15}/>}<span>{pendingChangeSet?t('studio.pending'):t('studio.saved')}</span></div><LanguageSwitcher/>
 <button type="button" className={`focus-menu-button${accountActive?' focus-account-button--active':''}`} aria-label={accountLabel} title={accountLabel} onClick={onOpenAccount}><UserRound size={18}/><span className="focus-logout-label">{accountLabel}</span></button>
 <button type="button" className="focus-menu-button focus-logout-button" aria-label={t('auth.logout')} title={t('auth.logout')} onClick={handleLogout} disabled={isAuthLoading}><LogOut size={18}/><span className="focus-logout-label">{t('auth.logout')}</span></button></div></header>;
}
