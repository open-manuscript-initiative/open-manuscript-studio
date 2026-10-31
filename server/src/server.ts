import { app } from './app.js';
import { env } from './config/env.js';
import { startCollaborationServer, stopCollaborationServer } from './collaboration/collaborationServer.js';
import { prisma } from './lib/prisma.js';
import { startServerRegistryHeartbeat } from './serverRegistry/heartbeat.js';

const stopRegistryHeartbeat = startServerRegistryHeartbeat();

const collaborationServer = env.MANUSCRIPT_COLLABORATION_ENABLED
  ? await startCollaborationServer()
  : null;

const server = app.listen(
  env.PORT,
  env.API_BIND_HOST,
  () => {
    console.log(
      `Open Manuscript Studio API listening on ${env.API_BIND_HOST}:${env.PORT}.`,
    );
  },
);

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.log(
    `Received ${signal}. Shutting down gracefully.`,
  );

  server.close(async (error) => {
    if (error) {
      console.error(
        'HTTP server shutdown failed:',
        error,
      );

      process.exitCode = 1;
    }

    stopRegistryHeartbeat?.();
    await stopCollaborationServer(collaborationServer);
    await prisma.$disconnect();

    process.exit();
  });
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
