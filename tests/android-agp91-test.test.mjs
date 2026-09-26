import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const script = resolve('scripts/configure-android-agp91-test.mjs');

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'omi-agp91-'));
  const root = join(cwd, 'src-tauri/gen/android');
  mkdirSync(join(root, 'app'), { recursive: true });
  writeFileSync(
    join(root, 'app/build.gradle.kts'),
    'android { kotlinOptions { jvmTarget = "1.8" } }\napply(from = "tauri.build.gradle.kts")',
  );
  mkdirSync(join(root, 'buildSrc/src/main/kotlin'), { recursive: true });
  writeFileSync(
    join(root, 'buildSrc/src/main/kotlin/BuildTask.kt'),
    'open class BuildTask : DefaultTask() { fun run() { project.exec { executable("npm") } } }',
  );
  mkdirSync(join(root, 'gradle/wrapper'), { recursive: true });
  for (const path of ['build.gradle.kts', 'buildSrc/build.gradle.kts']) {
    writeFileSync(join(root, path), 'classpath("com.android.tools.build:gradle:9.0.1")\n');
  }
  writeFileSync(
    join(root, 'gradle/wrapper/gradle-wrapper.properties'),
    'distributionUrl=https\\://services.gradle.org/distributions/gradle-9.1.0-bin.zip\n',
  );
  writeFileSync(
    join(root, 'gradle.properties'),
    'org.gradle.jvmargs=-Xmx2048m\nandroid.useAndroidX=true\nandroid.nonFinalResIds=false\n',
  );
  return {
    cwd,
    root,
    run: () => spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' }),
  };
}

test('AGP 9.1 compatibility adapter is repeatable and preserves required release settings', () => {
  const f = fixture();
  try {
    const first = f.run();
    assert.equal(first.status, 0, first.stderr);

    for (const path of ['build.gradle.kts', 'buildSrc/build.gradle.kts']) {
      assert.match(readFileSync(join(f.root, path), 'utf8'), /gradle:9\.1\.1/);
    }
    assert.match(
      readFileSync(join(f.root, 'gradle/wrapper/gradle-wrapper.properties'), 'utf8'),
      /gradle-9\.3\.1-bin/,
    );

    const properties = readFileSync(join(f.root, 'gradle.properties'), 'utf8');
    assert.match(properties, /android\.builtInKotlin=false/);
    assert.match(properties, /android\.newDsl=false/);
    assert.match(properties, /android\.nonFinalResIds=true/);
    assert.match(properties, /android\.r8\.optimizedResourceShrinking=true/);
    assert.ok(!properties.includes('android.nonFinalResIds=false'));

    const task = readFileSync(join(f.root, 'buildSrc/src/main/kotlin/BuildTask.kt'), 'utf8');
    assert.match(task, /javax\.inject\.Inject/);
    assert.match(task, /execOperations\.exec/);
    assert.ok(!task.includes('project.exec'));

    const app = readFileSync(join(f.root, 'app/build.gradle.kts'), 'utf8');
    assert.match(app, /targetCompatibility = JavaVersion\.VERSION_1_8/);
    assert.ok(app.includes('apply(from = file("tauri.build.gradle.kts"))'));

    assert.equal(f.run().status, 0);
    assert.equal(readFileSync(join(f.root, 'gradle.properties'), 'utf8'), properties);
  } finally {
    rmSync(f.cwd, { recursive: true, force: true });
  }
});

test('unexpected generated build files fail before changing the toolchain', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.root, 'buildSrc/build.gradle.kts'), 'changed template');
    assert.notEqual(f.run().status, 0);
    assert.match(readFileSync(join(f.root, 'build.gradle.kts'), 'utf8'), /gradle:9\.0\.1/);
  } finally {
    rmSync(f.cwd, { recursive: true, force: true });
  }
});
