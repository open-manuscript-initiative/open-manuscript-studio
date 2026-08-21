import fs from 'node:fs';
import path from 'node:path';

const gradlePath = path.resolve(
  process.cwd(),
  'src-tauri',
  'gen',
  'android',
  'app',
  'build.gradle.kts',
);

if (!fs.existsSync(gradlePath)) {
  throw new Error(
    `Android Gradle project not found at ${gradlePath}. Run \"npm run android:init\" first.`,
  );
}

let source = fs.readFileSync(gradlePath, 'utf8');

const imports = [
  'import java.io.FileInputStream',
  'import java.util.Properties',
];

for (const importLine of imports.reverse()) {
  if (!source.includes(importLine)) {
    source = `${importLine}\n${source}`;
  }
}

const signingBlock = `    signingConfigs {
        create("release") {
            val keystorePropertiesFile = rootProject.file("keystore.properties")
            val keystoreProperties = Properties()

            if (!keystorePropertiesFile.exists()) {
                throw GradleException("Missing keystore.properties for Android release signing")
            }

            keystoreProperties.load(FileInputStream(keystorePropertiesFile))

            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["password"] as String
            storeFile = file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["password"] as String
        }
    }

`;

if (!source.includes('create("release")')) {
  const buildTypesMarker = '    buildTypes {';
  const markerIndex = source.indexOf(buildTypesMarker);

  if (markerIndex < 0) {
    throw new Error('Could not locate the Android buildTypes block.');
  }

  source =
    source.slice(0, markerIndex) +
    signingBlock +
    source.slice(markerIndex);
}

const releaseMarker = '        getByName("release") {';
const signingLine = '            signingConfig = signingConfigs.getByName("release")';

if (!source.includes(signingLine)) {
  const releaseIndex = source.indexOf(releaseMarker);

  if (releaseIndex < 0) {
    throw new Error('Could not locate the Android release build type.');
  }

  const insertionPoint = releaseIndex + releaseMarker.length;
  source =
    source.slice(0, insertionPoint) +
    `\n${signingLine}` +
    source.slice(insertionPoint);
}

fs.writeFileSync(gradlePath, source, 'utf8');
console.log(`Configured Android release signing in ${gradlePath}`);
