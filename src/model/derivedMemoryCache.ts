// A shared estimated budget for optional derived data, never canonical document state.
// Weak keys allow closed documents to be reclaimed; the LRU holds only weak references.
export const MIB = 1024 * 1024;
export type CacheMode = 'economy' | 'balanced' | 'performance';
export function cacheBudgetMiB(ramGiB: number | undefined, mobile: boolean, mode: CacheMode, availableMiB?: number): number {
  const ram = ramGiB && Number.isFinite(ramGiB) && ramGiB > 0 ? ramGiB : undefined;
  const max = ram === undefined ? (mobile ? 32 : 64)
    : ram < 2.75 ? 16 : ram < 3.75 ? 32 : ram < 5.5 ? 64
    : ram < 7.5 ? 128 : ram < 11.5 ? 256 : 512;
  const preferred = mode === 'economy' ? max / 4 : mode === 'balanced' ? max / 2 : max;
  if (availableMiB === undefined || !Number.isFinite(availableMiB)) return preferred;
  if (availableMiB < 256) return 0;
  return Math.min(preferred, Math.floor(availableMiB / 16));
}
type Entry = { id: number; value: unknown };
type Ticket = { key: WeakRef<object>; slot: symbol; bytes: number };
export class DerivedMemoryPool {
  private entries = new WeakMap<object, Map<symbol, Entry>>();
  private tickets = new Map<number, Ticket>();
  private nextId = 0;
  private used = 0;
  private limit = 64 * MIB;
  private hitCount = 0;
  private missCount = 0;
  get hits(): number { return this.hitCount; }
  get misses(): number { return this.missCount; }
  get estimatedBytes(): number { return this.used; }
  get budgetBytes(): number { return this.limit; }
  get size(): number { return this.tickets.size; }
  setBudget(bytes: number): void {
    this.limit = Number.isFinite(bytes) ? Math.max(0, Math.floor(bytes)) : 0;
    while (this.used > this.limit && this.tickets.size) this.evictOldest();
  }
  clear(): void {
    this.entries = new WeakMap();
    this.tickets.clear();
    this.used = 0;
    this.hitCount = 0;
    this.missCount = 0;
  }
  private evict(id: number): void {
    const ticket = this.tickets.get(id);
    if (!ticket) return;
    const key = ticket.key.deref();
    if (key) {
      const slots = this.entries.get(key);
      if (slots?.get(ticket.slot)?.id === id) slots.delete(ticket.slot);
      if (slots?.size === 0) this.entries.delete(key);
    }
    this.tickets.delete(id);
    this.used -= ticket.bytes;
  }
  private evictOldest(): void {
    const first = this.tickets.keys().next();
    if (!first.done) this.evict(first.value);
  }
  get<K extends object, V>(slot: symbol, key: K, track = true): V | undefined {
    const entry = this.entries.get(key)?.get(slot);
    if (!entry) {
      if (track) this.missCount++;
      return undefined;
    }
    if (!track) return entry.value as V;
    this.hitCount++;
    const ticket = this.tickets.get(entry.id);
    if (ticket) {
      this.tickets.delete(entry.id);
      this.tickets.set(entry.id, ticket);
    }
    return entry.value as V;
  }
  set<K extends object, V>(slot: symbol, key: K, value: V, estimate: number): void {
    const old = this.entries.get(key)?.get(slot);
    if (old) this.evict(old.id);
    if (!Number.isFinite(estimate) || typeof WeakRef === 'undefined') return;
    const bytes = Math.max(256, Math.ceil(estimate));
    if (bytes > this.limit) return;
    while (this.used + bytes > this.limit && this.tickets.size) this.evictOldest();
    const id = ++this.nextId;
    const slots = this.entries.get(key) ?? new Map<symbol, Entry>();
    slots.set(slot, { id, value });
    this.entries.set(key, slots);
    this.tickets.set(id, { key: new WeakRef(key), slot, bytes });
    this.used += bytes;
  }
}
export const editorMemoryPool = new DerivedMemoryPool();
export interface DerivedCache<K extends object, V> {
  get(key: K, track?: boolean): V | undefined;
  set(key: K, value: V): void;
}
export function createDerivedCache<K extends object, V>(
  estimate: (value: V) => number,
  pool = editorMemoryPool,
): DerivedCache<K, V> {
  const slot = Symbol();
  return {
    get: (key, track) => pool.get<K, V>(slot, key, track),
    set: (key, value) => pool.set(slot, key, value, estimate(value)),
  };
}
export function createTextProjectionCache<K extends object>(): DerivedCache<K, string> {
  return createDerivedCache((value: string) => 256 + value.length * 2);
}
