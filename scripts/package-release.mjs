import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
const version = pkg.version || '0.1.0';

const releaseDir = path.join(rootDir, 'release');
if (!fs.existsSync(releaseDir)) {
  fs.mkdirSync(releaseDir, { recursive: true });
}

const docsReleaseDir = path.join(rootDir, 'docs', 'release');
if (!fs.existsSync(docsReleaseDir)) {
  fs.mkdirSync(docsReleaseDir, { recursive: true });
}

console.log(`\n========================================`);
console.log(`Packaging Production Release Archives (v${version})`);
console.log(`========================================\n`);

// 1. Build extension
console.log('[PACKAGE] Building clean distribution packages...');
execSync('npm run build:all', { stdio: 'inherit', cwd: rootDir });

const targets = ['chromium', 'firefox'];
const hashes = [];
const packageMetadata = {};

for (const target of targets) {
  const sourceDir = path.join(rootDir, 'dist', target);
  const zipFileName = `web-to-figma-exporter-${target}-v${version}.zip`;
  const zipFilePath = path.join(releaseDir, zipFileName);

  if (fs.existsSync(zipFilePath)) {
    fs.unlinkSync(zipFilePath);
  }

  console.log(`[PACKAGE] Compressing ${target} package -> ${zipFileName}...`);

  if (process.platform === 'win32') {
    // Use PowerShell Compress-Archive
    const psCmd = `Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${zipFilePath}' -Force`;
    execSync(`powershell -Command "${psCmd}"`, { stdio: 'inherit' });
  } else {
    // Unix zip command
    execSync(`cd "${sourceDir}" && zip -r "${zipFilePath}" ./*`, { stdio: 'inherit' });
  }

  if (!fs.existsSync(zipFilePath)) {
    console.error(`[PACKAGE] ✗ Failed to create zip archive: ${zipFilePath}`);
    process.exit(1);
  }

  const stat = fs.statSync(zipFilePath);
  const buffer = fs.readFileSync(zipFilePath);
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  console.log(`[PACKAGE] ✓ ${zipFileName} (${(stat.size / 1024).toFixed(1)} KB)`);
  console.log(`          SHA-256: ${sha256}`);
  hashes.push(`${sha256}  ${zipFileName}`);

  packageMetadata[target] = {
    file: zipFileName,
    sha256,
    sizeBytes: stat.size,
    targetEngine: target === 'chromium' ? 'Chromium MV3 Service Worker' : 'Gecko MV3 Event Page'
  };
}

// Write checksums file
const checksumsPath = path.join(releaseDir, 'SHA256SUMS.txt');
fs.writeFileSync(checksumsPath, hashes.join('\n') + '\n', 'utf8');
console.log(`[PACKAGE] ✓ Checksums written to ${checksumsPath}`);

// Git commit & npm version metadata
let gitCommit = 'unknown';
try {
  gitCommit = execSync('git rev-parse HEAD', { cwd: rootDir }).toString().trim();
} catch {}

let npmVersion = 'unknown';
try {
  npmVersion = execSync('npm -v', { cwd: rootDir }).toString().trim();
} catch {}

const lockfilePath = path.join(rootDir, 'package-lock.json');
const lockfileHash = fs.existsSync(lockfilePath)
  ? crypto.createHash('sha256').update(fs.readFileSync(lockfilePath)).digest('hex')
  : 'unknown';

// Generate docs/release/release-manifest.json
const releaseManifest = {
  version,
  sourceCommit: gitCommit,
  buildTimestamp: new Date().toISOString(),
  environment: {
    nodeVersion: process.version,
    npmVersion,
    lockfileSha256: lockfileHash,
    platform: process.platform,
    arch: process.arch
  },
  minimumBrowserVersions: {
    chrome: '116+',
    edge: '116+',
    brave: '1.58+ (Chromium 116+)',
    firefox: '120+'
  },
  supportedOperatingSystems: [
    'Windows 10 / 11 (x64, arm64)',
    'macOS 12+ (Intel, Apple Silicon)',
    'Linux (x64, arm64)'
  ],
  artifacts: packageMetadata,
  documentation: {
    sbom: 'docs/release/dependency-inventory.md',
    releaseCandidateReport: 'docs/release/release-candidate-report.md',
    compatibilityMatrix: 'docs/release/four-browser-compatibility-matrix.md',
    threatModel: 'docs/security/threat-model.md',
    privacyPolicy: 'docs/privacy/privacy-policy.md'
  }
};

const releaseManifestPath = path.join(docsReleaseDir, 'release-manifest.json');
fs.writeFileSync(releaseManifestPath, JSON.stringify(releaseManifest, null, 2) + '\n', 'utf8');
console.log(`[PACKAGE] ✓ Release manifest written to ${releaseManifestPath}`);

console.log(`\n✅ Production release packages created successfully.\n`);
