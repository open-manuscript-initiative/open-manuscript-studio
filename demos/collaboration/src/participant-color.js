function hslToHex(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = hue / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  const offset = lightness - chroma / 2;
  const rgb = section < 1 ? [chroma, secondary, 0]
    : section < 2 ? [secondary, chroma, 0]
      : section < 3 ? [0, chroma, secondary]
        : section < 4 ? [0, secondary, chroma]
          : section < 5 ? [secondary, 0, chroma]
            : [chroma, 0, secondary];

  return `#${rgb.map((channel) => Math.round((channel + offset) * 255).toString(16).padStart(2, '0')).join('')}`;
}

export function participantColor(seed) {
  let hash = 2166136261;
  for (const character of String(seed || 'participant')) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hslToHex((hash >>> 0) % 360, 0.74, 0.36);
}
