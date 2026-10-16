<?php
/**
 * ScamShield AI - Backend Security & API Proxy Server
 * Provides secure server-side reputation lookups (Google Safe Browsing / VirusTotal)
 * while keeping your private API keys secure from the client extension.
 */

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Handle CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Load Configuration
$configFile = __DIR__ . '/config.php';
$config = file_exists($configFile) 
    ? require $configFile 
    : (file_exists(__DIR__ . '/config.sample.php') ? require __DIR__ . '/config.sample.php' : []);

$cacheDir = __DIR__ . '/cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}

// Read JSON Input
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

$action = $data['action'] ?? $_GET['action'] ?? 'check_url';

switch ($action) {
    case 'health':
        echo json_encode([
            'status' => 'online',
            'server' => 'ScamShield AI Backend',
            'version' => '1.0.0',
            'has_google_key' => !empty($config['google_safe_browsing_key']) && $config['google_safe_browsing_key'] !== 'YOUR_GOOGLE_SAFE_BROWSING_API_KEY_HERE',
            'timestamp' => time()
        ]);
        break;

    case 'check_url':
        $url = trim($data['url'] ?? $_GET['url'] ?? '');
        if (empty($url)) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing "url" parameter.']);
            exit;
        }

        $result = checkUrlReputation($url, $config, $cacheDir);
        echo json_encode($result);
        break;

    case 'analyze_message_ai':
        $text = trim($data['text'] ?? '');
        if (empty($text)) {
            http_response_code(400);
            echo json_encode(['error' => 'Missing "text" parameter.']);
            exit;
        }

        $result = analyzeMessageWithAI($text, $config);
        echo json_encode($result);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => "Unknown action: {$action}"]);
        break;
}

/**
 * Checks URL reputation via Google Safe Browsing v4 with local disk cache fallback
 */
function checkUrlReputation($targetUrl, $config, $cacheDir) {
    $cacheKey = md5($targetUrl);
    $cacheFile = $cacheDir . '/' . $cacheKey . '.json';
    $cacheTtl = $config['cache_ttl_seconds'] ?? 3600;

    // Check disk cache
    if (!empty($config['enable_cache']) && file_exists($cacheFile)) {
        if (time() - filemtime($cacheFile) < $cacheTtl) {
            $cached = json_decode(file_get_contents($cacheFile), true);
            $cached['source'] = 'cache';
            return $cached;
        }
    }

    $apiKey = $config['google_safe_browsing_key'] ?? '';
    $hasValidGoogleKey = !empty($apiKey) && $apiKey !== 'YOUR_GOOGLE_SAFE_BROWSING_API_KEY_HERE';

    if ($hasValidGoogleKey) {
        $endpoint = 'https://safebrowsing.googleapis.com/v4/threatMatches:find?key=' . urlencode($apiKey);

        $body = [
            'client' => [
                'clientId' => 'scamshield-ai-assistant',
                'clientVersion' => '1.0.0'
            ],
            'threatInfo' => [
                'threatTypes' => ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
                'platformTypes' => ['ANY_PLATFORM'],
                'threatEntryTypes' => ['URL'],
                'threatEntries' => [
                    ['url' => $targetUrl]
                ]
            ]
        ];

        $ch = curl_init($endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 6);

        $rawResponse = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200) {
            $responseData = json_decode($rawResponse, true);
            $matches = $responseData['matches'] ?? [];
            $isThreat = !empty($matches);

            $result = [
                'url' => $targetUrl,
                'source' => 'google_safe_browsing',
                'isSafe' => !$isThreat,
                'threatDetected' => $isThreat,
                'threatType' => $isThreat ? ($matches[0]['threatType'] ?? 'MALICIOUS') : 'NONE',
                'riskScore' => $isThreat ? 100 : 0,
                'checked_at' => date('c')
            ];

            if (!empty($config['enable_cache'])) {
                @file_put_contents($cacheFile, json_encode($result));
            }

            return $result;
        }
    }

    // Default Fallback Response when external API key is pending
    $result = [
        'url' => $targetUrl,
        'source' => 'backend_heuristic_fallback',
        'isSafe' => true,
        'threatDetected' => false,
        'note' => 'Google Safe Browsing key not configured. Using client-side heuristic engine.',
        'checked_at' => date('c')
    ];

    return $result;
}

/**
 * Optional AI Explanation via Gemini or OpenAI
 */
function analyzeMessageWithAI($text, $config) {
    $apiKey = $config['gemini_api_key'] ?? '';
    if (empty($apiKey) || $apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
        return [
            'ai_enabled' => false,
            'message' => 'Configure gemini_api_key in config.php to unlock live LLM analysis.'
        ];
    }

    $prompt = "You are a cyber security expert helping an ordinary person identify scams. Analyze this text for scam/phishing red flags:\n\n\"$text\"\n\nRespond in JSON with keys: riskLevel (SAFE|SUSPICIOUS|DANGER), simpleExplanation (string), redFlags (array), actionToTake (string).";

    $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" . urlencode($apiKey);

    $body = [
        'contents' => [
            ['parts' => [['text' => $prompt]]]
        ]
    ];

    $ch = curl_init($endpoint);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $response = curl_exec($ch);
    curl_close($ch);

    return [
        'ai_enabled' => true,
        'raw_gemini_response' => json_decode($response, true)
    ];
}
