#!/usr/bin/env node
/**
 * #765: offline staging acceptance receipt validator.
 * No network, process execution, privilege escalation, production changes,
 * filesystem enumeration or secret collection. Reads only one explicitly
 * supplied JSON file and emits a content-neutral summary.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CASES = Object.freeze([
  'ipv4PrivateLinkLocal', 'ipv6UlaLinkLocalMapped',
  'metadataSynthetic', 'dnsRebinding', 'httpRedirect',
  'proxyAndAlternateFetch', 'workerContainerDelegation',
  'authorizedOjsWebdav', 'enabledCloudAndOidc',
  'loopbackDbProxy', 'postTestHealth',
]);
const HEX = /^[0-9a-f]{40}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const STATUS = new Set(['PASS', 'FAIL', 'NOT_VERIFIED', 'NOT_APPLICABLE']);
const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);

export function assess(input) {
  const errors = [];
  if (!isObj(input)) return { status: 'INVALID', errors: ['receiptMustBeObject'] };
  if (input.schemaVersion !== 1) errors.push('schemaVersion');
  if (input.scope !== 'isolated-staging') errors.push('scopeMustBeIsolatedStaging');
  if (!HEX.test(input.sourceSha ?? '')) errors.push('sourceSha');
  if (!DIGEST.test(input.buildDigest ?? '')) errors.push('buildDigest');
  if (!HEX.test(input.harnessSha ?? '')) errors.push('harnessSha');
  if (!Number.isFinite(Date.parse(input.observedAt ?? ''))) errors.push('observedAt');
  if (input.approvedByOperator !== true) errors.push('operatorApprovalRequired');
  if (input.noProductionMutation !== true) errors.push('noProductionMutationRequired');
  if (!isObj(input.cases)) errors.push('cases');
  const results = {};
  for (const key of CASES) {
    const v = input.cases?.[key];
    if (!STATUS.has(v)) errors.push('case:' + key);
    results[key] = STATUS.has(v) ? v : 'NOT_VERIFIED';
  }
  const failed = Object.values(results).filter(v => v === 'FAIL').length;
  const missing = Object.values(results).filter(v => v === 'NOT_VERIFIED').length;
  // Staging can never certify the production process, even with all PASS.
  return {
    schemaVersion: 1, scope: 'isolated-staging',
    status: errors.length ? 'INVALID' : failed ? 'STAGING_FAILED' :
      missing ? 'STAGING_INCOMPLETE' : 'STAGING_REVIEW_REQUIRED',
    checks: results, invalidFields: errors,
    productionLiveApiNegative: 'NOT_VERIFIED',
    hostEgressReceipt: 'NOT_APPROVED',
    rcDecision: 'NO_GO',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  if (process.argv.length !== 3) {
    console.error('Usage: node scripts/acceptance/765-staging-receipt.mjs <operator-reviewed-json>');
    process.exitCode = 2;
  } else {
    try {
      const result = assess(JSON.parse(readFileSync(process.argv[2], 'utf8')));
      process.stdout.write(JSON.stringify(result, null, 2) + '\n');
      if (result.status !== 'STAGING_REVIEW_REQUIRED') process.exitCode = 2;
    } catch {
      // No filenames, file contents, endpoints or exception stack in output.
      console.error('Receipt could not be read or parsed');
      process.exitCode = 2;
    }
  }
}
