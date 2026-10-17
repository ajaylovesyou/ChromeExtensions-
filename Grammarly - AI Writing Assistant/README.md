# ✨ Grammarly - AI Writing Assistant

> **A real-time, privacy-first AI writing assistant extension (Manifest V3) for Chrome, Edge, and Brave.**
> Automatically inspects and enhances **Grammar**, **Spelling**, **Clarity**, and **Tone**, with in-page floating assistance, instant one-click fixes, and smart AI rephrasing.

---

## 🌟 Key Features

### 1. 🟡 Intelligent Grammar & Syntax Checker
- **Subject-Verb Agreement**: Detects mismatches like *"He have"* → *"He has"*, *"Everyone are"* → *"Everyone is"*, *"They was"* → *"They were"*.
- **Confused Words & Homophones**: Catches confusing words in context:
  - `their` vs `there` vs `they're`
  - `your` vs `you're`
  - `its` vs `it's`
  - `then` vs `than`
  - `affect` vs `effect`
  - `lose` vs `loose`
- **Modal Verb Preposition Errors**: Corrects *"could of"* → *"could have"*, *"should of"* → *"should have"*, *"would of"* → *"would have"*.
- **Indefinite Article Rules**: Identifies *"a apple"* → *"an apple"*, *"an car"* → *"a car"*, *"a hour"* → *"an hour"*.
- **Duplicate Words**: Catches stutters like *"the the"*, *"is is"*, *"in in"*.
- **Punctuation & Capitalization**: Corrects lowercase standalone pronoun `"i"`, missing sentence capitalizations, double spaces, and excess exclamation marks.

### 2. 🔴 Real-Time Spell Checker & Personal Dictionary
- **Instant Typo Correction**: O(1) instant correction for hundreds of high-frequency misspellings (*"definately"*, *"seperate"*, *"recieved"*, *"untill"*, *"tommorrow"*, *"goverment"*, *"neccessary"*, etc.).
- **Levenshtein Distance Suggestions**: Dynamically calculates the closest valid English dictionary candidates for unfamiliar typos.
- **Personal Custom Dictionary**: Add brand names, technical jargon, or custom abbreviations (e.g. *Kubernetes, Subagent, OpenAI*) with 1 click to never flag them again.

### 3. 🔵 Clarity & Conciseness Engine
- **Wordy Phrase Simplification**: Replaces bloated phrases with direct words:
  - *"in order to"* → *"to"*
  - *"at this point in time"* → *"now"*
  - *"due to the fact that"* → *"because"*
  - *"has the ability to"* → *"can"*
  - *"make a decision"* → *"decide"*
  - *"conduct an investigation into"* → *"investigate"*
- **Redundancy Removal**: Eliminates tautologies (*"completely eliminate"* → *"eliminate"*, *"end result"* → *"result"*, *"future plans"* → *"plans"*, *"past memories"* → *"memories"*).
- **Passive Voice Detector**: Flags passive constructions (*"was completed by"*) and recommends punchy active voice.
- **Run-on Sentence Alert**: Flags sentences exceeding 35 words for improved readability.

### 4. 🟣 Tone Detection & Multi-Tone Rephraser
- **Live Tone Analyzer**: Evaluates linguistic markers to identify primary and secondary tones:
  - 💼 **Professional / Confident**
  - 🤝 **Casual & Friendly**
  - ⚡ **Direct & Urgent**
  - 🎓 **Academic & Formal**
  - 🕊️ **Empathetic & Diplomatic**
- **One-Click Tone Transforms**:
  - `💼 Professional`: Polishes casual slang into business-ready communication.
  - `🤝 Friendly`: Adds warmth and cordial phrasing.
  - `⚡ Confident`: Strips hesitant hedging words (*"maybe"*, *"I think"*).
  - `✂️ Concise`: Trims unnecessary adjectives and filler.

### 5. 📊 Readability & Quality Scoring
- **Flesch Reading Ease**: Instant 0–100 score + Grade Level classification (e.g., *7th-8th Grade Plain English*, *High School*, *College*).
- **Text Statistics**: Real-time word count, character count, estimated reading time, and speaking time.
- **Overall Writing Score**: 0 to 100 quality gauge.

### 6. 🟢 In-Page Floating Assistant (Grammarly G-Badge)
- Appears unobtrusively at the bottom-right corner of active text areas, search inputs, and `contenteditable` editors (Gmail, Notion, LinkedIn, X/Twitter, Slack).
- Shows live issue count badge (green check `✓` if clean; red badge if issues found).
- Clicking opens the interactive floating card with categorized suggestions, preview diffs, and **"Fix All"** button.

