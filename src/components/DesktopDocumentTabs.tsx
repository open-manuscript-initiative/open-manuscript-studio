import { FileText, X } from 'lucide-react';

export type DesktopDocumentTabId = ReturnType<Crypto['randomUUID']>;

export interface DesktopDocumentTabItem {
  id: DesktopDocumentTabId;
  manuscriptId: string;
  title: string;
}

interface DesktopDocumentTabsProps {
  tabs: DesktopDocumentTabItem[];
  activeTabId: DesktopDocumentTabId;
  onActivate: (tabId: DesktopDocumentTabId) => void;
  onClose: (tabId: DesktopDocumentTabId) => void;
}

export function DesktopDocumentTabs({
  tabs,
  activeTabId,
  onActivate,
  onClose,
}: DesktopDocumentTabsProps) {
  return (
    <nav className="desktop-document-tabs" aria-label="Open documents">
      <div className="desktop-document-tabs__track" role="tablist">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`desktop-document-tab${active ? ' desktop-document-tab--active' : ''}`}
              role="presentation"
            >
              <button
                type="button"
                className="desktop-document-tab__main"
                role="tab"
                aria-selected={active}
                title={tab.title}
                onClick={() => onActivate(tab.id)}
              >
                <FileText size={15} aria-hidden="true" />
                <span>{tab.title}</span>
              </button>
              <button
                type="button"
                className="desktop-document-tab__close"
                aria-label={`Close ${tab.title}`}
                title="Close"
                disabled={tabs.length === 1}
                onClick={() => onClose(tab.id)}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
