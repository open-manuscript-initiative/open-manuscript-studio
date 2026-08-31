export interface PdfImportWarning {
  code: string;
  message: string;
  page?: number;
}

export interface PdfImportBlock {
  kind: 'heading' | 'paragraph' | 'footnote';
  text: string;
  page: number;
  confidence: number;
  headingLevel?: number;
  noteMarker?: string;
}

export interface PdfImportResult {
  source: {
    fileName: string;
    pageCount: number;
    kind: 'text' | 'scanned' | 'hybrid';
  };
  title: string;
  blocks: PdfImportBlock[];
  warnings: PdfImportWarning[];
  stats: {
    headings: number;
    paragraphs: number;
    footnotes: number;
    removedRunningHeaders: number;
  };
}

export interface PdfImportProgress {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  pagesProcessed: number;
  pagesTotal: number;
}

interface JobResponse {
  job: {
    id: string;
    status: PdfImportProgress['status'];
    pagesProcessed: number;
    pagesTotal: number;
    error?: string;
  };
}

interface ResultResponse {
  result: PdfImportResult;
}

interface ErrorResponse {
  error?: { message?: string };
}

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL ?? '').trim().replace(/\/$/, '');

export async function importPdfForStudio(
  file: File,
  onProgress?: (progress: PdfImportProgress) => void,
): Promise<PdfImportResult> {
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
    throw new Error('A PDF file is required.');
  }
  if (file.size > 100 * 1024 * 1024) {
    throw new Error('PDF import is limited to 100 MB per file.');
  }

  const started = await fetch(`${API_BASE_URL}/api/import/pdf`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/pdf',
      'X-OMI-File-Name': encodeURIComponent(file.name),
    },
    body: file,
  });
  if (!started.ok) throw await createApiError(started);
  const created = await started.json() as JobResponse;
  const jobId = created.job.id;
  onProgress?.(created.job);

  for (;;) {
    await delay(350);
    const response = await fetch(`${API_BASE_URL}/api/import/pdf/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw await createApiError(response);
    const payload = await response.json() as JobResponse;
    onProgress?.(payload.job);
    if (payload.job.status === 'failed') {
      throw new Error(payload.job.error || 'PDF import failed.');
    }
    if (payload.job.status !== 'completed') continue;

    const resultResponse = await fetch(
      `${API_BASE_URL}/api/import/pdf/${encodeURIComponent(jobId)}/result`,
      {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      },
    );
    if (!resultResponse.ok) throw await createApiError(resultResponse);
    return (await resultResponse.json() as ResultResponse).result;
  }
}

async function createApiError(response: Response): Promise<Error> {
  try {
    const payload = await response.json() as ErrorResponse;
    return new Error(payload.error?.message || `PDF import failed with HTTP ${response.status}.`);
  } catch {
    return new Error(`PDF import failed with HTTP ${response.status}.`);
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
