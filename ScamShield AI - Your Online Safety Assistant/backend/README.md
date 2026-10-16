# ScamShield AI — Optional Backend API Server

This lightweight PHP backend serves as a secure proxy between your ScamShield Chrome Extension and reputable threat intelligence databases like **Google Safe Browsing API (v4)** or **VirusTotal**.

### Why use a backend?
1. **Keeps your API keys secure:** Your secret Google/VirusTotal keys stay hidden on the server, not in client-side code where anyone could extract them.
2. **Server-side caching:** Avoids burning external API quotas when multiple users visit popular domains.
3. **Optional AI Analysis:** Easily connect Gemini or OpenAI models to generate dynamic plain-English explanations.

---

### Quick Start (Local PHP Server)

If you have PHP installed on your machine:
```bash
cd "E:\Goal\Extension\ScamShield AI - Your Online Safety Assistant\backend"
copy config.sample.php config.php
php -S localhost:8000
```

1. Open `http://localhost:8000/index.php?action=health` in your browser. You should see:
```json
{
  "status": "online",
  "server": "ScamShield AI Backend",
  "version": "1.0.0"
}
```

2. In the ScamShield extension popup, navigate to **Settings**, enable **Optional PHP Backend API**, and set the endpoint to:
```
http://localhost:8000/index.php
```

---

### Obtaining Free API Keys
- **Google Safe Browsing v4 (Free):** [Google Cloud Console](https://console.cloud.google.com/apis/library/safebrowsing.googleapis.com)
- **VirusTotal API (Free):** [VirusTotal Community](https://www.virustotal.com/gui/my-apikey)
- **Google Gemini API (Free Tier):** [Google AI Studio](https://aistudio.google.com/)
