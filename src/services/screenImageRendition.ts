/**
 * Screen-only raster rendition used by the publication presentation.
 * Keeps OMI assets untouched: printing and high-resolution export use their
 * original bytes, never the device-sized preview.
 */
export interface RasterSize { width: number; height: number }

function imageSize(bytes: Uint8Array): RasterSize | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = bytes.length;
  // PNG IHDR: width and height are stored big-endian.
  if (len >= 24 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
    && bytes[12] === 73 && bytes[13] === 72 && bytes[14] === 68 && bytes[15] === 82) {
    const width = view.getUint32(16), height = view.getUint32(20);
    return width && height ? { width, height } : undefined;
  }

  // JPEG: find a start-of-frame segment instead of decoding the entire file.
  if (len >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let offset = 2; offset + 9 < len;) {
      if (bytes[offset] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > len) break;
      const segmentLength = view.getUint16(offset);
      if (segmentLength < 2 || offset + segmentLength > len) break;
      if (new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]).has(marker)
        && segmentLength >= 7) {
        const height = view.getUint16(offset + 3), width = view.getUint16(offset + 5);
        return width && height ? { width, height } : undefined;
      }
      offset += segmentLength;
    }
  }

  // WebP VP8X / VP8L / VP8 size headers.
  if (len >= 30 && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP') {
    const kind = String.fromCharCode(...bytes.subarray(12, 16));
    if (kind === 'VP8X') {
      return { width: 1 + bytes[24]! + (bytes[25]! << 8) + (bytes[26]! << 16),
        height: 1 + bytes[27]! + (bytes[28]! << 8) + (bytes[29]! << 16) };
    }
    if (kind === 'VP8L' && len >= 25 && bytes[20] === 0x2f) {
      return { width: 1 + bytes[21]! + ((bytes[22]! & 0x3f) << 8),
        height: 1 + (bytes[22]! >> 6) + (bytes[23]! << 2) + ((bytes[24]! & 0x0f) << 10) };
    }
    if (kind === 'VP8 ' && len >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    }
  }
  return undefined;
}

export function screenImageBudget(viewportWidth: number, viewportHeight: number, pixelRatio: number): number {
  const cssEdge = Math.max(320, viewportWidth || 0, viewportHeight || 0);
  const density = Math.max(1, Math.min(2, pixelRatio || 1));
  return Math.max(640, Math.min(4096, Math.ceil(cssEdge * density)));
}

export function screenRenditionSize(source: RasterSize, maxEdge: number): RasterSize {
  if (source.width <= 0 || source.height <= 0 || !Number.isFinite(source.width + source.height)) return source;
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height),
    Math.sqrt(8_500_000 / (source.width * source.height)));
  return { width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)) };
}

export async function screenImageRendition(
  bytes: Uint8Array,
  mediaType: string,
  maxEdge: number,
  fallbackDimensions?: RasterSize,
): Promise<{ blob: Blob; originalDimensions?: RasterSize }> {
  const blob = new Blob([Uint8Array.from(bytes)], { type: mediaType });
  const originalDimensions = imageSize(bytes) ?? fallbackDimensions;
  // Never rasterize SVG: vector artwork is already resolved at display size
  // by the browser. Unsupported / unknown formats retain their exact bytes.
  if (!originalDimensions || !/image\/(png|jpeg|webp)/i.test(mediaType)
    || typeof createImageBitmap !== 'function') return { blob, originalDimensions };
  const target = screenRenditionSize(originalDimensions, maxEdge);
  if (target.width === originalDimensions.width && target.height === originalDimensions.height)
    return { blob, originalDimensions };

  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(blob, { resizeWidth: target.width, resizeHeight: target.height, resizeQuality: 'medium' });
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return { blob, originalDimensions };
    context.drawImage(bitmap, 0, 0, target.width, target.height);
    const screenBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
    return { blob: screenBlob || blob, originalDimensions };
  } catch {
    return { blob, originalDimensions };
  } finally {
    bitmap?.close();
  }
}
