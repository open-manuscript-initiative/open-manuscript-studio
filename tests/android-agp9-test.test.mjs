import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = resolve('scripts/configure-android-agp9-test.mjs');
function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'omi-agp9-'));
  const root = join(cwd, 'src-tauri/gen/android');
  mkdirSync(join(root, 'buildSrc/src/main/kotlin'), { recursive: true });
  writeFileSync(join(root, 'buildSrc/src/main/kotlin/BuildTask.kt'), 'open class BuildTask : DefaultTask() { fun run() { project.exec { executable("npm") } } }');
  mkdirSync(join(root, 'gradle/wrapper'), { recursive: true });
  for (const path of ['build.gradle.kts', 'buildSrc/build.gradle.kts']) {
    writeFileSync(join(root, path), 'classpath("com.android.tools.build:gradle:8.11.0")\n');
  }
  writeFileSync(join(root, 'gradle/wrapper/gradle-wrapper.properties'), 'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.14.3-bin.zip\n');
  writeFileSync(join(root, 'gradle.properties'), 'org.gradle.jvmargs=-Xmx2048m\nandroid.useAndroidX=true\n');
  return { cwd, root, run: mode => spawnSync(process.execPath, [script, mode], { cwd, encoding: 'utf8' }) };
}
test('both AGP classpaths and wrapper change; default probe can switch to repeatable compatibility mode', () => {
  const f = fixture();
  try {
    const defaults = f.run('defaults');
    assert.equal(defaults.status, 0, defaults.stderr);
    const task = readFileSync(join(f.root, 'buildSrc/src/main/kotlin/BuildTask.kt'), 'utf8');
    assert.match(task, /javax.inject.Inject/);
    assert.match(task, /execOperations.exec/);
    assert.ok(!task.includes('project.exec'));
    for (const path of ['build.gradle.kts', 'buildSrc/build.gradle.kts']) {
      assert.match(readFileSync(join(f.root, path), 'utf8'), /gradle:9\.0\.1/);
    }
    assert.match(readFileSync(join(f.root, 'gradle/wrapper/gradle-wrapper.properties'), 'utf8'), /gradle-9\.1\.0-bin/);
    assert.match(readFileSync(join(f.root, 'gradle.properties'), 'utf8'), /android.builtInKotlin=true/);
    const compat = f.run('compatibility');
    assert.equal(compat.status, 0, compat.stderr);
    const properties = readFileSync(join(f.root, 'gradle.properties'), 'utf8');
    assert.match(properties, /android.builtInKotlin=false/);
    assert.match(properties, /android.newDsl=false/);
    assert.match(properties, /android.useAndroidX=true/);
    assert.equal(f.run('compatibility').status, 0);
    assert.equal(readFileSync(join(f.root, 'gradle.properties'), 'utf8'), properties);
  } finally { rmSync(f.cwd, { recursive: true, force: true }); }
});
test('unexpected generated files fail before modifying the toolchain', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.root, 'buildSrc/build.gradle.kts'), 'changed template');
    assert.notEqual(f.run('compatibility').status, 0);
    assert.match(readFileSync(join(f.root, 'build.gradle.kts'), 'utf8'), /gradle:8\.11\.0/);
  } finally { rmSync(f.cwd, { recursive: true, force: true }); }
});
