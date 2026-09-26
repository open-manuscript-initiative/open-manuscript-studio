// Production AGP 9.1 compatibility adapter for the Tauri 2.11.4 generated Android project.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('src-tauri/gen/android');
const updates = [];

function replace(file, pattern, replacement) {
  const path = resolve(root, file);
  const source = readFileSync(path, 'utf8');
  if (!pattern.test(source)) throw new Error(`Expected generated setting missing: ${file}`);
  updates.push([path, source.replace(pattern, replacement)]);
}

replace('build.gradle.kts', /com\.android\.tools\.build:gradle:[\d.]+/g, 'com.android.tools.build:gradle:9.1.1');
replace('buildSrc/build.gradle.kts', /com\.android\.tools\.build:gradle:[\d.]+/g, 'com.android.tools.build:gradle:9.1.1');
replace('gradle/wrapper/gradle-wrapper.properties', /gradle-[\d.]+-bin\.zip/g, 'gradle-9.3.1-bin.zip');

const wrapper = resolve(root, 'gradle/wrapper/gradle-wrapper.properties');
if (/^distributionSha256Sum=/m.test(readFileSync(wrapper, 'utf8'))) {
  throw new Error('Update the pinned wrapper checksum explicitly before changing Gradle.');
}

const properties = resolve(root, 'gradle.properties');
const source = readFileSync(properties, 'utf8');
const clean = source
  .replace(/^android\.(builtInKotlin|newDsl|nonFinalResIds|r8\.optimizedResourceShrinking)=.*\r?\n?/gm, '')
  .trimEnd();
updates.push([
  properties,
  `${clean}
android.builtInKotlin=false
android.newDsl=false
android.nonFinalResIds=true
android.r8.optimizedResourceShrinking=true
`,
]);

// Gradle 9 removed Project.exec; Tauri 2.11.4 still generates it.
const tasks = readdirSync(resolve(root, 'buildSrc/src'), { recursive: true })
  .filter(file => file.endsWith('BuildTask.kt'));
if (tasks.length !== 1) throw new Error('Expected exactly one generated BuildTask.kt');

const taskPath = resolve(root, 'buildSrc/src', tasks[0]);
let task = readFileSync(taskPath, 'utf8');
if (task.includes('project.exec {')) {
  if (!task.includes('open class BuildTask : DefaultTask() {')) {
    throw new Error('Unexpected Tauri BuildTask class declaration');
  }
  task = task
    .replace(
      'open class BuildTask : DefaultTask() {',
      'open class BuildTask @javax.inject.Inject constructor(private val execOperations: org.gradle.process.ExecOperations) : DefaultTask() {',
    )
    .replaceAll('project.exec {', 'execOperations.exec {');
} else if (!task.includes('execOperations.exec {')) {
  throw new Error('Expected a known Tauri BuildTask execution API');
}
updates.push([taskPath, task]);

// Preserve the generated Kotlin JVM 1.8 target when AGP defaults Java differently.
const appPath = resolve(root, 'app/build.gradle.kts');
let app = readFileSync(appPath, 'utf8');
const marker = '// OMI AGP 9.1 Java and Kotlin target alignment';
if (!app.includes(marker)) {
  if (!/jvmTarget\s*=\s*"1\.8"/.test(app)) throw new Error('Expected generated Kotlin JVM target 1.8');
  app += `
${marker}
android {
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
}
`;
}

// Keep the workaround required by the generated Tauri dependency script.
const scriptApply = 'apply(from = "tauri.build.gradle.kts")';
const fileApply = 'apply(from = file("tauri.build.gradle.kts"))';
if (app.includes(scriptApply)) {
  app = app.replace(scriptApply, fileApply);
} else if (!app.includes(fileApply)) {
  throw new Error('Expected the generated Tauri dependency script application');
}
updates.push([appPath, app]);

for (const [file, content] of updates) writeFileSync(file, content);
console.log('Configured production AGP 9.1.1 / Gradle 9.3.1 compatibility.');
