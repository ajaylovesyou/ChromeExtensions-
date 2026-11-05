const fs = require('fs');

function checkFile(htmlPath, jsPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const js = fs.readFileSync(jsPath, 'utf8');

  const idRegex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
  let match;
  const missing = [];
  const found = [];

  while ((match = idRegex.exec(js)) !== null) {
    const id = match[1];
    if (!html.includes(`id="${id}"`) && !html.includes(`id='${id}'`)) {
      missing.push(id);
    } else {
      found.push(id);
    }
  }

  console.log(`Results for ${jsPath}:`);
  console.log(`  Found IDs: ${found.length}`);
  if (missing.length > 0) {
    console.error(`  MISSING IDs (${missing.length}):`, [...new Set(missing)]);
  } else {
    console.log(`  ALL ${found.length} IDs verified in HTML! 0 missing.`);
  }
}

checkFile(
  'E:/Goal/Extension/Bitwarden Password Manager - Store and autofill passwords and passkeys/popup/popup.html',
  'E:/Goal/Extension/Bitwarden Password Manager - Store and autofill passwords and passkeys/popup/popup.js'
);

checkFile(
  'E:/Goal/Extension/Bitwarden Password Manager - Store and autofill passwords and passkeys/options/options.html',
  'E:/Goal/Extension/Bitwarden Password Manager - Store and autofill passwords and passkeys/options/options.js'
);
