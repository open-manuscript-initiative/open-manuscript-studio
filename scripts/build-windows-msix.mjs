import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const icons = [
  ['Square44x44Logo.png', 'Square44x44Logo.png'],
  ['Square150x150Logo.png', 'Square150x150Logo.png'],
  ['StoreLogo.png', 'StoreLogo.png'],
];

export function validateMsixIdentity({ identity, publisher, version }) {
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]{2,49}$/.test(identity ?? '') || identity.includes('..')) {
    throw new Error('MSIX_IDENTITY must be a stable package identity (3-50 letters, numbers, dots or hyphens).');
  }
  // Parse the certificate Subject in linear time: a repeated, ambiguous regex can
  // backtrack exponentially on adversarial DNs (CodeQL js/inefficient-regular-expression).
  // Deliberately reject escaped commas, controls and unsupported RDN types until
  // an exact certificate Subject is verified for the selected distribution channel.
  const subject = typeof publisher === 'string' ? publisher : '';
  const parts = subject.split(',');
  const allowed = new Set(['CN', 'O', 'OU', 'L', 'S', 'ST', 'C']);
  const validSubject = subject.length >= 5 && subject.length <= 256 && parts.length <= 12
    && parts.every((raw, index) => {
      const part = raw.trim();
      const separator = part.indexOf('=');
      if (separator < 1) return false;
      const key = part.slice(0, separator);
      const value = part.slice(separator + 1);
      return (index === 0 ? key === 'CN' : allowed.has(key))
        && value.length >= (index === 0 ? 2 : 1)
        && value === value.trim()
        && [...value].every(char => !'<>"&='.includes(char) && char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 92 && char.charCodeAt(0) !== 127);
    });
  if (!validSubject || /placeholder|example|contoso|test/i.test(subject)) {
    throw new Error('MSIX_PUBLISHER must exactly match the validated signing certificate Subject / Partner Center publisher (no placeholders).');
  }
  if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(version ?? '') ||
      version.split('.').some(n => Number(n) > 65535)) {
    throw new Error('MSIX version must be four unsigned 16-bit integers (e.g., 1.0.0.1).');
  }
}

const xmlEscape = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderMsixManifest({ identity, publisher, version }) {
  validateMsixIdentity({ identity, publisher, version });
  return `<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
         xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
         xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
         IgnorableNamespaces="uap rescap">
  <Identity Name="${xmlEscape(identity)}" Publisher="${xmlEscape(publisher)}" Version="${version}" ProcessorArchitecture="x64" />
  <Properties>
    <DisplayName>Open Manuscript Studio</DisplayName>
    <PublisherDisplayName>Open Manuscript Initiative</PublisherDisplayName>
    <Description>Open Manuscript Studio scholarly writing and publishing</Description>
    <Logo>Assets\\StoreLogo.png</Logo>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.19041.0" MaxVersionTested="10.0.26100.0" />
  </Dependencies>
  <Resources><Resource Language="en-us" /></Resources>
  <Applications>
    <Application Id="Studio" Executable="open-manuscript-studio.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements DisplayName="Open Manuscript Studio"
                          Description="Open Manuscript Studio"
                          BackgroundColor="transparent"
                          Square150x150Logo="Assets\\Square150x150Logo.png"
                          Square44x44Logo="Assets\\Square44x44Logo.png" />
      <Extensions>
        <uap:Extension Category="windows.protocol"><uap:Protocol Name="openmanuscript" /></uap:Extension>
      </Extensions>
    </Application>
  </Applications>
  <Capabilities><rescap:Capability Name="runFullTrust" /></Capabilities>
</Package>
`;
}

export async function prepareMsixStage({ exe, outputDir, identity, publisher, appVersion, wixVersion, iconDir = join(root, 'src-tauri/icons') }) {
  validateMsixIdentity({ identity, publisher, version: wixVersion });
  if (appVersion !== (await readFile(join(root, 'src-tauri/tauri.conf.json'), 'utf8').then(s => JSON.parse(s).version))) {
    throw new Error('MSIX app version differs from Tauri release version.');
  }
  if ((await stat(exe)).size < 1) throw new Error('Empty Tauri executable.');
  await mkdir(outputDir, { recursive: false });
  await copyFile(exe, join(outputDir, 'open-manuscript-studio.exe'));
  await mkdir(join(outputDir, 'Assets'));
  for (const [source, destination] of icons) {
    await copyFile(join(iconDir, source), join(outputDir, 'Assets', destination));
  }
  const manifest = renderMsixManifest({ identity, publisher, version: wixVersion });
  await writeFile(join(outputDir, 'AppxManifest.xml'), manifest, { flag: 'wx' });
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [exe, stage, identity, publisher] = process.argv.slice(2);
    if (!exe || !stage || !identity || !publisher) throw new Error('Usage: node scripts/build-windows-msix.mjs <built-exe> <fresh-stage-dir> <reserved-package-identity> <exact-publisher-DN>');
    const tauri = JSON.parse(await readFile(join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
    await prepareMsixStage({ exe: resolve(exe), outputDir: resolve(stage), identity, publisher,
      appVersion: tauri.version, wixVersion: tauri.bundle?.windows?.wix?.version });
    console.log(`Prepared MSIX stage for ${tauri.version} (MSIX ${tauri.bundle.windows.wix.version}), unsigned.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
