const MAX_RECENT_LOCAL_CONTENT = 16;

/**
 * Tracks a small set of locally emitted editor snapshots so delayed React
 * renders cannot feed an older local snapshot back into the active editor.
 */
export class RecentLocalEditorContentHistory {
  private fingerprints: string[] = [];

  record(content: string): void {
    const fingerprint = fingerprintContent(content);
    this.fingerprints = [
      ...this.fingerprints.filter((value) => value !== fingerprint),
      fingerprint,
    ].slice(-MAX_RECENT_LOCAL_CONTENT);
  }

  has(content: string): boolean {
    return this.fingerprints.includes(fingerprintContent(content));
  }

  acknowledge(content: string): void {
    const fingerprint = fingerprintContent(content);
    if (this.fingerprints.at(-1) === fingerprint) {
      this.fingerprints = [fingerprint];
    }
  }

  clear(): void {
    this.fingerprints = [];
  }
}

function fingerprintContent(content: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;

  for (let index = 0; index < content.length; index += 1) {
    const unit = content.charCodeAt(index);
    first = Math.imul(first ^ unit, 0x01000193);
    second = Math.imul(second ^ unit, 0x85ebca6b);
  }

  return `${content.length}:${first >>> 0}:${second >>> 0}`;
}
