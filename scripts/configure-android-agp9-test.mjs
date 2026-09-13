// Experimental only: deliberately not called by release workflows.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const mode = process.argv[2];
if (!['defaults', 'compatibility'].includes(mode)) {
  throw new Error('Usage: node scripts/configure-android-agp9-test.mjs defaults|compatibility');
}
const root = resolve('src-tauri/gen/android');
const updates = [];
function replace(file, pattern, replacement) {
  const path = resolve(root, file);
  const source = readFileSync(path, 'utf8');
  if (!pattern.test(source)) throw new Error(`Expected generated setting missing: ${file}`);
  updates.push([path, source.replace(pattern, replacement)]);
}
replace('build.gradle.kts', /com\.android\.tools\.build:gradle:[\d.]+/g, 'com.android.tools.build:gradle:9.0.1');
replace('buildSrc/build.gradle.kts', /com\.android\.tools\.build:gradle:[\d.]+/g, 'com.android.tools.build:gradle:9.0.1');
replace('gradle/wrapper/gradle-wrapper.properties', /gradle-[\d.]+-bin\.zip/g, 'gradle-9.1.0-bin.zip');
const properties = resolve(root, 'gradle.properties');
const source = readFileSync(properties, 'utf8');
if (/^distributionSha256Sum=/m.test(readFileSync(resolve(root, 'gradle/wrapper/gradle-wrapper.properties'), 'utf8'))) {
  throw new Error('Update the pinned wrapper checksum explicitly before changing Gradle.');
}
const clean = source.replace(/^android\.(builtInKotlin|newDsl)=.*\r?\n?/gm, '').trimEnd();
updates.push([properties, `${clean}\nandroid.builtInKotlin=${mode === 'defaults'}\nandroid.newDsl=${mode === 'defaults'}\n`]);
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
  task = task.replace('open class BuildTask : DefaultTask() {',
    'open class BuildTask @javax.inject.Inject constructor(private val execOperations: org.gradle.process.ExecOperations) : DefaultTask() {')
    .replaceAll('project.exec {', 'execOperations.exec {');
} else if (!task.includes('execOperations.exec {')) {
  throw new Error('Expected a known Tauri BuildTask execution API');
}
updates.push([taskPath, task]);
for (const [file, content] of updates) writeFileSync(file, content);
console.log(`Experimental AGP 9.0.1 / Gradle 9.1.0: ${mode}`);
