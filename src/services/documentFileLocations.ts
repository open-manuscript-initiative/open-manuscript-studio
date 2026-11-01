/** Runtime opaque platform locations. Never serialized into OMI or recovery. */
export class DocumentFileLocations {
  private locations = new Map<string, string>();
  get(manuscriptId: string): string | null { return this.locations.get(manuscriptId) ?? null; }
  set(manuscriptId: string, location: string | null): void {
    if (location === null) this.locations.delete(manuscriptId);
    else this.locations.set(manuscriptId, location);
  }
  clear(): void { this.locations.clear(); }
}
