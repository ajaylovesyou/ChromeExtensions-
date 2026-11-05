/**
 * Bitwarden Extension Comprehensive Automated Test Suite
 * Tests all core cryptographic functions, generators, WebAuthn passkeys,
 * TOTP authenticator, Bitwarden Send, Vault storage engine, and health auditing.
 */

const assert = require('assert');

// Provide browser globals in Node.js
if (typeof global.crypto === 'undefined') {
  global.crypto = require('crypto').webcrypto;
}
if (typeof global.btoa === 'undefined') {
  global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
}
if (typeof global.atob === 'undefined') {
  global.atob = (b64) => Buffer.from(b64, 'base64').toString('binary');
}

// In-Memory Storage Mock for Chrome Storage API
const memoryStorage = {};
global.chrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        const res = {};
        const keyList = Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(keys || {}));
        keyList.forEach(k => {
          if (k in memoryStorage) res[k] = memoryStorage[k];
        });
        if (cb) cb(res);
        return Promise.resolve(res);
      },
      set: (obj, cb) => {
        Object.assign(memoryStorage, obj);
        if (cb) cb();
        return Promise.resolve();
      },
      remove: (keys, cb) => {
        const keyList = Array.isArray(keys) ? keys : [keys];
        keyList.forEach(k => delete memoryStorage[k]);
        if (cb) cb();
        return Promise.resolve();
      }
    }
  },
  runtime: {
    sendMessage: (msg, cb) => {
      if (cb) cb({ ok: true });
    }
  }
};

// Load modules
const BitCrypto = require('../lib/crypto.js');
const BitGenerator = require('../lib/generator.js');
const BitPasskey = require('../lib/passkey.js');
const BitTOTP = require('../lib/totp.js');
const BitHealth = require('../lib/health.js');
const BitSend = require('../lib/send.js');
const BitImporter = require('../lib/importer.js');
const BitVault = require('../lib/vault.js');

let passCount = 0;
let failCount = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    console.error(err.stack);
    failCount++;
  }
}

