import { access, appendFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { chromium } from '@playwright/test';
import { buildPdfWorkerEnvironment } from '../server/dist/security/pdfWorkerEnvironment.js';

// Use the lockfile-pinned browser instead of the runner image's system Chrome.
// Exercise the same executable and credential-filtered environment as the PDF
// renderer before enabling the real pagination assertions.
if (!process.env.GITHUB_ENV) throw new Error('GITHUB_ENV is required.');
const executablePath = chromium.executablePath();
await access(executablePath, constants.X_OK);
const browser = await chromium.launch({
  executablePath,
  env: buildPdfWorkerEnvironment('vivliostyle'),
});
try {
  console.log(`Vivliostyle CI browser: ${executablePath}`);
  console.log(`Chromium version: ${browser.version()}`);
} finally {
  await browser.close();
}
await appendFile(process.env.GITHUB_ENV, `VIVLIOSTYLE_EXECUTABLE_BROWSER=${executablePath}\n`);
