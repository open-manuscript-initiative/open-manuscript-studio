import { Server } from '@hocuspocus/server';
import * as Y from 'yjs';

import { env } from '../config/env.js';
import { authorizeCollaborationConnectionTicket } from '../services/collaborationTicketService.js';
import { postgresCollaborationStateStore } from './collaborationStateStore.js';

let collaborationServer: Server | null = null;

export async function startCollaborationServer(): Promise<Server> {
  if (!env.MANUSCRIPT_COLLABORATION_ENABLED) {
    throw new Error('The manuscript collaboration transport is disabled.');
  }
  if (collaborationServer) return collaborationServer;

  const expectedOrigin = new URL(env.FRONTEND_ORIGIN).origin;
  const server = new Server({
    address: '127.0.0.1',
    port: env.COLLABORATION_WS_PORT,
    quiet: true,
    stopOnSignals: false,
    debounce: 750,
    maxDebounce: 3000,
    websocketOptions: { maxPayload: 8 * 1024 * 1024 },
    async onAuthenticate({ token, documentName, requestHeaders, connectionConfig }) {
      const origin = requestHeaders.get('origin');
      if (origin !== expectedOrigin) throw new Error('This origin is not allowed.');
      const ticket = await authorizeCollaborationConnectionTicket(token, documentName);
      if (!ticket) throw new Error('The collaboration ticket is invalid or expired.');
      connectionConfig.readOnly = ticket.role === 'VIEWER';
      return { userId: ticket.userId, role: ticket.role };
    },
    async onLoadDocument({ documentName, document }) {
      const state = await postgresCollaborationStateStore.load(documentName);
      if (state) Y.applyUpdate(document, state);
    },
    async onStoreDocument({ documentName, document }) {
      await postgresCollaborationStateStore.save(documentName, Y.encodeStateAsUpdate(document));
    },
  });

  await server.listen();
  collaborationServer = server;
  return server;
}

export function closeCollaborationDocumentConnections(documentId: string) {
  collaborationServer?.hocuspocus.closeConnections(documentId);
}

export async function stopCollaborationServer(server: Server | null) {
  if (!server) return;
  server.hocuspocus.flushPendingStores();
  await server.destroy();
  if (collaborationServer === server) collaborationServer = null;
}
