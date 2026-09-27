import { RotateCcw } from 'lucide-react';
import { useState } from 'react';

import { useTranslation } from '../i18n';
import {
  DEFAULT_INTERFACE_FONT_SCALE,
  DEFAULT_MENU_FONT_SCALE,
  INTERFACE_FONT_SCALE_MAX,
  INTERFACE_FONT_SCALE_MIN,
  INTERFACE_FONT_SCALE_STEP,
  MENU_FONT_SCALE_MAX,
  MENU_FONT_SCALE_MIN,
  MENU_FONT_SCALE_STEP,
  loadInterfaceFontScale,
  loadMenuFontScale,
  saveInterfaceFontScale,
  saveMenuFontScale,
} from '../services/menuAppearancePreferences';

interface FontScaleControlProps {
  id: string;
  label: string;
  description: string;
  smaller: string;
  larger: string;
  reset: string;
  preview: string;
  scale: number;
  minimum: number;
  maximum: number;
  step: number;
  defaultScale: number;
  previewClassName: string;
  onChange: (value: number) => void;
}

function FontScaleControl({
  id,
  label,
  description,
  smaller,
  larger,
  reset,
  preview,
  scale,
  minimum,
  maximum,
  step,
  defaultScale,
  previewClassName,
  onChange,
}: FontScaleControlProps) {
  return (
    <section className="studio-appearance-scale-row" aria-labelledby={`${id}-title`}>
      <div className="studio-appearance-scale-copy">
        <strong id={`${id}-title`}>{label}</strong>
        <small>{description}</small>
      </div>

      <div className="studio-menu-font-control">
        <span className="studio-menu-font-boundary">{smaller}</span>
        <label htmlFor={id} className="studio-menu-font-slider">
          <span className="sr-only">{label}</span>
          <input
            id={id}
            type="range"
            min={minimum}
            max={maximum}
            step={step}
            value={scale}
            aria-label={label}
            aria-valuetext={`${scale}%`}
            onChange={(event) => onChange(Number(event.target.value))}
          />
        </label>
        <span className="studio-menu-font-boundary">{larger}</span>
        <output htmlFor={id} className="studio-menu-font-value">
          {scale}%
        </output>
        <button
          type="button"
          className="studio-menu-secondary-action studio-menu-font-reset"
          disabled={scale === defaultScale}
          onClick={() => onChange(defaultScale)}
        >
          <RotateCcw size={14} aria-hidden="true" />
          {reset}
        </button>
      </div>

      <p className={previewClassName}>{preview}</p>
    </section>
  );
}

export function MenuAppearanceSettings() {
  const { locale } = useTranslation();
  const [menuScale, setMenuScale] = useState(() => loadMenuFontScale());
  const [interfaceScale, setInterfaceScale] = useState(() => loadInterfaceFontScale());

  const copy = locale === 'hu'
    ? {
        title: 'Felület és menü betűmérete',
        description:
          'A menü és a teljes kezelőfelület betűmérete külön állítható ezen az eszközön. A kézirat és a kiadvány tényleges szövegméretét ezek a beállítások nem módosítják.',
        menuLabel: 'Menü betűmérete',
        menuDescription:
          'A kéziratmenü navigációs feliratainak és a menügombok keretének mérete.',
        interfaceLabel: 'Felületi szövegméret',
        interfaceDescription:
          'Címek, mezőfeliratok, magyarázószövegek, gombok és beviteli mezők mérete a Stúdió minden részén, az élő kiadványszerkesztő kezelőszerveit is beleértve.',
        smaller: 'Kisebb',
        larger: 'Nagyobb',
        reset: 'Alapméret',
        menuPreview: 'Menü: Kéziratadatok · Közreműködők · Beállítások',
        interfacePreview: 'Felület: mezőfelirat · magyarázószöveg · műveleti gomb',
      }
    : locale === 'de'
      ? {
          title: 'Oberflächen- und Menüschriftgröße',
          description:
            'Menü und Benutzeroberfläche können auf diesem Gerät getrennt skaliert werden. Manuskript- und Publikationstext bleiben unverändert.',
          menuLabel: 'Menüschriftgröße',
          menuDescription:
            'Größe der Navigationsbeschriftungen und ihrer Menüschaltflächen.',
          interfaceLabel: 'Oberflächenschriftgröße',
          interfaceDescription:
            'Überschriften, Feldbezeichnungen, Hilfetexte, Schaltflächen und Eingabefelder in der gesamten Studio-Oberfläche einschließlich der Bedienelemente des Live-Publikationseditors.',
          smaller: 'Kleiner',
          larger: 'Größer',
          reset: 'Standardgröße',
          menuPreview: 'Menü: Manuskriptdaten · Mitwirkende · Einstellungen',
          interfacePreview: 'Oberfläche: Feldbezeichnung · Hilfetext · Aktionsschaltfläche',
        }
      : {
          title: 'Interface and menu font size',
          description:
            'Menu and interface typography can be scaled independently on this device. Manuscript and publication content typography stays unchanged.',
          menuLabel: 'Menu font size',
          menuDescription:
            'Size of manuscript-menu navigation labels and their button frames.',
          interfaceLabel: 'Interface text size',
          interfaceDescription:
            'Headings, field labels, explanatory text, buttons and form controls throughout Studio, including the live publication editor controls.',
          smaller: 'Smaller',
          larger: 'Larger',
          reset: 'Default size',
          menuPreview: 'Menu: Manuscript data · Contributors · Settings',
          interfacePreview: 'Interface: field label · explanatory text · action button',
        };

  function updateMenuScale(value: number): void {
    setMenuScale(saveMenuFontScale(value));
  }

  function updateInterfaceScale(value: number): void {
    setInterfaceScale(saveInterfaceFontScale(value));
  }

  return (
    <section className="studio-settings-card studio-menu-appearance-settings">
      <div className="studio-settings-card-header">
        <div>
          <h4>{copy.title}</h4>
          <p>{copy.description}</p>
        </div>
      </div>

      <div className="studio-appearance-scale-list">
        <FontScaleControl
          id="studio-menu-font-size"
          label={copy.menuLabel}
          description={copy.menuDescription}
          smaller={copy.smaller}
          larger={copy.larger}
          reset={copy.reset}
          preview={copy.menuPreview}
          scale={menuScale}
          minimum={MENU_FONT_SCALE_MIN}
          maximum={MENU_FONT_SCALE_MAX}
          step={MENU_FONT_SCALE_STEP}
          defaultScale={DEFAULT_MENU_FONT_SCALE}
          previewClassName="studio-menu-font-preview"
          onChange={updateMenuScale}
        />

        <FontScaleControl
          id="studio-interface-font-size"
          label={copy.interfaceLabel}
          description={copy.interfaceDescription}
          smaller={copy.smaller}
          larger={copy.larger}
          reset={copy.reset}
          preview={copy.interfacePreview}
          scale={interfaceScale}
          minimum={INTERFACE_FONT_SCALE_MIN}
          maximum={INTERFACE_FONT_SCALE_MAX}
          step={INTERFACE_FONT_SCALE_STEP}
          defaultScale={DEFAULT_INTERFACE_FONT_SCALE}
          previewClassName="studio-interface-font-preview"
          onChange={updateInterfaceScale}
        />
      </div>
    </section>
  );
}
