<?php
/**
 * ScamShield AI - Backend Configuration
 * Rename this file to config.php and enter your API keys.
 */

return [
    // Google Safe Browsing Lookup API (v4)
    // Get free key at: https://console.cloud.google.com/apis/library/safebrowsing.googleapis.com
    'google_safe_browsing_key' => 'YOUR_GOOGLE_SAFE_BROWSING_API_KEY_HERE',

    // Optional VirusTotal API Key
    // Get free key at: https://www.virustotal.com/gui/my-apikey
    'virustotal_api_key' => 'YOUR_VIRUSTOTAL_API_KEY_HERE',

    // Optional AI Explanation Key (Google Gemini or OpenAI)
    'gemini_api_key' => 'YOUR_GEMINI_API_KEY_HERE',

    // Security & Cache Settings
    'enable_cache' => true,
    'cache_ttl_seconds' => 3600, // Cache results for 1 hour
    'allowed_origins' => ['*']    // Restrict in production to chrome-extension://<YOUR_EXTENSION_ID>
];