async function runAllTests() {
  console.log('====================================================');
  console.log(' BITWARDEN EXTENSION: FULL SYSTEM TEST SUITE');
  console.log('====================================================\n');

  // --- 1. CRYPTO ENGINE TESTS ---
  console.log('[TEST SUITE 1: Cryptographic Engine]');
  await test('BitCrypto.generateUUID creates valid UUID v4', () => {
    const uuid = BitCrypto.generateUUID();
    assert.strictEqual(typeof uuid, 'string');
    assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  await test('BitCrypto PBKDF2 Key Derivation & AES-256-GCM Encrypt/Decrypt Roundtrip', async () => {
    const masterPwd = 'TestMasterPassword!2026';
    const salt = BitCrypto.generateSalt();
    const key = await BitCrypto.deriveMasterKey(masterPwd, salt);

    const testPayload = {
      user: 'alice@example.com',
      secretNotes: 'Highly confidential server credentials',
      token: 994821,
      nested: { a: [1, 2, 3], b: true }
    };

    const encrypted = await BitCrypto.encrypt(testPayload, key);
    assert(encrypted.iv && encrypted.data, 'Encryption must produce IV and ciphertext');

    const decrypted = await BitCrypto.decrypt(encrypted, key);
    assert.deepStrictEqual(decrypted, testPayload, 'Decrypted payload must exactly match original');
  });

  await test('BitCrypto Master Password Hash verification', async () => {
    const masterPwd = 'MyVaultPassword#99';
    const salt = BitCrypto.generateSalt();
    const hash1 = await BitCrypto.hashMasterPassword(masterPwd, salt);
    const hash2 = await BitCrypto.hashMasterPassword(masterPwd, salt);
    const wrongHash = await BitCrypto.hashMasterPassword('WrongPassword', salt);

    assert.strictEqual(hash1, hash2, 'Identical password and salt must produce same hash');
    assert.notStrictEqual(hash1, wrongHash, 'Different password must produce different hash');
  });

  await test('BitCrypto Entropy and Password Strength Rating', () => {
    const weak = BitCrypto.ratePasswordStrength('123456');
    assert(weak.score <= 1, '123456 must be rated Weak or Very Weak');

    const strong = BitCrypto.ratePasswordStrength('pX9#mK2$vL8!qR5@');
    assert(strong.score >= 3, 'Complex 16-char password must be rated Strong or Very Strong');
    assert(strong.entropy >= 65, 'Entropy must be at least 65 bits');
  });

  // --- 2. GENERATOR TESTS ---
  console.log('\n[TEST SUITE 2: Password, Passphrase & Alias Generator]');
  await test('BitGenerator.generatePassword length and complexity constraints', () => {
    const pwd = BitGenerator.generatePassword({
      length: 24,
      uppercase: true,
      lowercase: true,
      numbers: true,
      special: true
    });
    assert.strictEqual(pwd.length, 24);
    assert.match(pwd, /[A-Z]/, 'Must contain uppercase');
    assert.match(pwd, /[a-z]/, 'Must contain lowercase');
    assert.match(pwd, /[0-9]/, 'Must contain numbers');
    assert.match(pwd, /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/, 'Must contain symbols');
  });

  await test('BitGenerator.generatePassphrase creates memorable Diceware passphrase', () => {
    const phrase = BitGenerator.generatePassphrase({
      wordCount: 4,
      separator: '-',
      capitalize: true,
      includeNumber: true
    });
    const parts = phrase.split('-');
    assert.strictEqual(parts.length, 4, 'Must contain exactly 4 words');
    assert.match(phrase, /[0-9]{2}/, 'Must include 2-digit number');
    assert.match(parts[0], /^[A-Z]/, 'Words must be capitalized');
  });

  await test('BitGenerator.generateUsername generates plus-addressing, forwarding, and random aliases', () => {
    const plus = BitGenerator.generateUsername('plus_address', 'alex@gmail.com', 'github.com');
    assert.match(plus, /^alex\+github\d+@gmail\.com$/, 'Plus-addressing must format correctly');

    const fwd = BitGenerator.generateUsername('forward_alias');
    assert.match(fwd, /@vault-alias\.com$/, 'Forwarding alias must end in @vault-alias.com');

    const rand = BitGenerator.generateUsername('random');
    assert.match(rand, /^[a-z]+_[a-z]+_\d+$/, 'Random handle must be adjective_noun_number');
  });

  // --- 3. PASSKEY WEBAUTHN TESTS ---
  console.log('\n[TEST SUITE 3: FIDO2 / WebAuthn Passkeys]');
  await test('BitPasskey.generatePasskey generates authentic ECDSA P-256 keypair', async () => {
    const passkey = await BitPasskey.generatePasskey('github.com', 'developer@octocat.com', 'Octocat Dev');
    assert.strictEqual(passkey.type, 'passkey');
    assert.strictEqual(passkey.rpId, 'github.com');
    assert.strictEqual(passkey.userName, 'developer@octocat.com');
    assert.strictEqual(passkey.algorithm, 'ES256');
    assert(passkey.publicKey && passkey.privateKey, 'Must contain public and private keys');
    assert(passkey.credentialId, 'Must have unique credential ID');
    assert(passkey.fingerprint, 'Must have public key fingerprint');

    // Test signing a challenge with this passkey
    const challenge = new TextEncoder().encode('auth-challenge-nonce-7890');
    const assertion = await BitPasskey.signChallenge(passkey, challenge);
    assert.strictEqual(assertion.credentialId, passkey.credentialId);
    assert(assertion.signature, 'Assertion must include ECDSA signature');

    // Test signature verification
    const sigBytes = BitPasskey.base64UrlToBuffer ? BitPasskey.base64UrlToBuffer(assertion.signature) : Buffer.from(assertion.signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const isValid = await BitPasskey.verifySignature(passkey, challenge, sigBytes);
    assert.strictEqual(isValid, true, 'Cryptographic ECDSA P-256 signature must verify successfully');
  });

  // --- 4. TOTP AUTHENTICATOR TESTS ---
  console.log('\n[TEST SUITE 4: RFC 6238 TOTP 2FA Authenticator]');
  await test('BitTOTP.generateTOTP generates valid 6-digit codes matching RFC standards', async () => {
    // RFC standard test secret: JBSWY3DPEHPK3PXP
    const totp = await BitTOTP.generateTOTP('JBSWY3DPEHPK3PXP');
    assert(totp, 'TOTP result must not be null');
    assert.match(totp.code, /^\d{6}$/, 'Code must be exactly 6 digits');
    assert.strictEqual(totp.period, 30);
    assert(totp.secondsRemaining >= 0 && totp.secondsRemaining <= 30);

    // Test otpauth URI parsing
    const uri = 'otpauth://totp/GitHub:alex?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&digits=6&period=30';
    const parsed = BitTOTP.parseSecret(uri);
    assert.strictEqual(parsed.secret, 'JBSWY3DPEHPK3PXP');
    assert.strictEqual(parsed.digits, 6);
  });

  // --- 5. BITWARDEN SEND TESTS ---
  console.log('\n[TEST SUITE 5: Bitwarden Send (Encrypted Secret Sharing)]');
  await test('BitSend creates ephemeral encrypted secret and decrypts with key fragment', async () => {
    const send = await BitSend.createSend({
      name: 'Server Admin Password',
      text: 'root-mysql-super-secret-key-2026',
      expirationHours: 24,
      maxAccessCount: 3
    });

    assert(send.encryptedData && send.keyFragment, 'Send must produce encrypted data and key fragment');

    const decrypted = await BitSend.decryptSend(send);
    assert.strictEqual(decrypted.text, 'root-mysql-super-secret-key-2026');
  });

  await test('BitSend with password protection verifies password', async () => {
    const send = await BitSend.createSend({
      name: 'Confidential Note',
      text: 'Meeting coordinates: 12.9716, 77.5946',
      password: 'SendProtectionPass123'
    });

    // Wrong password should throw
    await assert.rejects(
      async () => await BitSend.decryptSend(send, 'WrongPassword'),
      /Incorrect Send password/
    );

    // Correct password should succeed
    const decrypted = await BitSend.decryptSend(send, 'SendProtectionPass123');
    assert.strictEqual(decrypted.text, 'Meeting coordinates: 12.9716, 77.5946');
  });

  // --- 6. HEALTH & BREACH AUDIT TESTS ---
  console.log('\n[TEST SUITE 6: Security Health & Breach Audit Engine]');
  await test('BitHealth.auditVault detects weak, breached, reused, and missing 2FA accounts', () => {
    const items = [
      { id: '1', type: 'login', name: 'Leaked Account', uri: 'https://site1.com', username: 'user1', password: 'password', totpSecret: null },
      { id: '2', type: 'login', name: 'Google', uri: 'https://accounts.google.com', username: 'user2@gmail.com', password: 'DuplicatePassword1!', totpSecret: null },
      { id: '3', type: 'login', name: 'GitHub', uri: 'https://github.com/login', username: 'user3', password: 'DuplicatePassword1!', totpSecret: null },
      { id: '4', type: 'login', name: 'Bank', uri: 'https://bank.com', username: 'user4', password: '123', totpSecret: null }
    ];

    const audit = BitHealth.auditVault(items);
    assert(audit.score < 70, 'Score should reflect vulnerabilities');
    assert.strictEqual(audit.breachedPasswords.length, 1, 'Must detect "password" as compromised');
    assert.strictEqual(audit.reusedGroups.length, 1, 'Must detect "DuplicatePassword1!" as reused');
    assert(audit.weakPasswords.length >= 2, 'Must detect weak passwords');
    assert(audit.inactive2FA.length >= 2, 'Must detect Google & GitHub missing 2FA');
  });

  // --- 7. IMPORT & EXPORT TESTS ---
  console.log('\n[TEST SUITE 7: Data Portability (Import & Export)]');
  await test('BitImporter JSON & CSV Export / Import Roundtrip', async () => {
    const demoItems = await BitImporter.generateDemoVault();
    assert(demoItems.length >= 5, 'Demo vault must have multiple diverse items');

    // Test JSON export and re-import
    const jsonStr = BitImporter.exportToBitwardenJSON(demoItems);
    assert(jsonStr.includes('Bitwarden'), 'JSON must contain Bitwarden header');
    const importedJson = BitImporter.importVaultData(jsonStr);
    assert.strictEqual(importedJson.length, demoItems.length, 'Imported items count must match');

    // Test CSV export and re-import
    const csvStr = BitImporter.exportToBitwardenCSV(demoItems);
    assert(csvStr.includes('folder,favorite,type,name'), 'CSV header must be present');
    const importedCsv = BitImporter.importVaultData(csvStr);
    assert(importedCsv.length >= 4, 'CSV import must parse logins');
  });

  // --- 8. VAULT ENGINE & PENDING ITEMS TESTS ---
  console.log('\n[TEST SUITE 8: Vault Engine, Encryption, Quick-PIN & Sync]');
  await test('BitVault.setupVault initializes AES-256-GCM zero-knowledge vault', async () => {
    const res = await BitVault.setupVault('MasterVaultKey2026!', 'Demo vault hint');
    assert.strictEqual(res.success, true);
    assert.strictEqual(BitVault.isLocked(), false);
    assert.strictEqual(BitVault.isInitialized(), true);

    const items = BitVault.getItems();
    assert(items.length > 0, 'Vault should be seeded with initial items');
  });

  await test('BitVault URL matching and item CRUD', async () => {
    // Add new item
    const newItem = await BitVault.addItem({
      type: 'login',
      name: 'Reddit Test',
      uri: 'https://reddit.com/login',
      username: 'tester@reddit.com',
      password: 'Generated#Reddit2026!'
    });

    assert(newItem.id, 'New item must have generated ID');

    // URL matching
    const match = BitVault.getCredentialsForUrl('https://www.reddit.com/r/programming');
    assert.strictEqual(match.domain, 'reddit.com');
    assert.strictEqual(match.logins.length, 1);
    assert.strictEqual(match.logins[0].username, 'tester@reddit.com');

    // Update item
    const updated = await BitVault.updateItem(newItem.id, { username: 'updated_user@reddit.com' });
    assert.strictEqual(updated.username, 'updated_user@reddit.com');

    // Toggle favorite
    const isFav = await BitVault.toggleFavorite(newItem.id);
    assert.strictEqual(isFav, true);

    // Delete item
    await BitVault.deleteItem(newItem.id);
    const postDeleteMatch = BitVault.getCredentialsForUrl('https://reddit.com');
    assert.strictEqual(postDeleteMatch.logins.length, 0, 'Item must be removed from vault');
  });

  await test('BitVault lock and unlock with master password', async () => {
    BitVault.lockVault();
    assert.strictEqual(BitVault.isLocked(), true);
    assert.strictEqual(BitVault.getItems().length, 0, 'Locked vault must return 0 in-memory items');

    // Unlock with incorrect password should throw
    await assert.rejects(
      async () => await BitVault.unlockVault('WrongMasterPassword!'),
      /Incorrect Master Password/
    );

    // Unlock with correct password
    const unlockRes = await BitVault.unlockVault('MasterVaultKey2026!');
    assert.strictEqual(unlockRes.success, true);
    assert.strictEqual(BitVault.isLocked(), false);
    assert(BitVault.getItems().length > 0, 'Unlocked vault items must be decrypted');
  });

  await test('BitVault Quick PIN setup and unlock', async () => {
    await BitVault.setQuickPin('4829');

    BitVault.lockVault();
    assert.strictEqual(BitVault.isLocked(), true);

    // Unlock with PIN
    const pinRes = await BitVault.unlockWithPin('4829');
    assert.strictEqual(pinRes.success, true);
    assert.strictEqual(BitVault.isLocked(), false);
  });

  await test('BitVault.syncPendingItems merges background-captured items safely', async () => {
    // Simulate background worker storing a pending item while popup was closed
    const pendingItem = {
      id: BitCrypto.generateUUID(),
      type: 'login',
      name: 'Captured Login',
      uri: 'https://auto-captured.com',
      username: 'captured_user@example.com',
      password: 'CapturedPassword2026!'
    };

    memoryStorage.vault_pending_items = [pendingItem];

    // Trigger sync
    await BitVault.syncPendingItems();

    // Verify item is now in active decrypted items
    const items = BitVault.getItems();
    const found = items.find(it => it.id === pendingItem.id);
    assert(found, 'Pending item must be merged into vault items');
    assert.strictEqual(memoryStorage.vault_pending_items, undefined, 'Pending items queue must be cleared');
  });

  console.log('\n[TEST SUITE 9: Vault Item Deletion & Deletion Confirmation Flow]');

  await test('BitVault.deleteItem removes item from active memory and encrypted storage', async () => {
    // 1. Create a test item to delete
    const itemToDelete = await BitVault.addItem({
      type: 'login',
      name: 'Item To Delete',
      uri: 'https://deleteme.example.com',
      username: 'delete_user@example.com',
      password: 'DeleteTestPass123!'
    });

    assert(itemToDelete.id, 'Created item must have ID');
    assert(BitVault.getItems().some(it => it.id === itemToDelete.id), 'Item must exist in vault before deletion');

    // 2. Perform deletion
    const delResult = await BitVault.deleteItem(itemToDelete.id);
    assert.strictEqual(delResult.success, true, 'deleteItem must return success true');

    // 3. Verify item is not in active vault items
    const afterItems = BitVault.getItems();
    assert(!afterItems.some(it => it.id === itemToDelete.id), 'Deleted item must NOT exist in getItems()');

    // 4. Verify encrypted storage was updated and persists deletion by locking and unlocking
    assert(memoryStorage.vault_encrypted_data, 'Encrypted items storage must exist in storage');
    BitVault.lockVault();
    assert.strictEqual(BitVault.getItems().length, 0, 'Vault must be cleared upon lock');
    await BitVault.unlockVault('MasterVaultKey2026!');
    const reloadedItems = BitVault.getItems();
    assert(!reloadedItems.some(it => it.id === itemToDelete.id), 'Deleted item must NOT exist after reloading from encrypted disk storage');
  });

  await test('Direct 1-Click Immediate Deletion workflow with toast feedback', async () => {
    const targetItem = await BitVault.addItem({
      type: 'login',
      name: 'DirectDeleteTarget',
      uri: 'https://directdelete.example.com',
      username: 'direct@example.com',
      password: 'DirectPass2026!'
    });

    assert(BitVault.getItems().some(it => it.id === targetItem.id), 'Item must exist in vault');

    // Simulate immediate 1-click delete button handler
    let toastMessage = '';
    async function handleImmediateClick(itemId) {
      const item = BitVault.getItems().find(it => String(it.id) === String(itemId));
      const itemName = item ? item.name : 'Item';
      await BitVault.deleteItem(itemId);
      toastMessage = `Deleted "${itemName}"`;
    }

    // Single click executes deletion immediately
    await handleImmediateClick(targetItem.id);
    assert.strictEqual(toastMessage, 'Deleted "DirectDeleteTarget"');
    assert(!BitVault.getItems().some(it => it.id === targetItem.id), 'Item must be removed immediately after 1 click');
  });

  await test('Session persistence: restored popup can delete and persist without requiring re-auth', async () => {
    // Add item in current unlocked session
    const sessionItem = await BitVault.addItem({
      type: 'login',
      name: 'SessionPersistTarget',
      uri: 'https://sessiontest.com',
      username: 'session_user@example.com',
      password: 'SessionSecret123!'
    });

    // Simulate closing popup (mock background worker retains rawKeyB64 and items)
    const rawKey = await crypto.subtle.exportKey('raw', BitVault.getMasterKey ? BitVault.getMasterKey() : await BitCrypto.deriveMasterKey('MasterVaultKey2026!', memoryStorage.vault_salt));
    const rawKeyB64 = BitCrypto.bufferToBase64(rawKey);

    global.chrome.runtime.sendMessage = (msg, cb) => {
      if (msg.action === 'GET_VAULT_STATUS') {
        if (cb) cb({
          unlocked: true,
          items: BitVault.getItems(),
          rawKeyB64: rawKeyB64
        });
      }
    };

    // Re-initialize popup as if opened anew
    await BitVault.init();
    assert.strictEqual(BitVault.isLocked(), false, 'Vault must be unlocked from session');
    assert(BitVault.getItems().some(it => it.id === sessionItem.id), 'Item must be visible in reopened popup');

    // Perform deletion in reopened popup - must succeed and persist without error
    const delRes = await BitVault.deleteItem(sessionItem.id);
    assert.strictEqual(delRes.success, true);
    assert(!BitVault.getItems().some(it => it.id === sessionItem.id), 'Item must be deleted in reopened popup');
  });

  // --- 10. USER CUSTOM PASSWORD ENTRY & SAVING ---
  console.log('\n[TEST SUITE 10: Custom User Password Entry & Live Strength Evaluation]');
  await test('User custom password strength evaluation grades variety and complexity', () => {
    const customWeak = BitCrypto.ratePasswordStrength('abc123');
    assert.strictEqual(customWeak.score <= 1, true, 'Short simple password is weak');
    assert.strictEqual(customWeak.label === 'Very Weak' || customWeak.label === 'Weak', true);

    const customMedium = BitCrypto.ratePasswordStrength('SummerSunshine2024');
    assert.strictEqual(customMedium.score >= 2, true, 'Long passphrase has at least medium score');

    const customStrong = BitCrypto.ratePasswordStrength('K#9$vL!mQ2%zP7*wR4');
    assert.strictEqual(customStrong.score >= 3, true, 'Complex high-entropy custom password is rated strong');
    assert(customStrong.crackTime.length > 0, 'Crack time is provided');
    assert(customStrong.color.startsWith('#'), 'Valid hex color provided for UI badge');
  });

  await test('User can add own custom password with email ID and save to vault securely', async () => {
    const customUserPwd = 'CustomSecurePassword!2026#Alpha';
    const email = 'user.custom@example.com';
    const customItem = {
      id: BitCrypto.generateUUID(),
      type: 'login',
      name: 'Custom User Service',
      uri: 'https://custom-service.io',
      username: email,
      password: customUserPwd,
      folder: 'Personal',
      favorite: true,
      notes: 'Manually typed custom password'
    };

    const added = await BitVault.addItem(customItem);
    assert.strictEqual(added.password, customUserPwd, 'Password in memory matches custom password');

    // Verify stored and encrypted in persistent storage
    assert.ok(memoryStorage.vault_encrypted_data, 'Encrypted data must be persisted to storage');
    const masterKey = await BitCrypto.deriveMasterKey('MasterVaultKey2026!', memoryStorage.vault_salt);
    const decryptedItems = await BitCrypto.decrypt(memoryStorage.vault_encrypted_data, masterKey);
    const foundItem = decryptedItems.find(it => it.id === customItem.id);
    assert.ok(foundItem, 'Custom password item must be persisted in encrypted vault');
    assert.strictEqual(foundItem.password, customUserPwd, 'Decrypted persisted password matches user input exactly');
    assert.strictEqual(foundItem.username, email, 'Decrypted persisted username matches user input');
  });

  console.log('\n====================================================');
  console.log(` TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('====================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
