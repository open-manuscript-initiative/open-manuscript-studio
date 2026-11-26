import { createPublicationPaginationEngine, type PublicationWorkerRequest, type PublicationWorkerResponse } from './publicationPaginationEngine';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<PublicationWorkerRequest>) => void) | null;
  postMessage: (response: PublicationWorkerResponse) => void;
};
let engine: ReturnType<typeof createPublicationPaginationEngine> | undefined;
scope.onmessage = ({ data }) => {
  if (data.kind === 'configure') {
    engine = createPublicationPaginationEngine(data.configuration);
    return;
  }
  try {
    if (!engine) throw new Error('Publication pagination is not configured');
    scope.postMessage({ id: data.id, result: engine(data.blocks, data.footnotes) });
  } catch {
    scope.postMessage({ id: data.id, failed: true });
  }
};
