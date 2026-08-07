import express from 'express';
import {serverConfig} from './config';
import {verifyOjsLaunch} from './integrations/ojs/launchVerifier';

const app = express();
app.disable('x-powered-by');
app.use(express.json({limit: '1mb'}));

app.get('/health', (_req, res) => {
  res.json({status: 'ok'});
});

app.get('/integrations/ojs/launch', async (req, res) => {
  const payload = typeof req.query.payload === 'string' ? req.query.payload : '';
  const signature = typeof req.query.signature === 'string' ? req.query.signature : '';

  if (!payload || !signature) {
    res.status(400).json({error: 'missing_launch_assertion'});
    return;
  }

  try {
    const verified = await verifyOjsLaunch(payload, signature);

    // Never return or expose the shared secret to the browser.
    res.status(200).json({
      protocol: 'omi-integration/1',
      profile: 'omi-integration/1/ojs',
      status: 'verified',
      installation: verified.installation,
      context: verified.claims.context ?? null,
      submission: verified.claims.submission ?? null,
      actor: verified.claims.actor ?? null,
      scope: verified.claims.scope ?? [],
      expiresAt: new Date(verified.claims.exp * 1000).toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Launch verification failed.';
    res.status(401).json({
      error: 'invalid_launch_assertion',
      message,
    });
  }
});

app.listen(serverConfig.port, () => {
  console.log(`Open Manuscript Studio integration server listening on port ${serverConfig.port}`);
});
