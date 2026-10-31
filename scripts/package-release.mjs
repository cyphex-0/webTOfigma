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

console.log(`\n========================================`);
console.log(`Packaging Production Release Archives (v${version})`);
console.log(`========================================\n`);

// 1. Build extension
console.log('[PACKAGE] Building clean distribution packages...');
execSync('npm run build:all', { stdio: 'inherit', cwd: rootDir });

const targets = ['chromium', 'firefox'];
const hashes = [];

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
}

// Write checksums file
const checksumsPath = path.join(releaseDir, 'SHA256SUMS.txt');
fs.writeFileSync(checksumsPath, hashes.join('\n') + '\n', 'utf8');
console.log(`[PACKAGE] ✓ Checksums written to ${checksumsPath}`);
console.log(`\n✅ Production release packages created successfully.\n`);
