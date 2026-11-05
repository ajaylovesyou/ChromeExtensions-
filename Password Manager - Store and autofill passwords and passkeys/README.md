# Bitwarden Password Manager - Store & Autofill Passwords and Passkeys

> **Securely store, generate, and autofill passwords, passkeys, 2FA TOTP codes, payment cards, and private notes with zero-knowledge AES-256-GCM encryption.**

A feature-rich browser extension built on **Manifest V3** for Google Chrome, Microsoft Edge, Brave, and Mozilla Firefox. Designed following Bitwarden's security architecture, modernized with cutting-edge **FIDO2 Passkeys**, interactive in-page field badges, an RFC 6238 2FA authenticator, and a Security Health & Breach Audit dashboard.

---

## 🌟 Key Features

### 1. 🛡️ Zero-Knowledge Encrypted Vault
- **AES-256-GCM Encryption**: Client-side cryptography using standard WebCrypto API (`crypto.subtle`).
- **PBKDF2 SHA-256 Key Derivation**: 100,000 iterations with unique 32-byte cryptographic salt per vault.
- **Multiple Item Types**:
  - **Logins**: Website URL, username, password, TOTP authenticator key, notes.
  - **Passkeys (FIDO2 / WebAuthn)**: RP ID, username, user handle, ECDSA P-256 keypair, SPKI fingerprint.
  - **Payment Cards**: Cardholder, brand auto-detect, card number, expiration, CVV.
  - **Secure Notes**: Markdown-compatible private notes, Wi-Fi keys, server credentials.
- **Folder Organization**: Categorize items into Personal, Work, Finance, Social, Shopping, or custom folders.
- **Favorites (★)**: Star frequently used credentials for instant access.
- **Auto-Lock Security**: Configurable inactivity lock timer (1m, 5m, 15m, 1h, Never).
- **Quick PIN Unlock**: Optional 4 to 6-digit PIN for rapid unlocking during active sessions.

### 2. ⚡ In-Page Form Detection & Autofill
- **Interactive Bitwarden Field Badge**: Subtle shield badge placed inside username, password, 2FA, and credit card fields.
- **Floating Autofill Dropdown**: Clicking the badge displays matched credentials for the current domain.
- **Framework Compatibility**: Synthetic event dispatching (`input`, `change`, `keydown`, `keyup`) ensures seamless integration with React, Vue, Angular, and vanilla forms.
- **Keyboard Shortcut**: Press `Ctrl+Shift+L` (`Command+Shift+L` on macOS) to instantly autofill the active tab.
- **"Save Password to Bitwarden?" Prompt Banner**: Intercepts form submissions on any website and prompts to save new logins with 1-click.

### 3. 🔑 Full Passkeys (FIDO2 / WebAuthn) Support
- **Generate Passkeys**: Generates authentic cryptographic ECDSA P-256 (`ES256`) keypairs.
- **WebAuthn Assertion Simulation**: Sign authentication challenges directly from the extension.
- **In-Page Passkey Modal**: Displays an authentic Bitwarden Passkey selector when websites request authentication.
- **Key Inspection**: Inspect relying party domain, credential ID, public key SPKI, and cryptographic fingerprint.

### 4. ⏱️ Built-in RFC 6238 TOTP Authenticator
- **No Phone Required**: Generates 6-digit 2FA verification codes directly in the extension.
- **Live 30-Second Countdown**: Real-time timer indicating code expiration and auto-refresh.
- **1-Click Copy & Autofill**: Automatically detects 2FA verification fields on the webpage and autofills the code.

### 5. 🎲 Smart Password, Passphrase & Alias Generator
- **Customizable Random Passwords**: Sliders for length (8-64), uppercase, lowercase, numbers, special characters, and ambiguous character filtering (`0, O, l, 1, I`).
- **Memorable Diceware Passphrases**: 3 to 8 words from a clean dictionary with custom separators (`-`, `.`, `_`, space).
- **Username & Email Alias Generator**:
  - Plus-addressing email alias: `user+sitename123@gmail.com`
  - Forwarding relay alias: `shield.9f2a@vault-alias.com`
  - Memorable random handles: `swift_falcon_42`
