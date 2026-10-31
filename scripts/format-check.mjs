import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('[FORMAT:CHECK] Verifying JSON files and structural integrity...');

const jsonFiles = [
  'package.json',
  'tsconfig.json',
  'manifests/manifest.chromium.json',
  'manifests/manifest.firefox.json'
];

let hasError = false;

for (const relPath of jsonFiles) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`[FORMAT:CHECK] ✗ Missing required configuration file: ${relPath}`);
    hasError = true;
    continue;
  }

  try {
    const raw = fs.readFileSync(fullPath, 'utf8');
    JSON.parse(raw);
    console.log(`[FORMAT:CHECK] ✓ Valid JSON: ${relPath}`);
  } catch (err) {
    console.error(`[FORMAT:CHECK] ✗ Invalid JSON in ${relPath}:`, err.message);
    hasError = true;
  }
}

if (hasError) {
  console.error('[FORMAT:CHECK] Format check failed.');
  process.exit(1);
}

console.log('[FORMAT:CHECK] ✓ All formatting and JSON checks passed.');
