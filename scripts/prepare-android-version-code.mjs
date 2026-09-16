import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ANDROID_VERSION_CODE_RUN_OFFSET = 1001;
export const ANDROID_VERSION_CODE_MAX = 2100000000;

function parseInteger(value, name) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new Error(name + ' must be a safe integer; received ' + String(value) + '.');
  }
  return number;
}

export function calculateAndroidVersionCode({
  current,
  runNumber,
  runOffset = process.env.ANDROID_VERSION_CODE_RUN_OFFSET ?? ANDROID_VERSION_CODE_RUN_OFFSET,
} = {}) {
  const currentVersionCode = parseInteger(current, 'Current Android versionCode');
  const workflowRunNumber = parseInteger(runNumber, 'GITHUB_RUN_NUMBER');
  const offset = parseInteger(runOffset, 'ANDROID_VERSION_CODE_RUN_OFFSET');

  if (currentVersionCode < 1 || currentVersionCode >= ANDROID_VERSION_CODE_MAX) {
    throw new Error('Invalid current Android versionCode: ' + currentVersionCode + '.');
  }
  if (workflowRunNumber < 1) {
    throw new Error('GITHUB_RUN_NUMBER must be at least 1.');
  }
  if (offset < 0) {
    throw new Error('ANDROID_VERSION_CODE_RUN_OFFSET cannot be negative.');
  }

  const nextVersionCode = offset + workflowRunNumber;
  if (!Number.isSafeInteger(nextVersionCode) || nextVersionCode < 1 || nextVersionCode >= ANDROID_VERSION_CODE_MAX) {
    throw new Error('Calculated Android versionCode is outside the supported range: ' + nextVersionCode + '.');
  }
  if (nextVersionCode <= currentVersionCode) {
    throw new Error(
      'Calculated Android versionCode ' + nextVersionCode +
      ' is not greater than the committed versionCode ' + currentVersionCode +
      '. Increase ANDROID_VERSION_CODE_RUN_OFFSET before releasing again.',
    );
  }

  return nextVersionCode;
}

export function prepareAndroidVersionCode({
  configPath = resolve('src-tauri/tauri.android.conf.json'),
  runNumber = process.env.GITHUB_RUN_NUMBER,
  runOffset = process.env.ANDROID_VERSION_CODE_RUN_OFFSET ?? ANDROID_VERSION_CODE_RUN_OFFSET,
} = {}) {
  let config;
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (error) {
    throw new Error('Could not read or parse ' + configPath + ': ' + error.message);
  }

  const current = config?.bundle?.android?.versionCode;
  const versionCode = calculateAndroidVersionCode({ current, runNumber, runOffset });
  config.bundle.android.versionCode = versionCode;
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
  return { current: Number(current), versionCode };
}

function appendLine(path, line) {
  if (path) appendFileSync(path, line);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  try {
    const result = prepareAndroidVersionCode();
    appendLine(process.env.GITHUB_OUTPUT, 'version_code=' + result.versionCode + '\n');
    appendLine(
      process.env.GITHUB_STEP_SUMMARY,
      [
        '### Android version code',
        '',
        '- Committed config: ' + result.current,
        '- Workflow run: ' + process.env.GITHUB_RUN_NUMBER,
        '- Build versionCode: ' + result.versionCode,
        '',
        'The protected main branch was not modified; the code is derived from the workflow run number.',
        '',
      ].join('\n'),
    );
    console.log('Prepared Android versionCode ' + result.versionCode + ' for this release run.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