- **Real-Time Entropy Meter**: Displays entropy in bits, human-readable crack time estimates, and colored security scores.
- **⚡ Create & Quick-Save to Vault with Email ID**:
  - Directly beneath the generator, quickly enter/generate an email ID and account name.
  - 1-Click **"Save to Vault"** or **"Save & Autofill Page"** immediately stores the generated password with your email ID into the zero-knowledge encrypted vault.
  - Works seamlessly across the popup generator, full Web Vault options dashboard, and in-page dropdown badges.

### 6. 🩺 Security Health & Breach Audit Dashboard
- **Vault Security Score (0-100%)**: Circular grade dial (Grade A to F).
- **Compromised Password Scanner**: Flags passwords found in public breach databases.
- **Reused Password Groups**: Detects duplicate passwords across accounts to prevent credential stuffing.
- **Weak Password Detection**: Flags credentials with low complexity or under 10 characters.
- **Missing 2FA Alerts**: Identifies supported services (Google, GitHub, Chase, PayPal, etc.) missing Two-Factor Authentication.

### 7. 📤 Bitwarden Send (Encrypted Secret Sharing)
- Share confidential passwords, server keys, or notes securely.
- Client-side AES-GCM encrypted payload with auto-expiration (1h, 24h, 7d).
- Configurable maximum access count (e.g. burn after 1 view).

### 8. 📋 Secure Clipboard
- 1-click copying for usernames, passwords, card numbers, and TOTP codes.
- **Auto-Clear Clipboard**: Purges sensitive data from your clipboard after 10s, 30s, or 60s to prevent clipboard hijacking.

### 9. 🔄 Data Portability (Import & Export)
- **Export**: Standard Bitwarden JSON and Bitwarden CSV formats.
- **Import**: Compatible with Bitwarden, Google Chrome Passwords CSV, and 1Password.
- **Instant Demo Vault**: Seeds realistic sample accounts (GitHub, Google, Netflix, Chase, Amazon, Passkey, Visa Card, Wi-Fi Note) so anyone can immediately test all features.

### 10. 🎨 Multi-Theme Support
- **Bitwarden Royal Blue** (Signature theme)
- **Dark Navy**
- **OLED Pure Black**
- **Light Theme**

---

## 📁 Project Structure

```
Bitwarden Password Manager - Store and autofill passwords and passkeys/
├── manifest.json              # Manifest V3 extension configuration
├── generate_icons.ps1         # Pixel-perfect Bitwarden shield icon generator
├── package_extension.ps1      # Production ZIP packaging script
├── README.md                  # Detailed documentation
│
├── background/
│   └── service-worker.js      # Session cache, alarms, context menus & badge counters
│
├── content/
│   ├── autofill-content.js    # In-page field detection, badges, autofill & save prompts
│   └── autofill-content.css   # In-page UI styles (badges, dropdowns, passkey modal)
│
├── popup/
│   ├── popup.html             # Extension action popup interface
│   ├── popup.js               # Popup controller (vault, generator, send, settings)
│   └── popup.css              # Styling with multi-theme support
│
├── options/
│   ├── options.html           # Full-screen Web Vault desktop dashboard
│   ├── options.js             # Dual-pane vault manager, passkey inspector & audit
│   └── options.css            # Responsive dashboard styles
│
├── lib/
│   ├── crypto.js              # WebCrypto PBKDF2 (100k rounds) + AES-256-GCM
│   ├── vault.js               # Vault store, item CRUD, auto-lock & search engine
│   ├── passkey.js             # WebAuthn ECDSA P-256 passkey generator & assertion
│   ├── totp.js                # RFC 6238 TOTP 2FA authenticator engine
│   ├── generator.js           # Password, passphrase, and email alias generator
│   ├── health.js              # Security health audit & breach analyzer
│   ├── send.js                # Bitwarden Send ephemeral encrypted sharing
│   └── importer.js            # Bitwarden JSON/CSV, Chrome & 1Password import/export
│
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
│
├── test/
│   └── autofill-test-page.html # Interactive test playground with live event console
│
└── dist/
    └── Bitwarden-Password-Manager-v1.0.0.zip
```