### 7. ☁️ Dual Engine Architecture (Offline First + Optional Cloud LLM)
- **100% Offline by Default**: Privacy-first, zero latency, works without internet or API keys.
- **Optional Cloud AI**: Configure OpenAI (GPT-4o mini), Groq (Llama 3.1), or OpenRouter API keys in Options for deep generative restructuring and paragraph rewrites.

---

## 📁 Project Structure

```
E:\Goal\Extension\Grammarly - AI Writing Assistant\
├── manifest.json                  # Chrome Manifest V3 declaration
├── background\
│   └── service-worker.js          # Background service worker & context menus
├── content\
│   ├── content.js                 # In-page floating assistant & DOM watcher
│   └── content.css                # Floating widget & popover card styling
├── popup\
│   ├── popup.html                 # Standalone Scratchpad & Writing Studio
│   ├── popup.css                  # Modern UI styles with emerald accent
│   └── popup.js                   # Popup controller & real-time analyzer
├── options\
│   ├── options.html               # Full settings dashboard
│   ├── options.css                # Settings layout & toggle switches
│   └── options.js                 # Settings controller & sync storage
├── lib\
│   ├── readability.js             # Flesch score & text metrics engine
│   ├── grammar-rules.js           # Comprehensive grammar rule catalogue
│   ├── spell-checker.js           # Dictionary, typos & Levenshtein engine
│   ├── clarity-engine.js          # Wordiness, redundancy & passive voice
│   ├── tone-analyzer.js           # Tone detection & smart rephraser
│   └── ai-service.js              # Unified orchestrator (Offline + Cloud AI)
├── icons\
│   ├── icon16.png                 # Toolbar icon
│   ├── icon32.png                 # Retina icon
│   ├── icon48.png                 # Extension management icon
│   ├── icon128.png                # Chrome Web Store & detail icon
│   └── icon.svg                   # Crisp vector source
├── test\
│   ├── test-runner.js             # Automated Node.js test suite (30 unit tests)
│   └── test-page.html             # Interactive browser live test playground
├── generate_icons.ps1             # PowerShell .NET icon generator
├── package_extension.ps1          # Production zip packager
└── README.md                      # Documentation
```

---

## 🚀 How to Install in Your Browser

### Google Chrome / Microsoft Edge / Brave:

1. Open your browser and navigate to the extensions page:
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
   - **Brave**: `brave://extensions`
2. Enable **Developer mode** (toggle located at top-right corner).
3. Click the **"Load unpacked"** button.
4. Select the directory:
   ```
   E:\Goal\Extension\Grammarly - AI Writing Assistant
   ```
5. Click **Select Folder**. The **Grammarly - AI Writing Assistant** icon will appear in your extensions toolbar!
6. Pin the extension to your browser toolbar for quick access.

---

## 🧪 Testing the Extension

### 1. Automated Test Suite (Command Line)
Run the automated verification test suite:
```powershell
node "E:\Goal\Extension\Grammarly - AI Writing Assistant\test\test-runner.js"
```
*Output: 30 PASSED, 0 FAILED.*

### 2. Interactive Browser Live Test Page
Open `test/test-page.html` in your browser:
```powershell
start "E:\Goal\Extension\Grammarly - AI Writing Assistant\test\test-page.html"
```
- Click into the **Standard Textarea**, **Subject Line Input**, or **Rich ContentEditable Box**.
- Watch the **emerald G-badge** appear at the bottom-right corner!
- Click the badge to open the floating card, review suggestions, and click **"✨ Fix All"** or individual **"Accept Fix"** buttons.

---

## ⚙️ Configuration & Options

Click the extension icon and select the settings gear (or right-click icon → *Options*):
- **Feature Toggles**: Selectively enable/disable Grammar, Spelling, Clarity, Tone, or the In-Page Floating Widget.
- **Custom Dictionary**: Add technical terms, company names, or acronyms to prevent false spelling alerts.
- **Audience & Goals**: Configure your target audience (*General*, *Knowledgeable*, *Academic*, *Expert*) and default tone.
- **AI Provider**: Switch between the Built-in Offline Engine or Cloud LLMs (*OpenAI*, *Groq*, *OpenRouter*).
- **Excluded Domains**: Blacklist sensitive websites (e.g., banking or intranet domains).

---

## 📦 Distribution Packages

Pre-built zip packages ready for installation or deployment:
- `E:\Goal\Extension\Grammarly - AI Writing Assistant.zip`
- `E:\Goal\Extension\Grammarly - AI Writing Assistant\dist\Grammarly-AI-Writing-Assistant-v1.0.0.zip`
