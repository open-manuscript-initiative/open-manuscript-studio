import { getStudioApiBaseUrl, requestStudioApi } from './authApi';

export function collaborationWebSocketUrl(path: string): string {
  const apiUrl = new URL(getStudioApiBaseUrl(), globalThis.location?.origin);
  const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${apiUrl.host}${path}`;
}

export interface CollaborationAccess {
  members: Array<{
    userId: string;
    email: string;
    displayName: string;
    role: 'OWNER' | 'EDITOR' | 'AUTHOR' | 'VIEWER';
    acceptedAt: string;
  }>;
  invitations: Array<{
    id: string;
    invitedEmail: string;
    role: 'EDITOR' | 'AUTHOR' | 'VIEWER';
    status: 'pending';
    expiresAt: string;
    createdAt: string;
  }>;
}

export interface CollaborationInvitationDetails {
  email: string;
  role: 'EDITOR' | 'AUTHOR' | 'VIEWER';
  documentId: string;
  documentTitle: string;
  status: 'pending';
}

export interface PendingCollaborationInvitation {
  id: string;
  documentId: string;
  documentTitle: string;
  role: 'EDITOR' | 'AUTHOR' | 'VIEWER';
  status: 'pending';
  createdAt: string;
  expiresAt: string;
}

export async function isCollaborationEnabled(): Promise<boolean> {
  const response = await requestStudioApi<{ enabled: boolean }>(
    '/api/collaboration/status',
    { method: 'GET' },
  );
  return response.enabled;
}

export async function getPendingCollaborationInvitations(): Promise<PendingCollaborationInvitation[]> {
  const response = await requestStudioApi<{ invitations: PendingCollaborationInvitation[] }>(
    '/api/collaboration/invitations/pending',
    { method: 'GET' },
  );
  return response.invitations;
}

export async function getCollaborationAccess(documentId: string): Promise<CollaborationAccess> {
  return requestStudioApi(`/api/collaboration/documents/${encodeURIComponent(documentId)}/access`, { method: 'GET' });
}

export async function createCollaborationDocument(input: {
  documentId: string;
  title: string;
  initialState: string;
}): Promise<void> {
  await requestStudioApi('/api/collaboration/documents', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getCollaborationTicket(documentId: string): Promise<{
  token: string;
  webSocketPath: string;
}> {
  const response = await requestStudioApi<{ ticket: { token: string; webSocketPath: string } }>(
    `/api/collaboration/documents/${encodeURIComponent(documentId)}/connection-ticket`,
    { method: 'POST', body: '{}' },
  );
  return response.ticket;
}

export async function inviteCollaborationMember(
  documentId: string,
  email: string,
  role: 'EDITOR' | 'AUTHOR' | 'VIEWER',
): Promise<boolean> {
  const response = await requestStudioApi<{ invitation: { emailSent?: boolean } }>(`/api/collaboration/documents/${encodeURIComponent(documentId)}/invitations`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
  return response.invitation.emailSent !== false;
}

export async function inspectCollaborationInvitation(token: string): Promise<CollaborationInvitationDetails> {
  const response = await requestStudioApi<{ invitation: CollaborationInvitationDetails }>(
    `/api/collaboration/invitations/${encodeURIComponent(token)}`,
    { method: 'GET' },
  );
  return response.invitation;
}

export async function acceptCollaborationInvitation(token: string): Promise<void> {
  await requestStudioApi(`/api/collaboration/invitations/${encodeURIComponent(token)}/accept`, {
    method: 'POST', body: '{}',
  });
}

export async function declineCollaborationInvitation(token: string): Promise<void> {
  await requestStudioApi(`/api/collaboration/invitations/${encodeURIComponent(token)}/decline`, {
    method: 'POST', body: '{}',
  });
}

export async function acceptPendingCollaborationInvitation(invitationId: string): Promise<void> {
  await requestStudioApi(`/api/collaboration/invitations/by-id/${encodeURIComponent(invitationId)}/accept`, {
    method: 'POST', body: '{}',
  });
}

export async function declinePendingCollaborationInvitation(invitationId: string): Promise<void> {
  await requestStudioApi(`/api/collaboration/invitations/by-id/${encodeURIComponent(invitationId)}/decline`, {
    method: 'POST', body: '{}',
  });
}
