import { build } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const targetArg = process.argv[2] || 'all';
const isWatch = process.argv.includes('--watch');

const targets = targetArg === 'all' ? ['chromium', 'firefox'] : [targetArg];

async function buildTarget(target) {
  const outDir = path.join(rootDir, 'dist', target);
  console.log(`\n========================================`);
  console.log(`Building extension target: [${target}]`);
  console.log(`Output directory: ${outDir}`);
  console.log(`========================================\n`);

  fs.mkdirSync(outDir, { recursive: true });

  // 1. Build UI (Popup & Options)
  await build({
    root: rootDir,
    plugins: [react()],
    resolve: {
      alias: { '@': path.resolve(rootDir, 'src') },
    },
    build: {
      outDir,
      emptyOutDir: false,
      minify: !isWatch,
      rollupOptions: {
        input: {
          popup: path.resolve(rootDir, 'src/popup/index.html'),
          options: path.resolve(rootDir, 'src/options/index.html'),
        },
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]',
        },
      },
    },
  });

  // Flatten popup and options HTML to root if generated inside src/
  const srcPopupHtml = path.join(outDir, 'src/popup/index.html');
  const srcOptionsHtml = path.join(outDir, 'src/options/index.html');
  const rootPopupHtml = path.join(outDir, 'popup.html');
  const rootOptionsHtml = path.join(outDir, 'options.html');

  if (fs.existsSync(srcPopupHtml)) {
    // Adjust relative script/asset paths if necessary
    let content = fs.readFileSync(srcPopupHtml, 'utf8');
    content = content.replace(/(href|src)="(\.\.\/\.\.\/|\/)/g, '$1="./');
    fs.writeFileSync(rootPopupHtml, content, 'utf8');
  }

  if (fs.existsSync(srcOptionsHtml)) {
    let content = fs.readFileSync(srcOptionsHtml, 'utf8');
    content = content.replace(/(href|src)="(\.\.\/\.\.\/|\/)/g, '$1="./');
    fs.writeFileSync(rootOptionsHtml, content, 'utf8');
  }

  // Remove the nested src directory inside dist
  const nestedSrc = path.join(outDir, 'src');
  if (fs.existsSync(nestedSrc)) {
    fs.rmSync(nestedSrc, { recursive: true, force: true });
  }

  // 2. Build Background Worker
  const bgEntry =
    target === 'chromium'
      ? path.resolve(rootDir, 'src/background/chromium-entry.ts')
      : path.resolve(rootDir, 'src/background/firefox-entry.ts');

  await build({
    root: rootDir,
    resolve: {
      alias: { '@': path.resolve(rootDir, 'src') },
    },
    build: {
      outDir,
      emptyOutDir: false,
      minify: !isWatch,
      lib: {
        entry: bgEntry,
        name: 'background',
        fileName: () => 'background.js',
        formats: target === 'chromium' ? ['es'] : ['iife'],
      },
      rollupOptions: {
        output: {
          extend: true,
        },
      },
    },
  });

  // 3. Build Content Script (IIFE for cross-browser reliability)
  await build({
    root: rootDir,
    resolve: {
      alias: { '@': path.resolve(rootDir, 'src') },
    },
    build: {
      outDir,
      emptyOutDir: false,
      minify: !isWatch,
      lib: {
        entry: path.resolve(rootDir, 'src/content/entry.ts'),
        name: 'WebToFigmaContent',
        fileName: () => 'content.js',
        formats: ['iife'],
      },
    },
  });

  // 4. Copy icons
  const iconsSrcDir = path.resolve(rootDir, 'public/icons');
  const iconsDestDir = path.join(outDir, 'icons');
  if (fs.existsSync(iconsSrcDir)) {
    fs.mkdirSync(iconsDestDir, { recursive: true });
    for (const file of fs.readdirSync(iconsSrcDir)) {
      fs.copyFileSync(path.join(iconsSrcDir, file), path.join(iconsDestDir, file));
    }
  }

  // 5. Copy manifest
  const manifestSrc = path.resolve(rootDir, `manifests/manifest.${target}.json`);
  const manifestDest = path.join(outDir, 'manifest.json');
  fs.copyFileSync(manifestSrc, manifestDest);

  console.log(`\n✓ Successfully packaged target: [${target}]`);
}

async function main() {
  // Ensure icons are generated
  const icon16 = path.resolve(rootDir, 'public/icons/icon-16.png');
  if (!fs.existsSync(icon16)) {
    console.log('Generating missing icons...');
    execSync('node scripts/generate-icons.mjs', { stdio: 'inherit' });
  }

  for (const target of targets) {
    await buildTarget(target);
  }

  // Run verification
  execSync('node scripts/verify-build.mjs', { stdio: 'inherit' });
}

main().catch((err) => {
  console.error('\nBuild failed with error:', err);
  process.exit(1);
});
