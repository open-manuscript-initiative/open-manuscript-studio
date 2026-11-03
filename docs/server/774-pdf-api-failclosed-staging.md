# #774 — isolated staging API / PDF-worker socket failure and recovery

**Status:** test tooling proposed; **not** a passed host acceptance receipt.
#774 remains an RC release-blocker until stage results, full host/candidate
evidence and operator approval are reviewed.

## Motivation and actual production behavior

The Studio publication PDF route requires a session, renders via
\`renderVivliostylePdf\`, then uses the AF_UNIX PDF worker when required.
Previously, a missing worker socket would fail without local fallback, but
could be returned as generic HTTP 422 \`PDF_RENDER_FAILED\`; it could also
expose an OS socket error string. This change classifies unavailable socket
connection, timeout and access errors as a sanitized HTTP 503
\`PDF_RENDERER_UNAVAILABLE\`. Invalid HTML remains HTTP 400 and ordinary
render failures remain HTTP 422. The production API **never** tries local
Chromium/Poppler as an availability fallback.

## Staging contract (real API route, synthetic worker, no secrets)

The integration test at \`tests/pdf-worker-api-failclosed.test.mjs\` imports
the real compiled publication PDF Express router, real renderer and real
AF_UNIX transport. **Only authentication middleware is mocked** to use an
explicit synthetic owner (no real Studio identity, OIDC, cookies or DB).
The staging API listens exclusively on a temporary Unix socket. A separate
synthetic worker child process imports \`createPdfWorkerServer\` from the same
compiled candidate and listens on a different temporary Unix socket.
Both sockets live under a private, mode-0700 temporary directory.

The synthetic worker returns a fixed minimal byte contract beginning with
\`%PDF-\`; it does **not** launch Poppler/Chromium and does not claim to
validate PDF pagination/fidelity. Actual PDF rendering was previously checked
through the live worker with a separate synthetic HTML document.

This stage test verifies in order:

1. Missing fixture session is rejected (HTTP 401).
2. No worker socket: real API route returns HTTP 503,
   \`PDF_RENDERER_UNAVAILABLE\`, \`no-store\`, and no socket/OS details.
3. Start the synthetic worker child: a synthetic render returns HTTP 200
   with \`application/pdf\` and a \`%PDF-\` signature.
4. Stop that synthetic worker: the same API route again returns HTTP 503
   and cannot silently fall back to an in-process parser.
5. Restart a new synthetic worker child on the same private socket: the
   API returns HTTP 200 again.

CI runs the integration test on a non-root Ubuntu runner (no production
connections) after server compilation and dependency installation. The new
source-only syntax/sandbox test checks the host runner.

## Host staging execution (only after green PR and reviewed merge)

Do not execute these tests from the **existing production vhost checkout**:
it may have local modifications and a different release-branch HEAD. Do not
pull, reset, clean or recompile that checkout merely to stage this test.

Prepare a **separate unprivileged-readable checkout**, e.g. under
\`/srv/omi-rc-staging/<unique>\`, at the exact reviewed commit. Install
the server dependencies and compile the server in that isolated checkout,
with synthetic build-time environment and without copying the production
\`.env\`. Confirm \`server/dist\` and
\`server/node_modules/express/index.js\` exist. The runner will reject
a stale renderer build that lacks the stable unavailable-worker message.

After locally reviewing the exact candidate SHA and shell script, an
operator may run this from the **root** Plesk terminal, with the exact
separately prepared checkout path and 40-digit commit SHA:

~~~bash
bash /srv/omi-rc-staging/<unique>/scripts/acceptance/run-pdf-api-failclosed-staging.sh \
  /srv/omi-rc-staging/<unique> \
  <reviewed-40-char-sha>
~~~

The wrapper verifies the candidate HEAD, refuses the production vhost and
/opt/omi-pdf-worker paths, verifies all required modules, reads the actual API
user (never hardcodes a Plesk shared UID), and starts a **transient** service
using \`systemd-run --wait --pipe --collect\`. Its process uses
\`PrivateNetwork=yes\`, a private temp directory, restricted filesystem,
no-new-privileges, no external egress, and bounded memory/tasks. The staged
test process is run as the API account, *not root*. It cannot reach either
the live API listener or the live PDF-worker socket.

**Expected evidence:** \`stagingApiUnavailable: PASS\`,
\`stagingApiRecovery: PASS\`, \`authenticationFixtureRequired: PASS\`,
\`realRouteAndSocketTransport: PASS\`, TAP zero failures, and the wrapper's
\`PDF STAGING API FAIL-CLOSED: TEST COMPLETE\` confirmation. A test failure,
staging loader error, timeout, or absent expected field is **not** PASS;
investigate from sanitized local logs. The wrapper does not edit live unit
configuration, socket permissions, nginx, DBs or firewall policy.

## Release evidence limits

A successful stage test proves the selected compiled candidate's publication
route and worker transport fail closed and recover in a transient sandbox.
It **does not** prove real Studio auth/SSO, DB continuity, a production worker
crash, Chromium/Poppler fidelity, production API cgroup egress for #765, global
multi-host quotas, or signed update/rollback. Record reviewed SHA and binary
digests, the operator's observation and accepted residual risks in the existing
\`host-pdf-sandbox\` RC manual gate. Keep the #774 blocker and #390 RC gate open
until all required candidate-specific evidence and sign-offs are complete.
No manuscript files, cookies, access tokens or private configuration values
belong in GitHub comments or public build logs.