---

## 🚀 How to Install & Use in Your Browser

### Step 1: Open Extensions Page in Chrome / Edge / Brave
1. Open Google Chrome, Microsoft Edge, or Brave.
2. Navigate to:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`

### Step 2: Enable Developer Mode
- In the top right corner of the Extensions page, toggle **Developer mode** to **ON**.

### Step 3: Load the Extension
1. Click the **Load unpacked** button in the top left.
2. Select the directory:
   `E:\Goal\Extension\Bitwarden Password Manager - Store and autofill passwords and passkeys`
3. The extension **Bitwarden Password Manager** will now appear in your browser toolbar!

### Step 4: Pin & Open
1. Click the puzzle icon 🧩 in your browser toolbar and click the **Pin** icon next to Bitwarden.
2. Click the Bitwarden shield icon to open the popup.
3. On first launch, click **"⚡ Quick Fill Demo (Bitwarden2026!)"** or type your own master password (min 8 chars) to initialize your encrypted vault with realistic demo data!

---

## 🧪 Testing with the Built-in Interactive Playground

The extension includes a dedicated test playground (`test/autofill-test-page.html`) to test every feature instantly:

1. Right-click the extension icon and click **Options** (or open `test/autofill-test-page.html` in your browser).
2. Click **Autofill Playground** in the sidebar.
3. You can test:
   - **Login Form**: Click the shield badge inside username/password to autofill, or press `Ctrl+Shift+L`.
   - **Create Password & Save with Email**: Click `⚡` to generate an 18-char password, enter your email ID, and click submit to trigger the automatic prompt to save it to your Bitwarden Vault.
   - **Passkey Authentication**: Click **"Sign In with Bitwarden Passkey"** to trigger the WebAuthn passkey selector modal.
   - **2FA TOTP**: Observe the live 30s code update in the extension and fill the 6-digit OTP field.
   - **Payment Card**: Fill the cardholder, number, expiration, and CVV fields in 1-click.
   - **Save Password Prompt**: Submit a new registration form and watch the in-page prompt offer to save it directly into your vault!

---

## 🔒 Security Architecture

| Component | Standard / Algorithm | Details |
| :--- | :--- | :--- |
| **Symmetric Encryption** | AES-256-GCM | 256-bit key length, unique 12-byte random IV per record |
| **Key Derivation** | PBKDF2 SHA-256 | 100,000 iterations, 32-byte cryptographic salt |
| **Passkeys** | FIDO2 / WebAuthn | ECDSA P-256 (`ES256` / COSE -7), SPKI public key |
| **Two-Factor Auth** | RFC 6238 TOTP | HMAC-SHA1, 30-second time steps, dynamic truncation |
| **Randomness** | WebCrypto API | `crypto.getRandomValues()` for true cryptographic entropy |
| **Clipboard Security** | In-Memory Timer | Clears copied passwords automatically after 10-60s |
| **Zero-Knowledge** | Client-Side Only | Master password never leaves the device |

---

## 📦 Packaging

To generate a clean production ZIP package ready for the Chrome Web Store or Edge Add-ons:
```powershell
powershell -ExecutionPolicy Bypass -File "E:\Goal\Extension\Bitwarden Password Manager - Store and autofill passwords and passkeys\package_extension.ps1"
```
The output zip files will be placed in:
- `dist/Bitwarden-Password-Manager-v1.0.0.zip`
- `Bitwarden Password Manager - Store and autofill passwords and passkeys.zip`
