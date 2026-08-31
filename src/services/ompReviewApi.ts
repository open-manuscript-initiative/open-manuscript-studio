const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL ?? '')
  .trim()
  .replace(/\/$/, '');

interface OmpReviewLaunchResponse {
  assignmentId: string;
}

interface ErrorResponse {
  error?: { message?: string };
}

export async function claimOmpReviewLaunch(
  payload: string,
  signature: string,
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/integrations/omp/review/launch`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ payload, signature }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as ErrorResponse | null;
    throw new Error(
      body?.error?.message || `OMP reviewer launch failed with HTTP ${response.status}.`,
    );
  }
  return (await response.json() as OmpReviewLaunchResponse).assignmentId;
}
