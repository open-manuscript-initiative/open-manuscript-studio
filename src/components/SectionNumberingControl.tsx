import { Hash } from 'lucide-react';

import { stageSectionNumberingStyleChange } from '../app/sectionActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  SECTION_NUMBERING_STYLES,
  normalizeSectionNumberingStyle,
  sectionNumberingStyleExample,
} from '../model/sectionNumbering';
import type { OmiSectionNumberingStyle } from '../types/omi';

export function SectionNumberingControl() {
  const { t } = useTranslation();
  const style = useStudioStore(
    (state) => state.manuscript.sectionNumberingStyle,
  );
  const normalizedStyle = normalizeSectionNumberingStyle(style);

  return (
    <label className="section-numbering-control">
      <span className="section-numbering-control-label">
        <Hash size={16} aria-hidden="true" />
        {t('studio.document.sections')}
      </span>

      <select
        value={normalizedStyle}
        aria-label={t('studio.document.sections')}
        onChange={(event) =>
          stageSectionNumberingStyleChange(
            event.target.value as OmiSectionNumberingStyle,
          )
        }
      >
        {SECTION_NUMBERING_STYLES.map((candidate) => (
          <option value={candidate} key={candidate}>
            {sectionNumberingStyleExample(candidate)}
          </option>
        ))}
      </select>
    </label>
  );
}
