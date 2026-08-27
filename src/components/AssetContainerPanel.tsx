import { lazy, Suspense, useState, type SyntheticEvent } from 'react';

import { useTranslation } from '../i18n';
import { getAssetContainerCopy } from '../i18n/assetContainer';

const LazyAssetContainerPanelContent = lazy(async () => {
  const module = await import('./AssetContainerPanelContent');
  return { default: module.AssetContainerPanelContent };
});

export function AssetContainerPanel() {
  const { locale } = useTranslation();
  const copy = getAssetContainerCopy(locale);
  const [open, setOpen] = useState(false);

  function handleToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    setOpen(event.currentTarget.open);
  }

  return (
    <details className="studio-technical-details" onToggle={handleToggle}>
      <summary>{copy.title}</summary>
      <p>{copy.description}</p>
      {open ? (
        <Suspense fallback={<p className="studio-settings-hint">{copy.preparing}</p>}>
          <LazyAssetContainerPanelContent />
        </Suspense>
      ) : null}
    </details>
  );
}
