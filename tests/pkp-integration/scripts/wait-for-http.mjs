import process from 'node:process';
import timers from 'node:timers/promises';

const [url, timeoutValue = '180000'] = process.argv.slice(2);

if (!url) {
  console.error('Usage: node wait-for-http.mjs <url> [timeout-ms]');
  process.exit(2);
}

const timeoutMs = Number(timeoutValue);

if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
  console.error(`Invalid timeout: ${timeoutValue}`);
  process.exit(2);
}

const deadline = Date.now() + timeoutMs;
let lastError = 'no response';

while (Date.now() < deadline) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(5_000),
    });

    if (response.status < 400) {
      console.log(`${url} is reachable (HTTP ${response.status}).`);
      process.exit(0);
    }

    lastError = `HTTP ${response.status}`;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }

  await timers.setTimeout(2_000);
}

console.error(`${url} did not become reachable within ${timeoutMs} ms (${lastError}).`);
process.exit(1);
