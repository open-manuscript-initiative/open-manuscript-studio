import { useEffect, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { getAssetPayload } from '../services/assetRepository';
import type { OmiImageBlockData } from '../types/omi';

export function AssetBackedImage({
  visual,
}: {
  visual: OmiImageBlockData;
}) {
  const manuscriptId = useStudioStore((state) => state.manuscript.id);
  const [resolvedSrc, setResolvedSrc] = useState(visual.src);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | undefined;
    setResolvedSrc(visual.src);

    if (!visual.assetId) return () => undefined;

    void getAssetPayload(manuscriptId, visual.assetId)
      .then((bytes) => {
        if (!bytes || disposed) return;
        const blobBytes = new Uint8Array(bytes.byteLength);
        blobBytes.set(bytes);
        objectUrl = URL.createObjectURL(
          new Blob([blobBytes.buffer], {
            type: visual.mediaType || 'application/octet-stream',
          }),
        );
        if (!disposed) setResolvedSrc(objectUrl);
      })
      .catch(() => {
        // Keep the authoring fallback if the local repository is unavailable.
      });

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [manuscriptId, visual.assetId, visual.mediaType, visual.src]);

  return resolvedSrc ? (
    <img src={resolvedSrc} alt={visual.alt} />
  ) : (
    <div
      className="omi-image-asset-placeholder"
      role="img"
      aria-label={visual.alt || visual.fileName || 'Image asset'}
    />
  );
}
