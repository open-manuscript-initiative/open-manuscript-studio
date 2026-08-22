import { ListTree, X } from 'lucide-react';
import { useEffect, useMemo, type CSSProperties } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { formatHierarchicalSectionHeading } from '../model/sectionNumbering';
import { buildSectionOutline } from '../model/sectionStructure';
import '../styles/desktop-document-outline.css';

interface DesktopDocumentOutlineProps {
  onClose: () => void;
}

const copy: Record<string, { title: string; close: string; empty: string; document: string }> = {
  en: {
    title: 'Document outline',
    close: 'Hide document outline',
    empty: 'Untitled section',
    document: 'Document',
  },
  hu: {
    title: 'Dokumentumszerkezet',
    close: 'Dokumentumszerkezet elrejtése',
    empty: 'Névtelen címsor',
    document: 'Dokumentum',
  },
  de: {
    title: 'Dokumentstruktur',
    close: 'Dokumentstruktur ausblenden',
    empty: 'Unbenannter Abschnitt',
    document: 'Dokument',
  },
};

export function DesktopDocumentOutline({ onClose }: DesktopDocumentOutlineProps) {
  const { locale } = useTranslation();
  const labels = copy[locale] ?? copy.en;
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectedSectionId = useStudioStore((state) => state.selectedSectionId);
  const selectSection = useStudioStore((state) => state.selectSection);
  const outline = useMemo(
    () => buildSectionOutline(manuscript.sections),
    [manuscript.sections],
  );

  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('.omi-continuous-section[data-section-id]'),
    );
    if (!sections.length || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) =>
              Math.abs(left.boundingClientRect.top - 120) -
              Math.abs(right.boundingClientRect.top - 120),
          )[0];
        const sectionId = (visible?.target as HTMLElement | undefined)?.dataset.sectionId;
        if (sectionId && sectionId !== selectedSectionId) selectSection(sectionId);
      },
      {
        root: null,
        rootMargin: '-12% 0px -72% 0px',
        threshold: [0, 0.1, 0.5],
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [manuscript.sections, selectSection, selectedSectionId]);

  const navigateToSection = (sectionId: string) => {
    selectSection(sectionId);
    requestAnimationFrame(() => {
      const section = Array.from(
        document.querySelectorAll<HTMLElement>('.omi-continuous-section[data-section-id]'),
      ).find((element) => element.dataset.sectionId === sectionId);
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const navigateToDocument = () => {
    document.getElementById('manuscript-title')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  };

  return (
    <aside className="desktop-document-outline" aria-label={labels.title}>
      <header className="desktop-document-outline-header">
        <span className="desktop-document-outline-title">
          <ListTree size={17} aria-hidden="true" />
          {labels.title}
        </span>
        <button
          type="button"
          className="desktop-document-outline-close"
          onClick={onClose}
          aria-label={labels.close}
          title={labels.close}
        >
          <X size={17} aria-hidden="true" />
        </button>
      </header>

      <nav className="desktop-document-outline-list" aria-label={labels.title}>
        <button
          type="button"
          className="desktop-document-outline-root"
          onClick={navigateToDocument}
          title={manuscript.title || labels.document}
        >
          {manuscript.title || labels.document}
        </button>

        {outline.map(({ section, depth }) => {
          const heading = formatHierarchicalSectionHeading(
            section.title || labels.empty,
            manuscript.sections,
            section.id,
            manuscript.sectionNumberingStyle,
          );
          const active = section.id === selectedSectionId;
          const itemStyle = {
            '--desktop-outline-depth': depth,
          } as CSSProperties;

          return (
            <button
              type="button"
              key={section.id}
              className={`desktop-document-outline-item${
                active ? ' desktop-document-outline-item--active' : ''
              }`}
              style={itemStyle}
              aria-current={active ? 'location' : undefined}
              onClick={() => navigateToSection(section.id)}
              title={heading}
            >
              <span>{heading}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
