import { RotateCcw } from 'lucide-react';
import { useState } from 'react';

import { useTranslation } from '../i18n';
import {
  DEFAULT_MENU_FONT_SCALE,
  MENU_FONT_SCALE_MAX,
  MENU_FONT_SCALE_MIN,
  MENU_FONT_SCALE_STEP,
  loadMenuFontScale,
  saveMenuFontScale,
} from '../services/menuAppearancePreferences';

export function MenuAppearanceSettings() {
  const { locale } = useTranslation();
  const [scale, setScale] = useState(() => loadMenuFontScale());
  const copy = locale === 'hu'
    ? {
        title: 'Menü betűmérete',
        description:
          'A kéziratmenü feliratainak mérete ezen az eszközön külön beállítható. A változás azonnal megjelenik.',
        label: 'Menü betűmérete',
        smaller: 'Kisebb',
        larger: 'Nagyobb',
        reset: 'Alapméret',
        preview: 'Előnézet: Kéziratadatok · Közreműködők · Beállítások',
      }
    : locale === 'de'
      ? {
          title: 'Menüschriftgröße',
          description:
            'Die Schriftgröße der Manuskriptmenü-Einträge kann auf diesem Gerät angepasst werden. Die Änderung wird sofort angewendet.',
          label: 'Menüschriftgröße',
          smaller: 'Kleiner',
          larger: 'Größer',
          reset: 'Standardgröße',
          preview: 'Vorschau: Manuskriptdaten · Mitwirkende · Einstellungen',
        }
      : {
          title: 'Menu font size',
          description:
            'Adjust the manuscript-menu label size on this device. Changes are applied immediately.',
          label: 'Menu font size',
          smaller: 'Smaller',
          larger: 'Larger',
          reset: 'Default size',
          preview: 'Preview: Manuscript data · Contributors · Settings',
        };

  function update(value: number): void {
    setScale(saveMenuFontScale(value));
  }

  return (
    <section className="studio-settings-card studio-menu-appearance-settings">
      <div className="studio-settings-card-header">
        <div>
          <h4>{copy.title}</h4>
          <p>{copy.description}</p>
        </div>
      </div>

      <div className="studio-menu-font-control">
        <span className="studio-menu-font-boundary">{copy.smaller}</span>
        <label htmlFor="studio-menu-font-size" className="studio-menu-font-slider">
          <span className="sr-only">{copy.label}</span>
          <input
            id="studio-menu-font-size"
            type="range"
            min={MENU_FONT_SCALE_MIN}
            max={MENU_FONT_SCALE_MAX}
            step={MENU_FONT_SCALE_STEP}
            value={scale}
            aria-label={copy.label}
            aria-valuetext={`${scale}%`}
            onChange={(event) => update(Number(event.target.value))}
          />
        </label>
        <span className="studio-menu-font-boundary">{copy.larger}</span>
        <output htmlFor="studio-menu-font-size" className="studio-menu-font-value">
          {scale}%
        </output>
        <button
          type="button"
          className="studio-menu-secondary-action studio-menu-font-reset"
          disabled={scale === DEFAULT_MENU_FONT_SCALE}
          onClick={() => update(DEFAULT_MENU_FONT_SCALE)}
        >
          <RotateCcw size={14} aria-hidden="true" />
          {copy.reset}
        </button>
      </div>

      <p className="studio-menu-font-preview">{copy.preview}</p>
    </section>
  );
}
