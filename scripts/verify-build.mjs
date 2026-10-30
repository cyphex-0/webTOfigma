import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const targets = ['chromium', 'firefox'];
let hasError = false;

for (const target of targets) {
  const targetDir = path.join(rootDir, 'dist', target);
  console.log(`\nVerifying ${target} build at: ${targetDir}`);

  if (!fs.existsSync(targetDir)) {
    console.error(`ERROR: Target directory does not exist: ${targetDir}`);
    hasError = true;
    continue;
  }

  const manifestPath = path.join(targetDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`ERROR: Missing manifest.json in ${target}`);
    hasError = true;
    continue;
  }

  try {
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    console.log(`  ✓ manifest.json is valid JSON (version ${manifest.version})`);

    // Check icons
    if (manifest.icons) {
      for (const [size, iconRelPath] of Object.entries(manifest.icons)) {
        const iconFullPath = path.join(targetDir, iconRelPath);
        if (!fs.existsSync(iconFullPath)) {
          console.error(`  ERROR: Missing icon ${size} at ${iconFullPath}`);
          hasError = true;
        } else {
          console.log(`  ✓ Icon ${size} exists (${fs.statSync(iconFullPath).size} bytes)`);
        }
      }
    }

    // Check popup
    if (manifest.action?.default_popup) {
      const popupPath = path.join(targetDir, manifest.action.default_popup);
      if (!fs.existsSync(popupPath)) {
        console.error(`  ERROR: Missing popup HTML at ${popupPath}`);
        hasError = true;
      } else {
        console.log(`  ✓ Popup HTML exists: ${manifest.action.default_popup}`);
      }
    }

    // Check options
    if (manifest.options_ui?.page) {
      const optionsPath = path.join(targetDir, manifest.options_ui.page);
      if (!fs.existsSync(optionsPath)) {
        console.error(`  ERROR: Missing options HTML at ${optionsPath}`);
        hasError = true;
      } else {
        console.log(`  ✓ Options HTML exists: ${manifest.options_ui.page}`);
      }
    }

    // Check background entry
    if (target === 'chromium') {
      const swRelPath = manifest.background?.service_worker;
      if (!swRelPath || !fs.existsSync(path.join(targetDir, swRelPath))) {
        console.error(`  ERROR: Chromium background service worker missing: ${swRelPath}`);
        hasError = true;
      } else {
        console.log(`  ✓ Chromium service worker exists: ${swRelPath}`);
      }
    } else if (target === 'firefox') {
      const scripts = manifest.background?.scripts || [];
      if (scripts.length === 0 || !fs.existsSync(path.join(targetDir, scripts[0]))) {
        console.error(`  ERROR: Firefox background script missing: ${scripts[0]}`);
        hasError = true;
      } else {
        console.log(`  ✓ Firefox background script exists: ${scripts[0]}`);
      }

      if (!manifest.browser_specific_settings?.gecko?.id) {
        console.error(`  ERROR: Firefox manifest missing gecko.id`);
        hasError = true;
      } else {
        console.log(`  ✓ Firefox gecko.id present: ${manifest.browser_specific_settings.gecko.id}`);
      }
    }

  } catch (err) {
    console.error(`  ERROR: Failed to parse manifest.json:`, err);
    hasError = true;
  }
}

if (hasError) {
  console.error('\n❌ Build verification FAILED.');
  process.exit(1);
} else {
  console.log('\n✅ All extension packages verified successfully.');
}
