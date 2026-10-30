import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  PDF_IMPORT_LIMITS,
  PdfImportCapacityError,
  rejectPdfImportAdmission,
} from '../server/src/import/pdf/pdfImportAdmission.ts';

type Job = {
  ownerUserId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
};

test('per-user admission prevents concurrent Poppler jobs including queued work', () => {
  assert.equal(PDF_IMPORT_LIMITS.activePerUser, 1);
  const existing: Job[] = [{ ownerUserId: 'alice', status: 'queued' }];
  assert.equal(rejectPdfImportAdmission(existing, 'alice'), 'PDF_IMPORT_USER_BUSY');
  existing[0]!.status = 'processing';
  assert.equal(rejectPdfImportAdmission(existing, 'alice'), 'PDF_IMPORT_USER_BUSY');
  assert.equal(rejectPdfImportAdmission(existing, 'bob'), null);
  existing[0]!.status = 'completed';
  assert.equal(rejectPdfImportAdmission(existing, 'alice'), null);
});

test('process quota caps concurrent work across different users', () => {
  const entries: Job[] = [
    { ownerUserId: 'alice', status: 'processing' },
    { ownerUserId: 'bob', status: 'queued' },
  ];
  assert.equal(PDF_IMPORT_LIMITS.activePerProcess, 2);
  assert.equal(rejectPdfImportAdmission(entries, 'carol'), 'PDF_IMPORT_SERVER_BUSY');
  entries[0]!.status = 'completed';
  assert.equal(rejectPdfImportAdmission(entries, 'carol'), null);
});

test('retention quotas bound in-memory results and keep user isolation', () => {
  const owned: Job[] = Array.from({ length: PDF_IMPORT_LIMITS.retainedPerUser }, () => ({
    ownerUserId: 'alice', status: 'completed',
  }));
  assert.equal(rejectPdfImportAdmission(owned, 'alice'), 'PDF_IMPORT_USER_HISTORY_FULL');
  assert.equal(rejectPdfImportAdmission(owned, 'bob'), null);
  const full: Job[] = Array.from({ length: PDF_IMPORT_LIMITS.retainedPerProcess }, (_, index) => ({
    ownerUserId: 'user-' + index,
    status: 'failed',
  }));
  assert.equal(rejectPdfImportAdmission(full, 'carol'), 'PDF_IMPORT_SERVER_HISTORY_FULL');
  assert.equal(rejectPdfImportAdmission([], 'carol'), null);
});

test('capacity rejection maps to retryable HTTP statuses', () => {
  assert.equal(new PdfImportCapacityError('PDF_IMPORT_USER_BUSY').httpStatus, 429);
  assert.equal(new PdfImportCapacityError('PDF_IMPORT_SERVER_BUSY').httpStatus, 503);
  assert.equal(new PdfImportCapacityError('PDF_IMPORT_USER_HISTORY_FULL').httpStatus, 429);
  assert.equal(new PdfImportCapacityError('PDF_IMPORT_SERVER_HISTORY_FULL').httpStatus, 503);
});

test('PDF admission runs before 100 MiB body decoding; bytes are not copied', () => {
  const route = readFileSync(new URL('../server/src/routes/pdfImportRoutes.ts', import.meta.url), 'utf8');
  const service = readFileSync(new URL('../server/src/import/pdf/pdfImportService.ts', import.meta.url), 'utf8');
  assert.ok(route.indexOf("pdfImportRouter.use(requireSession);") < route.indexOf("pdfImportRouter.post('/pdf', (request: AuthenticatedRequest"));
  assert.ok(route.indexOf("pdfImportRouter.post('/pdf', (request: AuthenticatedRequest") < route.indexOf("pdfImportRouter.post('/pdf', pdfBody,"));
  assert.match(route, /const pdfBytes = request\.body as Buffer/);
  assert.doesNotMatch(route, /Buffer\.from\(request\.body\)/);
  assert.match(service, /rejectPdfImportAdmission\(jobs\.values\(\), ownerUserId\)/);
  assert.match(service, /if \(directory\) await rm\(directory/);
});
