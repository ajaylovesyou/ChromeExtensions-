# 🛡️ ScamShield AI — Your Online Safety Assistant

> **Mission:** Protect ordinary everyday people from online scams, deceptive links, fake shopping stores, phishing lookalikes, and fraudulent messages with simple, zero-jargon safety explanations.

Built with **Manifest V3**, **HTML5**, **CSS3**, and **Modern JavaScript (ES Modules)**. Works completely client-side out-of-the-box with optional secure PHP backend proxy support.

---

## 🌟 The 5 Key Features

### 1. 🌐 Website Safety Checker
* **Real-time Domain Audit:** Automatically inspects the URL of the tab you are browsing.
* **Deep Phishing & Impersonation Heuristics:**
  * Checks for **Typosquatting** (e.g., `paypa1.com`, `arnazon.com`).
  * Checks for **Subdomain Deception** (e.g., `paypal.com.customer-support.net`).
  * Detects **Raw IP addresses** hosting sensitive login portals.
  * Checks for **High-Risk/Abuse TLDs** (`.top`, `.xyz`, `.work`, `.click`).
  * Recognizes **Verified Official Brands** (Google, Apple, Microsoft, Amazon, Netflix, Chase, etc.).
* **Safety Score Meter:** Live score from `0` to `100` with clear visual status:
  * 🟢 **Verified Safe** (Trust score 80–100)
  * 🟡 **Proceed with Caution** (Trust score 40–79)
  * 🔴 **High Scam / Phishing Risk** (Trust score 0–39)

### 2. 🔗 Suspicious Link Detector
* **Inspect Before You Click:** Paste any unfamiliar link from an SMS or email into the popup to see where it really leads before opening it.
* **In-Page Deceptive Link Highlighting:** When browsing pages, links where the displayed anchor text claims one website (e.g., `paypal.com`) but the actual `href` targets another (e.g., `hacker.xyz`) are outlined in red with a floating safety warning tooltip.
* **Right-Click Context Menu:** Right-click *any link* on any website and choose **"🛡️ Scan link with ScamShield AI"** for an instant floating safety report.

### 3. 🛍️ Shopping Scam Alerts
* **Investigate Unfamiliar Online Stores:**
  * Flags **Extreme 85%+ liquidation discounts** (common bait for fake stores stealing cards).
  * Flags **Artificial Urgency & Countdown Timers** (*"Hurry, only 1 left!"*).
  * Warns if a store demands **untraceable payments** (Western Union, Zelle, Bitcoin, or Gift Cards).
  * Detects if an "official" shop uses a free personal email (`@gmail.com`, `@yahoo.com`) for customer service.

### 4. 💬 Scam Message Analyzer
* **Paste Suspicious SMS, Emails, or DMs:**
  * Detects **Postal / Courier Smishing** (USPS, FedEx, DHL unpaid customs fees).
  * Detects **Bank Fraud Impersonation** (Chase, Wells Fargo unauthorized charge scares).
  * Detects **Panic Urgency** (*"Account suspended in 24 hours"*, *"Arrest warrant"*).
  * Detects **Fake Invoices** (Geek Squad, Norton auto-renewals).
  * Detects **Credential Harvesting** (Requests for 6-digit OTPs or passwords).
* **Right-Click Text Inspection:** Highlight suspicious text on any webpage, right-click, and choose **"🔍 Check text for scam red flags"**.

### 5. 💡 Simple Safety Explanations
* **Zero Technical Jargon:** Never displays confusing error codes or RFC specifications.
* **"Why it looks suspicious":** Bulleted explanations in plain English understandable by children, students, and grandparents.
* **"What you should do next":** Concrete, reassuring action items (*"Do not type your password"*, *"Close this tab"*, *"Call your bank using the phone number printed on your physical card"*).

---

## 🚀 How to Install and Test in Google Chrome

1. **Open Google Chrome**.
2. In the address bar, type:
   ```
   chrome://extensions
   ```
   and press **Enter**.
3. In the top-right corner, switch the **Developer mode** toggle to **ON**.
4. Click the **Load unpacked** button in the top-left corner.
5. In the folder picker dialog, select:
   ```
   E:\Goal\Extension\ScamShield AI - Your Online Safety Assistant
   ```
6. Click **Select Folder**.
7. **ScamShield AI** is now installed! Pin it to your Chrome toolbar by clicking the puzzle piece icon 🧩 next to your address bar and clicking the pin icon next to **ScamShield AI**.

---

## 🧪 Testing the Extension Immediately

Inside the extension popup, you will find pre-built **Try sample** chips so you can test all features with one click:

1. **Test a Phishing Link:**
   * Open the popup -> Click **Check Link** tab.
   * Click the **"PayPal Phish"** sample chip -> Click **Scan Link**.
   * Notice the instant red warning: explains character substitution and high-risk `.top` domain!
2. **Test a Scam SMS / Email:**
   * Open the popup -> Click **Messages** tab.
   * Click the **"USPS Parcel"** sample chip -> Click **Analyze Message**.
   * Notice how it identifies postal parcel smishing and flags the embedded link!
3. **Test Right-Click Context Menu:**
   * Highlight any suspicious text or link on any web page.
   * Right-click and choose **"Scan link with ScamShield AI"** or **"Check text for scam red flags"**.
   * A floating in-page card appears at the top right with clear advice.

---

## 📂 Project Architecture

```
ScamShield AI — Your Online Safety Assistant/
├── manifest.json              # Chrome Manifest V3 declaration
├── icons/                     # Crisp icons (16, 32, 48, 128 px & SVG)
├── popup/
│   ├── popup.html             # Clean 5-tab safety interface
│   ├── popup.css              # Cyber-clean responsive styling
│   └── popup.js               # Tab controller & event coordinator
├── background/
│   └── service-worker.js      # Manifest V3 service worker & context menus
├── content/
│   ├── content-script.js      # In-page link inspector & DOM scanner
│   └── content-style.css      # Scoped styling for floating warning cards
├── lib/
│   ├── heuristics.js          # Core URL, link, shopping & message algorithms
│   ├── simple-explainer.js    # Plain English explanation translator
│   └── storage.js             # Local storage helper (settings & history)
├── backend/ (Optional PHP Proxy)
│   ├── index.php              # Secure Google Safe Browsing / VirusTotal proxy
│   ├── config.sample.php      # API keys & cache configuration
│   └── README.md              # Backend setup guide
└── test-samples/
    └── scam_samples.json      # Curated real-world phishing and scam test cases
```

---

## 🔒 Privacy & Security

* **100% Privacy by Default:** Scans and heuristics run locally in your browser. No private passwords, bookmarks, or browsing logs are uploaded to any server.
* **Scan History:** Kept safely in your browser's private local storage (`chrome.storage.local`). You can clear it anytime with 1 click from the Settings tab.
* **Whitelisting:** Easily whitelist your trusted personal or company domains with the "Trust This Domain" button.
