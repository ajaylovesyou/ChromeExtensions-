const fs = require('fs');

function checkButtons(htmlPath, jsPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const js = fs.readFileSync(jsPath, 'utf8');

  // Find all button / input IDs in HTML
  const btnRegex = /<button[^>]+id=["']([^"']+)["']/g;
  let match;
  const unhandled = [];
  const handled = [];

  while ((match = btnRegex.exec(html)) !== null) {
    const id = match[1];
    if (js.includes(`'${id}'`) || js.includes(`"${id}"`)) {
      handled.push(id);
    } else {
      unhandled.push(id);
    }
  }

  console.log(`Button Audit for ${htmlPath}:`);
  console.log(`  Handled buttons: ${handled.length}`);
  if (unhandled.length > 0) {
    console.warn(`  UNHANDLED button IDs (${unhandled.length}):`, unhandled);
  } else {
    console.log(`  ALL ${handled.length} buttons have attached handlers!`);
  }
}

checkButtons(
  'E:/Goal/Extension/Bitwarden Password Manager - Store and autofill passwords and passkeys/popup/popup.html',
  'E:/Goal/Extension/Bitwarden Password Manager - Store and autofill passwords and passkeys/popup/popup.js'
);

checkButtons(
  'E:/Goal/Extension/Bitwarden Password Manager - Store and autofill passwords and passkeys/options/options.html',
  'E:/Goal/Extension/Bitwarden Password Manager - Store and autofill passwords and passkeys/options/options.js'
);
