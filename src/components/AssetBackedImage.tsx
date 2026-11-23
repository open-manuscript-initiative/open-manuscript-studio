import { useEffect, useRef, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { getAssetPayload } from '../services/assetRepository';
import { screenImageBudget, screenImageRendition, type RasterSize } from '../services/screenImageRendition';
import type { OmiImageBlockData } from '../types/omi';

export function AssetBackedImage({
  visual, onDimensions, lightweight = false, screenResolution = false,
}: {
  visual: OmiImageBlockData;
  onDimensions?: (width: number, height: number) => void;
  lightweight?: boolean;
  screenResolution?: boolean;
}) {
  const manuscriptId = useStudioStore((state) => state.manuscript.id);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  // Deferred loading must include image decoding/raster resampling, not merely
  // the <img> request after an expensive preview blob has already been built.
  useEffect(() => {
    if (!screenResolution || nearViewport) return;
    const target = placeholderRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNearViewport(true);
        observer.disconnect();
      }
    }, { rootMargin: '600px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [screenResolution, nearViewport]);
  const deferScreenImage = screenResolution && !nearViewport;
  // Do not briefly mount the original full-resolution image on entering
  // presentation mode: wait for the device-sized rendition instead.
  const [resolvedSrc, setResolvedSrc] = useState(screenResolution ? '' : visual.src);
  const sourceDimensions = useRef<RasterSize | undefined>(undefined);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | undefined;
    sourceDimensions.current = undefined;
    setResolvedSrc(screenResolution ? '' : visual.src);
    if (deferScreenImage) return () => undefined;

    if (!visual.assetId) return () => undefined;

    void getAssetPayload(manuscriptId, visual.assetId)
      .then(async (bytes) => {
        if (!bytes || disposed) {
          if (!bytes && !disposed) setResolvedSrc(visual.src);
          return;
        }
        const result = screenResolution
          ? await screenImageRendition(
              bytes, visual.mediaType || 'application/octet-stream',
              screenImageBudget(window.innerWidth, window.innerHeight, window.devicePixelRatio),
              Number.isFinite(visual.width) && Number.isFinite(visual.height)
                && (visual.width ?? 0) > 0 && (visual.height ?? 0) > 0
                ? { width: visual.width!, height: visual.height! }
                : undefined,
            )
          : { blob: new Blob([Uint8Array.from(bytes)], { type: visual.mediaType || 'application/octet-stream' }),
              originalDimensions: undefined };
        if (disposed) return;
        sourceDimensions.current = result.originalDimensions;
        objectUrl = URL.createObjectURL(result.blob);
        setResolvedSrc(objectUrl);
      })
      .catch(() => {
        // A missing cache must not make a scholarly image disappear.
        if (!disposed) setResolvedSrc(visual.src);
      });

    return () => {
      disposed = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [manuscriptId, visual.assetId, visual.mediaType, visual.src, visual.width, visual.height, screenResolution, deferScreenImage]);

  return !deferScreenImage && resolvedSrc ? (
    <img
      src={resolvedSrc}
      alt={visual.alt}
      loading={lightweight || screenResolution ? 'lazy' : undefined}
      decoding={lightweight || screenResolution ? 'async' : undefined}
      onLoad={(event) => {
        // Image annotations use the original asset's pixel coordinate system,
        // not that of a resized presentation-only rendition.
        const source = sourceDimensions.current;
        onDimensions?.(source?.width ?? event.currentTarget.naturalWidth,
          source?.height ?? event.currentTarget.naturalHeight);
      }}
    />
  ) : (
    <div
      ref={placeholderRef}
      className="omi-image-asset-placeholder"
      style={screenResolution && visual.width && visual.height
        ? { aspectRatio: `${visual.width} / ${visual.height}` }
        : undefined}
      role="img"
      aria-label={visual.alt || visual.fileName || 'Image asset'}
    />
  );
}
