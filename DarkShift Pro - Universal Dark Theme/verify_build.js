const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.join('E:', 'Goal', 'Extension', 'DarkShift Pro - Universal Dark Theme');

console.log('--- Verifying DarkShift Pro Extension ---');

// 1. Manifest verification
const manifestPath = path.join(rootDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('FAIL: manifest.json does not exist');
  process.exit(1);
}

const manifestRaw = fs.readFileSync(manifestPath, 'utf8');
let manifest;
try {
  manifest = JSON.parse(manifestRaw);
  console.log(`[PASS] manifest.json is valid (v${manifest.version}: ${manifest.name})`);
} catch (e) {
  console.error('FAIL: manifest.json JSON parse error:', e.message);
  process.exit(1);
}

// 2. Syntax validation for JS files
const jsFiles = [
  'background.js',
  'content.js',
  'popup/popup.js',
  'options/options.js'
];

jsFiles.forEach(file => {
  const fullPath = path.join(rootDir, file);
  if (!fs.existsSync(fullPath)) {
    console.error(`FAIL: ${file} missing`);
    process.exit(1);
  }
  try {
    execSync(`node --check "${fullPath}"`);
    console.log(`[PASS] Syntax check OK: ${file}`);
  } catch (err) {
    console.error(`FAIL: Syntax error in ${file}:`, err.message);
    process.exit(1);
  }
});

// 3. Check all assets referenced in manifest.json
const iconSizes = ['16', '32', '48', '128'];
iconSizes.forEach(s => {
  const iconPath = path.join(rootDir, manifest.icons[s]);
  if (!fs.existsSync(iconPath)) {
    console.error(`FAIL: icon ${s} missing at ${iconPath}`);
    process.exit(1);
  }
  const stat = fs.statSync(iconPath);
  console.log(`[PASS] Icon ${s} exists (${stat.size} bytes)`);
});

// 4. CSS files
const cssFiles = [
  'themes/smart-invert.css',
  'themes/dynamic-dark.css',
  'themes/oled-dark.css',
  'popup/popup.css',
  'options/options.css'
];

cssFiles.forEach(c => {
  const full = path.join(rootDir, c);
  if (!fs.existsSync(full)) {
    console.error(`FAIL: CSS file missing: ${c}`);
    process.exit(1);
  }
  const stat = fs.statSync(full);
  console.log(`[PASS] CSS ${c} OK (${stat.size} bytes)`);
});

// 5. HTML files
['popup/popup.html', 'options/options.html'].forEach(h => {
  const full = path.join(rootDir, h);
  if (!fs.existsSync(full)) {
    console.error(`FAIL: HTML file missing: ${h}`);
    process.exit(1);
  }
  const stat = fs.statSync(full);
  console.log(`[PASS] HTML ${h} OK (${stat.size} bytes)`);
});

console.log('\nAll checks passed successfully! Extension is ready for deployment.');
