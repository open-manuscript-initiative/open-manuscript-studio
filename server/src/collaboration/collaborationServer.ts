import { Server, type Connection } from '@hocuspocus/server';
import * as Y from 'yjs';

import { env } from '../config/env.js';
import { authorizeCollaborationConnectionTicket, reauthorizeCollaborationSession } from '../services/collaborationTicketService.js';
import { COLLABORATION_RECHECK_MS } from '../services/collaborationPolicy.js';
import { postgresCollaborationStateStore } from './collaborationStateStore.js';

let collaborationServer: Server | null = null;

export async function startCollaborationServer(): Promise<Server> {
  if (!env.MANUSCRIPT_COLLABORATION_ENABLED) {
    throw new Error('The manuscript collaboration transport is disabled.');
  }
  if (collaborationServer) return collaborationServer;

  const expectedOrigin = new URL(env.FRONTEND_ORIGIN).origin;
  const connections = new Map<string, Connection>();
  const recheck = async (connection: Connection, documentId: string) => {
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const access = await Promise.race([
        reauthorizeCollaborationSession(connection.context, documentId),
        new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error('Authorization timeout.')), 5000); deadline.unref(); }),
      ]);
      if (!access) throw new Error('Access expired or revoked.');
      connection.readOnly = access.readOnly;
    } catch {
      connection.readOnly = true;
      connection.close();
      throw new Error('Collaboration authorization unavailable.');
    } finally { clearTimeout(deadline); }
  };
  const timer = setInterval(() => {
    for (const connection of connections.values()) {
      void recheck(connection, connection.document.name).catch(() => { /* Closed, fail closed. */ });
    }
  }, COLLABORATION_RECHECK_MS);
  timer.unref();
  const server = new Server({
    address: env.COLLABORATION_WS_HOST,
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
      // Authentication is action-scoped: a role label alone is never write authority.
      connectionConfig.readOnly = ticket.readOnly;
      return ticket;
    },
    async connected({ connection, socketId, documentName }) { connections.set(`${socketId}:${documentName}`, connection); },
    async beforeHandleMessage({ connection, documentName }) { await recheck(connection, documentName); },
    async onDisconnect({ socketId, documentName }) { connections.delete(`${socketId}:${documentName}`); },
    async onDestroy() { clearInterval(timer); connections.clear(); },
    async onLoadDocument({ documentName, document }) {
      const state = await postgresCollaborationStateStore.load(documentName);
      if (state) Y.applyUpdate(document, state);
    },
    async onStoreDocument({ documentName, document }) {
      await postgresCollaborationStateStore.save(documentName, Y.encodeStateAsUpdate(document));
    },
  });

  try { await server.listen(); } catch (error) { clearInterval(timer); throw error; }
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
