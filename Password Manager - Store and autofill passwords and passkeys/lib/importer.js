/**
 * Bitwarden Password Manager - Import & Export Engine
 * Full compatibility with Bitwarden JSON/CSV, Chrome Passwords CSV, and 1Password formats.
 * Includes instant Demo Vault Seeder for hassle-free testing.
 */

const BitImporter = (function() {
  'use strict';

  /**
   * Parse CSV string into array of object rows
   */
  function parseCSV(text) {
    text = text.replace(/^\uFEFF/, ''); // strip BOM
    const rows = [];
    let row = [];
    let token = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (insideQuotes && text[i + 1] === '"') {
          token += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (c === ',' && !insideQuotes) {
        row.push(token.trim());
        token = '';
      } else if ((c === '\r' || c === '\n') && !insideQuotes) {
        if (c === '\r' && text[i + 1] === '\n') {
          i++;
        }
        row.push(token.trim());
        token = '';
        if (row.some(cell => cell.length > 0)) {
          rows.push(row);
        }
        row = [];
      } else {
        token += c;
      }
    }
    if (token.length > 0 || row.length > 0) {
      row.push(token.trim());
      if (row.some(cell => cell.length > 0)) {
        rows.push(row);
      }
    }
    return rows;
  }

  /**
   * Escape CSV cell
   */
  function escapeCSVCell(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  }

  /**
   * Export vault items to standard Bitwarden JSON
   */
  function exportToBitwardenJSON(items, folders = []) {
    return JSON.stringify({
      encrypted: false,
      exportVersion: 1,
      passwordManager: 'Bitwarden',
      folders: folders.map(f => ({ id: f.id, name: f.name })),
      items: items.map(item => ({
        id: item.id,
        organizationId: null,
        folderId: item.folderId || null,
        type: item.type === 'card' ? 3 : item.type === 'note' ? 2 : item.type === 'identity' ? 4 : 1,
        name: item.name,
        notes: item.notes || null,
        favorite: !!item.favorite,
        login: (item.type === 'login' || !item.type) ? {
          uris: [{ match: null, uri: item.uri || '' }],
          username: item.username || '',
          password: item.password || '',
          totp: item.totpSecret || null
        } : null,
        card: item.type === 'card' ? {
          cardholderName: item.cardholderName || '',
          brand: item.brand || 'Visa',
          number: item.number || '',
          expMonth: item.expMonth || '',
          expYear: item.expYear || '',
          code: item.code || ''
        } : null,
        secureNote: item.type === 'note' ? { type: 0 } : null,
        passkey: item.type === 'passkey' ? {
          rpId: item.rpId,
          userName: item.userName,
          credentialId: item.credentialId,
          publicKey: item.publicKey
        } : null
      }))
    }, null, 2);
  }

  /**
   * Export vault items to Bitwarden CSV format
   */
  function exportToBitwardenCSV(items) {
    const headers = ['folder', 'favorite', 'type', 'name', 'notes', 'fields', 'reprompt', 'login_uri', 'login_username', 'login_password', 'login_totp'];
    const lines = [headers.join(',')];

    items.forEach(item => {
      const typeStr = item.type === 'card' ? 'card' : item.type === 'note' ? 'secure_note' : 'login';
      const row = [
        item.folder || '',
        item.favorite ? '1' : '0',
        typeStr,
        item.name || '',
        item.notes || '',
        '',
        '0',
        item.uri || '',
        item.username || '',
        item.password || '',
        item.totpSecret || ''
      ];
      lines.push(row.map(escapeCSVCell).join(','));
    });

    return lines.join('\r\n');
  }

  /**
   * Import from file content (supports JSON or CSV)
   */
  function importVaultData(contentStr) {
    const trimmed = contentStr.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return importFromJSON(trimmed);
    } else {
      return importFromCSV(trimmed);
    }
  }

  function importFromJSON(jsonStr) {
    const parsed = JSON.parse(jsonStr);
    const rawItems = Array.isArray(parsed) ? parsed : (parsed.items || []);
    const items = [];

    rawItems.forEach(r => {
      let type = 'login';
      if (r.type === 2 || r.secureNote) type = 'note';
      else if (r.type === 3 || r.card) type = 'card';
      else if (r.type === 4) type = 'identity';
      else if (r.type === 'passkey' || r.passkey) type = 'passkey';

      const item = {
        id: r.id || BitCrypto.generateUUID(),
        name: r.name || 'Untitled Item',
        type,
        notes: r.notes || '',
        favorite: !!r.favorite,
        folderId: r.folderId || null,
        createdAt: r.createdAt || new Date().toISOString(),
        updatedAt: r.updatedAt || new Date().toISOString()
      };

      if (type === 'login') {
        const login = r.login || {};
        const uris = login.uris || [];
        item.uri = uris[0]?.uri || r.uri || '';
        item.username = login.username || r.username || '';
        item.password = login.password || r.password || '';
        item.totpSecret = login.totp || r.totpSecret || null;
      } else if (type === 'card') {
        const card = r.card || {};
        item.cardholderName = card.cardholderName || r.cardholderName || '';
        item.brand = card.brand || r.brand || 'Visa';
        item.number = card.number || r.number || '';
        item.expMonth = card.expMonth || r.expMonth || '';
        item.expYear = card.expYear || r.expYear || '';
        item.code = card.code || r.code || '';
      } else if (type === 'passkey') {
        const pk = r.passkey || {};
        item.rpId = pk.rpId || r.rpId || '';
        item.userName = pk.userName || r.userName || '';
        item.credentialId = pk.credentialId || r.credentialId || '';
        item.publicKey = pk.publicKey || r.publicKey || '';
      }

      items.push(item);
    });

    return items;
  }

  function importFromCSV(csvStr) {
    const rows = parseCSV(csvStr);
    if (rows.length < 2) return [];

    const headers = rows[0].map(h => h.toLowerCase().replace(/[\s_]/g, ''));
    const items = [];

    // Helper to find column index by potential names
    function findCol(...candidates) {
      return headers.findIndex(h => candidates.some(c => h === c || h.includes(c)));
    }

    const nameIdx = findCol('name', 'title');
    const uriIdx = findCol('loginuri', 'url', 'website', 'address');
    const userIdx = findCol('loginusername', 'username', 'user', 'email');
    const passIdx = findCol('loginpassword', 'password', 'pass');
    const totpIdx = findCol('logintotp', 'totp', '2fa');
    const notesIdx = findCol('notes', 'note', 'comment');
    const favIdx = findCol('favorite', 'fav');

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length === 0 || !row.some(cell => cell.length > 0)) continue;

      const uri = uriIdx !== -1 ? row[uriIdx] || '' : '';
      const name = nameIdx !== -1 && row[nameIdx] ? row[nameIdx] : (uri || 'Imported Account');
      const username = userIdx !== -1 ? row[userIdx] || '' : '';
      const password = passIdx !== -1 ? row[passIdx] || '' : '';
      const totpSecret = totpIdx !== -1 ? row[totpIdx] || '' : '';
      const notes = notesIdx !== -1 ? row[notesIdx] || '' : '';
      const favorite = favIdx !== -1 ? (row[favIdx] === '1' || row[favIdx]?.toLowerCase() === 'true') : false;

      items.push({
        id: BitCrypto.generateUUID(),
        type: 'login',
        name,
        uri,
        username,
        password,
        totpSecret: totpSecret || null,
        notes,
        favorite,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    return items;
  }

  /**
   * Generate complete demo vault for instant onboarding
   */
  async function generateDemoVault() {
    // Generate an authentic sample passkey for github.com
    const githubPasskey = await BitPasskey.generatePasskey('github.com', 'alex.developer', 'Alex Developer');

    const demoItems = [
      {
        id: BitCrypto.generateUUID(),
        type: 'login',
        name: 'GitHub',
        uri: 'https://github.com/login',
        username: 'alex.developer',
        password: 'kX9#mP2$vL8!qR5@',
        totpSecret: 'JBSWY3DPEHPK3PXP', // standard test base32 seed
        favorite: true,
        folder: 'Work',
        notes: 'Main software development repository and enterprise access.',
        createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: BitCrypto.generateUUID(),
        type: 'login',
        name: 'Google Account',
        uri: 'https://accounts.google.com',
        username: 'alex.carter@gmail.com',
        password: 'wN8&tB3^kL9*mQ4#',
        totpSecret: 'HXDMVJECJJWSRB3H',
        favorite: true,
        folder: 'Personal',
        notes: 'Primary personal email, drive and cloud backups.',
        createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: BitCrypto.generateUUID(),
        type: 'login',
        name: 'Chase Online Banking',
        uri: 'https://secure05c.chase.com',
        username: 'acarter_banking',
        password: 'P@ssw0rdSecureChase99!',
        totpSecret: 'MFRGGZDFMZTWQ2LK',
        favorite: true,
        folder: 'Finance',
        notes: 'Checking and high-yield savings account portal.',
        createdAt: new Date(Date.now() - 45 * 86400000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: BitCrypto.generateUUID(),
        type: 'login',
        name: 'Netflix',
        uri: 'https://www.netflix.com/login',
        username: 'alex.carter@gmail.com',
        password: 'Streaming2026Password!',
        totpSecret: null,
        favorite: false,
        folder: 'Personal',
        notes: 'Family Premium 4K plan.',
        createdAt: new Date(Date.now() - 100 * 86400000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: BitCrypto.generateUUID(),
        type: 'login',
        name: 'Amazon Prime',
        uri: 'https://www.amazon.com/ap/signin',
        username: 'alex.carter@gmail.com',
        password: 'PrimeShop#2026Secure',
        totpSecret: null,
        favorite: false,
        folder: 'Shopping',
        notes: 'Prime delivery & digital video account.',
        createdAt: new Date(Date.now() - 120 * 86400000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      githubPasskey,
      {
        id: BitCrypto.generateUUID(),
        type: 'card',
        name: 'Chase Sapphire Preferred',
        cardholderName: 'Alex Carter',
        brand: 'Visa',
        number: '4147202688419012',
        expMonth: '09',
        expYear: '2028',
        code: '384',
        favorite: true,
        folder: 'Finance',
        notes: 'Primary travel rewards card with 3x points on dining.',
        createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: BitCrypto.generateUUID(),
        type: 'note',
        name: 'Home Office Wi-Fi & Server Keys',
        favorite: false,
        folder: 'Personal',
        notes: "### Home Office Wi-Fi\nSSID: `CyberVault-5G`\nWPA3 Key: `quantum-radiance-autumn-74`\n\n### Local NAS Server\nIP: `192.168.1.120`\nAdmin user: `sysadmin`",
        createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    return demoItems;
  }

  return {
    exportToBitwardenJSON,
    exportToBitwardenCSV,
    importVaultData,
    generateDemoVault
  };
})();

if (typeof globalThis !== 'undefined') {
  globalThis.BitImporter = BitImporter;
}
if (typeof window !== 'undefined') {
  window.BitImporter = BitImporter;
}
if (typeof self !== 'undefined') {
  self.BitImporter = BitImporter;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BitImporter;
}
