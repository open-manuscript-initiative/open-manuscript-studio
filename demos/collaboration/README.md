# OMI Studio collaboration sponsor demo

This isolated application demonstrates two participants editing one fixed synthetic manuscript using Yjs and Hocuspocus. It does not connect to OMI accounts, PostgreSQL, APIs, OJS/OMP, manuscript files, or the OMI schema/container contract.

## Local run

Requires Node.js 24.

~~~sh
cd demos/collaboration
npm ci
cp .env.example .env
~~~

Set a private DEMO_ACCESS_CODE and a random DEMO_TOKEN_SECRET of at least 32 bytes in .env. Load the environment and start the server:

~~~sh
set -a
. ./.env
set +a
npm start
~~~

In another terminal run npm run dev and open http://127.0.0.1:5173 in two browser windows. The shared sample room is persisted as a Yjs binary state file under data/.

## Single-VPS profile

The proposed public route is https://studio.openmanuscript.org/collaboration-demo/. The static UI is served from the existing Studio document root. Plesk proxies the session endpoint to loopback port 3020 and the WebSocket to loopback port 3021. The service is separate from the OMI Studio API and stores only the synthetic room under /var/lib/omi-collaboration-demo.

After merging the checked PR, run scripts/provision-collaboration-demo.sh once from the root Plesk terminal. It creates the environment file, systemd unit, data directory and managed Plesk Nginx block. It requires Node 24 at /opt/plesk/node/24/bin/node. The script preserves other vhost configuration, refuses an incomplete managed block, runs nginx -t and restores the prior custom file if validation fails.

The existing GitHub deploy account is restricted to restarting the OMI API. After provisioning, add only the sidecar restart command to a sudoers drop-in, replacing DEPLOY_USER with the GitHub SSH_USER value:

~~~sudoers
DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart omi-studio-collaboration-demo.service
~~~

Validate the file with visudo -cf. Do not grant unrestricted sudo. The production workflow skips the demo until this systemd unit is enabled. After setup, dispatch OMI Studio CI/CD on main once to activate the demo deployment.

The first setup generates the access code and signing key in /etc/omi-studio-collaboration-demo.env; the values are never written to logs. An administrator can retrieve or rotate them with root access. Do not enter real documents or personal data.

## Deliberate limits

- One fixed synthetic room with a shared code for controlled demonstrations.
- Two-hour HMAC session token; no OMI identity or publication authority is reused.
- One process and local filesystem persistence; this is not a horizontally scalable deployment.
- No production document, comments, attachments, review, OJS/OMP, or OMI file integration.
- Yjs demonstrates concurrent editing; it does not replace the OMI format or its revision/provenance semantics.

## Checks

~~~sh
npm test
npx playwright install chromium
npm run test:e2e
DEMO_BASE_PATH=/collaboration-demo/ npm run build
~~~
