# DarkShift Pro - Universal Dark Theme for Every Website 🌙

> **Smart, high-performance browser extension (Manifest V3) that applies comfortable, high-contrast dark themes to any website across the internet.**

---

## ✨ Features

- **🚀 3 Powerful Theme Engines**:
  - **🌟 Smart Inversion (Default)**: Inverts bright website surfaces while intelligently protecting photos, video players, thumbnails, canvas, SVG icons, and background images from becoming negatives. Works on 99.9% of websites with zero layout reflows.
  - **🎨 Dynamic Charcoal**: Deep modern stylesheet with charcoal backgrounds (`#121214`), soft borders (`#2e2e38`), crisp readable typography (`#e4e4e7`), and dark inputs.
  - **🖤 OLED Pure Black**: True black (`#000000`) surfaces optimized for AMOLED / OLED screens, eliminating backlight bleed and significantly reducing battery drain.
- **⚡ Zero White Flash (Anti-FOUC)**: Content scripts execute at `document_start` with preflight styling injected into the DOM tree before HTML rendering begins, eliminating blinding white page flashes during navigation.
- **🎛️ Real-Time Live Sliders**:
  - **Brightness** (60% to 120%)
  - **Contrast** (60% to 140%)
  - **Warmth / Sepia** (Night Shift blue-light reduction filter)
  - **Grayscale** (Distraction-free monochrome reading mode)
- **🌐 Per-Site Rules & Exclusions**:
  - 1-click toggle for the active website right from the popup.
  - Supports both **Blacklist Mode** (active everywhere except excluded sites) and **Whitelist Mode** (active only on approved sites).
- **⏱️ Automated Scheduling**:
  - **Follow System OS Theme**: Automatically activates when Windows/macOS switches to Dark Mode.
  - **Custom Time Schedule**: Set custom start and end times (e.g., 20:00 to 07:00).
- **⌨️ Keyboard Shortcuts**:
  - `Alt + Shift + D`: Toggle dark theme on current website.
  - `Alt + Shift + M`: Toggle master dark theme globally.
- **🎨 Custom Domain CSS**: Injects custom CSS rules for specific tricky domains via the Options Dashboard.
- **💾 Backup & Sync**: One-click JSON export and import for all settings and custom site lists.

---

## 📁 Project Structure

```text
DarkShift Pro - Universal Dark Theme/
├── manifest.json              # Manifest V3 extension configuration
├── background.js              # Service worker managing badges, hotkeys, and alarms
├── content.js                 # Injected script handling anti-FOUC and live styling
├── build_icons.js             # Standalone icon generator
├── themes/
│   ├── smart-invert.css       # Smart inversion engine with media element protection
│   ├── dynamic-dark.css       # Modern charcoal stylesheet theme
│   └── oled-dark.css          # True pitch-black #000000 theme for OLED displays
├── popup/
│   ├── popup.html             # Quick action popup UI
│   ├── popup.css              # Cyber-minimalist dark styling
│   └── popup.js               # Reactive popup controller with live sliders
├── options/
│   ├── options.html           # Full settings and rules dashboard
│   ├── options.css            # Responsive dashboard styles
│   └── options.js             # Rule manager, scheduler, CSS injector, backup tool
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

---

## 🛠️ How to Load in Google Chrome, Microsoft Edge, or Brave

1. Open your browser and navigate to:
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
   - **Brave**: `brave://extensions`
2. Enable the **"Developer mode"** toggle (usually located in the top-right corner).
3. Click **"Load unpacked"** in the top-left toolbar.
4. Select the folder:
   ```text
   E:\Goal\Extension\DarkShift Pro - Universal Dark Theme
   ```
5. Click **Select Folder**.
6. Pin **DarkShift Pro** to your browser toolbar and open any website (e.g. Wikipedia, Hacker News, CNN, GitHub, documentation sites) to enjoy instant dark mode!

---

## 💡 Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Alt + Shift + D` | Toggle DarkShift on current website |
| `Alt + Shift + M` | Master Global On / Off toggle |
| Customize | Go to `chrome://extensions/shortcuts` to assign custom keys |

---

## 🔒 Privacy & Permissions

- **Zero External Telemetry**: Runs 100% locally on your machine with zero external network requests.
- **Zero Third-party Trackers**: Does not harvest or transmit browsing history or user data.
- **Storage**: Uses local browser storage (`chrome.storage.local`) to persist preferences.
