const fs = require('fs');
const path = require('path');

const root = 'E:/Goal/Extension/Bitwarden Password Manager - Store and autofill passwords and passkeys';

function audit(htmlFile, cssFile) {
  const html = fs.readFileSync(path.join(root, htmlFile), 'utf8');
  const css = fs.readFileSync(path.join(root, cssFile), 'utf8');

  const classMatches = html.matchAll(/class=["']([^"']+)["']/g);
  const htmlClasses = new Set();
  for (const m of classMatches) {
    m[1].split(/\s+/).filter(Boolean).forEach(c => htmlClasses.add(c));
  }

  const missing = [];
  for (const c of htmlClasses) {
    // Check if selector exists in css
    const regex = new RegExp('\\.' + c.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?![a-zA-Z0-9_-])');
    if (!regex.test(css)) {
      missing.push(c);
    }
  }

  console.log(`\n=== AUDIT: ${htmlFile} vs ${cssFile} ===`);
  console.log('Total classes in HTML:', htmlClasses.size);
  console.log('Missing classes in CSS (' + missing.length + '):', missing);
}

audit('popup/popup.html', 'popup/popup.css');
audit('options/options.html', 'options/options.css');
