import type { PublicationFlowBlock, PublicationFootnotes } from './publicationPageLayout';
import type { PublicationPaginationConfiguration, PublicationPaginationResult, PublicationWorkerRequest, PublicationWorkerResponse } from './publicationPaginationEngine';

export interface PublicationWorkerPort {
  onmessage: ((event: MessageEvent<PublicationWorkerResponse>) => void) | null;
  onerror: ((event: Event) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(message: PublicationWorkerRequest): void;
  terminate(): void;
}

export function createPublicationPaginationWorkerClient(
  configuration: PublicationPaginationConfiguration,
  factory: () => PublicationWorkerPort = () => new Worker(new URL('./publicationPagination.worker.ts', import.meta.url), { type: 'module' }) as unknown as PublicationWorkerPort,
  timeoutMs = 15_000,
) {
  let worker: PublicationWorkerPort | undefined;
  let disabled = false;
  let nextId = 0;
  let pending: { id: number; resolve: (result: PublicationPaginationResult | null) => void; timer: ReturnType<typeof setTimeout> } | undefined;
  const settle = (result: PublicationPaginationResult | null) => {
    if (!pending) return;
    const current = pending;
    pending = undefined;
    clearTimeout(current.timer);
    current.resolve(result);
  };
  const stop = () => {
    disabled = true;
    worker?.terminate();
    worker = undefined;
    settle(null);
  };
  const ensure = () => {
    if (disabled) return undefined;
    if (worker) return worker;
    try {
      worker = factory();
      worker.onmessage = ({ data }) => {
        if (!pending || data.id !== pending.id) return;
        if ('failed' in data) stop();
        else settle(data.result);
      };
      worker.onerror = stop;
      worker.onmessageerror = stop;
      worker.postMessage({ kind: 'configure', configuration });
    } catch {
      stop();
    }
    return worker;
  };
  return {
    async paginate(blocks: readonly PublicationFlowBlock[], footnotes: PublicationFootnotes, budgetBytes?: number): Promise<PublicationPaginationResult | null> {
      const port = ensure();
      if (!port || pending) return null;
      return new Promise(resolve => {
        const id = ++nextId;
        pending = { id, resolve, timer: setTimeout(stop, timeoutMs) };
        try { port.postMessage({ kind: 'paginate', id, blocks, footnotes, budgetBytes }); }
        catch { stop(); }
      });
    },
    clearCache() { try { worker?.postMessage({ kind: 'clear' }); } catch { stop(); } },
    close: stop,
  };
}
