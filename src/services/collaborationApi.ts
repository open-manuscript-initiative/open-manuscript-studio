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

export interface SharedCollaborativeDocument {
  documentId: string;
  title: string;
  role: 'OWNER' | 'EDITOR' | 'AUTHOR' | 'VIEWER';
  packageUpdatedAt: string | null;
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

export async function listSharedCollaborativeDocuments(): Promise<SharedCollaborativeDocument[]> {
  const response = await requestStudioApi<{ documents: SharedCollaborativeDocument[] }>(
    '/api/collaboration/documents',
    { method: 'GET' },
  );
  return response.documents;
}

export async function publishSharedManuscriptPackage(input: {
  documentId: string;
  packageVersion: string;
  bytes: Uint8Array;
}): Promise<void> {
  let binary = '';
  for (let offset = 0; offset < input.bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...input.bytes.subarray(offset, offset + 0x8000));
  }
  await requestStudioApi(`/api/collaboration/documents/${encodeURIComponent(input.documentId)}/package`, {
    method: 'PUT',
    body: JSON.stringify({ packageVersion: input.packageVersion, packageBase64: btoa(binary) }),
  });
}

export async function downloadSharedManuscriptPackage(documentId: string): Promise<Uint8Array> {
  const response = await requestStudioApi<{ package: { packageBase64: string } }>(
    `/api/collaboration/documents/${encodeURIComponent(documentId)}/package`,
    { method: 'GET' },
  );
  const binary = atob(response.package.packageBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
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

export interface CollaborationMessage {
  id: string;
  senderUserId: string | null;
  senderName: string;
  body: string;
  createdAt: string;
}

export async function getCollaborationMessages(documentId: string): Promise<CollaborationMessage[]> {
  const response = await requestStudioApi<{ messages: CollaborationMessage[] }>(
    '/api/collaboration/documents/' + encodeURIComponent(documentId) + '/messages',
    { method: 'GET' },
  );
  return response.messages;
}

export async function sendCollaborationMessage(documentId: string, body: string): Promise<CollaborationMessage> {
  const response = await requestStudioApi<{ message: CollaborationMessage }>(
    '/api/collaboration/documents/' + encodeURIComponent(documentId) + '/messages',
    { method: 'POST', body: JSON.stringify({ body }) },
  );
  return response.message;
}
