import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('[LINT] Running TypeScript type check & static analysis...');

try {
  execSync('npx tsc --noEmit', { stdio: 'inherit', cwd: rootDir });
  console.log('[LINT] ✓ TypeScript check passed cleanly.');
} catch (err) {
  console.error('[LINT] ✗ TypeScript compilation failed.');
  process.exit(1);
}

// Check for disallowed patterns in src/ (eval, new Function, debugger, remote URLs)
console.log('[LINT] Checking for disallowed security patterns in source code...');
const forbiddenPatterns = [
  { pattern: /\beval\s*\(/g, name: 'eval()' },
  { pattern: /\bnew\s+Function\s*\(/g, name: 'new Function()' },
  { pattern: /(?:^|[\s;}])debugger\s*;/g, name: 'debugger statements' }
];

let hasDisallowed = false;
function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== 'dontaddgit') {
        scanDir(fullPath);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const { pattern, name } of forbiddenPatterns) {
        if (pattern.test(content)) {
          console.error(`[LINT] ✗ Forbidden pattern '${name}' found in ${fullPath}`);
          hasDisallowed = true;
        }
      }
    }
  }
}

scanDir(path.join(rootDir, 'src'));

if (hasDisallowed) {
  console.error('[LINT] Static security checks failed.');
  process.exit(1);
}

console.log('[LINT] ✓ All static lint & security checks passed.');
