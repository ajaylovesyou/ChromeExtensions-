const fs = require('fs');

const root = 'E:/Goal/Extension/Bitwarden Password Manager - Store and autofill passwords and passkeys';

function checkJsClasses(jsPath, cssPath) {
  const js = fs.readFileSync(jsPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');

  const jsClassMatches = js.matchAll(/className\s*=\s*['"`]([^'"`]+)['"`]|classList\.(?:add|toggle)\(['"`]([^'"`]+)['"`]/g);
  const jsClasses = new Set();
  for (const m of jsClassMatches) {
    const cls = m[1] || m[2];
    cls.split(/\s+/).filter(Boolean).forEach(c => jsClasses.add(c));
  }

  const missing = [];
  for (const c of jsClasses) {
    const regex = new RegExp('\\.' + c.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '(?![a-zA-Z0-9_-])');
    if (!regex.test(css)) {
      missing.push(c);
    }
  }

  console.log(`\n=== JS CLASS AUDIT: ${jsPath} ===`);
  console.log('Total JS classes:', jsClasses.size);
  console.log('Missing in CSS (' + missing.length + '):', missing);
}

checkJsClasses(root + '/popup/popup.js', root + '/popup/popup.css');
checkJsClasses(root + '/options/options.js', root + '/options/options.css');
