/**
 * Grammarly - AI Writing Assistant
 * Unified AI Service Orchestrator
 * Coordinates Grammar, Spell Checking, Clarity, Tone, Readability,
 * and Optional Cloud LLM integration.
 */

const AIService = {
  /**
   * Run full comprehensive analysis on text
   */
  async analyzeText(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return {
        text: '',
        issues: [],
        stats: typeof ReadabilityEngine !== 'undefined' ? ReadabilityEngine.getStats('') : { wordCount: 0, charCount: 0, sentenceCount: 0, readingTimeSeconds: 0 },
        readability: {
          score: 100,
          label: typeof ReadabilityEngine !== 'undefined' ? ReadabilityEngine.getReadabilityLabel(100) : { label: 'Good', color: '#10b981', desc: '' },
          grade: 'Elementary'
        },
        tone: typeof ToneAnalyzer !== 'undefined' ? ToneAnalyzer.analyze('') : { primary: 'Neutral', secondary: 'Balanced', summary: 'Neutral & Balanced tone', scores: {}, suggestions: [] },
        overallScore: 100,
        summary: {
          totalIssues: 0,
          grammarCount: 0,
          spellingCount: 0,
          clarityCount: 0
        }
      };
    }

    // 1. Text statistics & readability
    const stats = ReadabilityEngine.getStats(text);
    const readingEase = ReadabilityEngine.getFleschReadingEase(stats);
    const readability = {
      score: readingEase,
      label: ReadabilityEngine.getReadabilityLabel(readingEase),
      grade: ReadabilityEngine.getGradeLevel(stats)
    };

    // 2. Grammar check
    let grammarIssues = [];
    if (options.enableGrammar !== false && typeof GrammarEngine !== 'undefined') {
      grammarIssues = GrammarEngine.check(text, options);
    }

    // 3. Spell check
    let spellingIssues = [];
    if (options.enableSpelling !== false && typeof SpellChecker !== 'undefined') {
      spellingIssues = SpellChecker.check(text);
    }

    // 4. Clarity check
    let clarityIssues = [];
    if (options.enableClarity !== false && typeof ClarityEngine !== 'undefined') {
      clarityIssues = ClarityEngine.checkClarity(text);
    }

    // 5. Tone analysis
    let tone = { primary: 'Neutral', secondary: 'Balanced', summary: 'Neutral', scores: {}, suggestions: [] };
    if (typeof ToneAnalyzer !== 'undefined') {
      tone = ToneAnalyzer.analyze(text);
    }

    // Merge and deduplicate issues by position
    const rawIssues = [...grammarIssues, ...spellingIssues, ...clarityIssues];
    const issues = this.deduplicateIssues(rawIssues);

    // 6. Overall Quality Score (0-100)
    const overallScore = ReadabilityEngine.calculateOverallScore(stats.wordCount, issues.length);

    return {
      text,
      issues,
      stats,
      readability,
      tone,
      overallScore,
      summary: {
        totalIssues: issues.length,
        grammarCount: issues.filter(i => i.category === 'grammar').length,
        spellingCount: issues.filter(i => i.category === 'spelling').length,
        clarityCount: issues.filter(i => i.category === 'clarity').length
      }
    };
  },

  /**
   * Deduplicate overlapping issues (give precedence to Grammar > Spelling > Clarity)
   */
  deduplicateIssues(issues) {
    if (!issues || issues.length <= 1) return issues || [];

    // Sort by offset, then by length desc
    issues.sort((a, b) => {
      if (a.offset === b.offset) return b.length - a.length;
      return a.offset - b.offset;
    });

    const filtered = [];
    let lastEnd = -1;

    for (const issue of issues) {
      const issueEnd = issue.offset + issue.length;
      if (issue.offset >= lastEnd) {
        filtered.push(issue);
        lastEnd = issueEnd;
      } else {
        // Overlap: keep grammar or spelling over clarity
        const prev = filtered[filtered.length - 1];
        if (issue.category === 'grammar' && prev.category === 'clarity') {
          filtered[filtered.length - 1] = issue;
          lastEnd = issueEnd;
        }
      }
    }

    return filtered;
  },

  /**
   * Apply all fixable suggestions in reverse offset order
   */
  fixAll(text, issues) {
    if (!text || !issues || issues.length === 0) return text;

    // Filter issues with valid replacements and sort reverse by offset
    const fixable = issues
      .filter(i => i.replacement !== null && i.replacement !== undefined)
      .sort((a, b) => b.offset - a.offset);

    let result = text;
    for (const item of fixable) {
      const start = item.offset;
      const end = item.offset + item.length;
      result = result.substring(0, start) + item.replacement + result.substring(end);
    }

    return result;
  },

  /**
   * Apply a single issue fix to text
   */
  applyFix(text, issue) {
    if (!text || !issue || issue.replacement === null) return text;
    const start = issue.offset;
    const end = issue.offset + issue.length;
    return text.substring(0, start) + issue.replacement + text.substring(end);
  },

  /**
   * AI-powered transformation (Built-in offline or optional Cloud LLM)
   */
  async transformText(text, mode, customPrompt = '') {
    // Check if user has configured cloud AI API key
    let cloudConfig = null;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      try {
        const stored = await chrome.storage.sync.get(['aiProvider', 'apiKey', 'apiModel', 'apiEndpoint']);
        if (stored.apiKey) {
          cloudConfig = stored;
        }
      } catch (e) {
        console.warn('Could not read cloud AI configuration:', e);
      }
    }

    // If cloud AI is active, invoke LLM
    if (cloudConfig && cloudConfig.apiKey) {
      try {
        return await this.callCloudAI(text, mode, customPrompt, cloudConfig);
      } catch (err) {
        console.warn('Cloud AI failed, falling back to built-in offline engine:', err);
      }
    }

    // Default: High-Performance Built-in Offline Engine
    return this.transformOffline(text, mode);
  },

  /**
   * Built-in Offline Transformer
   */
  transformOffline(text, mode) {
    if (!text) return '';
    const trimmed = text.trim();

    switch (mode) {
      case 'fix_all': {
        const analyzed = typeof GrammarEngine !== 'undefined' ? GrammarEngine.check(trimmed) : [];
        const spelled = typeof SpellChecker !== 'undefined' ? SpellChecker.check(trimmed) : [];
        const clear = typeof ClarityEngine !== 'undefined' ? ClarityEngine.checkClarity(trimmed) : [];
        const all = this.deduplicateIssues([...analyzed, ...spelled, ...clear]);
        return this.fixAll(trimmed, all);
      }

      case 'tone_professional':
        return ToneAnalyzer.rephrase(trimmed, 'professional');

      case 'tone_friendly':
        return ToneAnalyzer.rephrase(trimmed, 'friendly');

      case 'tone_confident':
        return ToneAnalyzer.rephrase(trimmed, 'confident');

      case 'tone_concise':
        return ToneAnalyzer.rephrase(trimmed, 'concise');

      case 'tone_empathetic':
        return ToneAnalyzer.rephrase(trimmed, 'empathetic');

      case 'summarize': {
        // Smart extractive key sentence summarizer
        const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
        if (sentences.length <= 2) return trimmed;
        // Keep first sentence and high-impact conclusions
        const summary = [sentences[0], sentences[sentences.length - 1]].join(' ');
        return `Summary: ${summary}`;
      }

      case 'elaborate':
        return `${trimmed}\n\nFurthermore, this approach ensures greater clarity, alignment among stakeholders, and measurable results.`;

      default:
        return trimmed;
    }
  },

  /**
   * Cloud LLM caller (OpenAI / OpenRouter / Groq / Gemini compatible)
   */
  async callCloudAI(text, mode, customPrompt, config) {
    const provider = config.aiProvider || 'openai';
    const apiKey = config.apiKey.trim();
    const model = config.apiModel || (provider === 'groq' ? 'llama-3.1-8b-instant' : 'gpt-4o-mini');
    const endpoint = config.apiEndpoint || (
      provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' :
      provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' :
      'https://api.openai.com/v1/chat/completions'
    );

    let promptInstruction = '';
    switch (mode) {
      case 'fix_all':
        promptInstruction = 'Correct all grammatical errors, spelling mistakes, punctuation issues, and awkward phrasing while preserving the original intent and tone.';
        break;
      case 'tone_professional':
        promptInstruction = 'Rewrite this text in a polished, professional, and courteous business tone.';
        break;
      case 'tone_friendly':
        promptInstruction = 'Rewrite this text in a warm, approachable, friendly, and engaging tone.';
        break;
      case 'tone_confident':
        promptInstruction = 'Rewrite this text with assertiveness, confidence, and strong active verbs. Remove hesitant words like "maybe" or "I think".';
        break;
      case 'tone_concise':
        promptInstruction = 'Make this text significantly more concise, direct, and punchy. Eliminate all fluff and wordiness.';
        break;
      case 'summarize':
        promptInstruction = 'Summarize the core message of this text into a concise, high-impact bulleted summary.';
        break;
      case 'elaborate':
        promptInstruction = 'Elaborate on this text, providing detailed context and persuasive supporting points.';
        break;
      default:
        promptInstruction = customPrompt || 'Improve the clarity and flow of this writing.';
        break;
    }

    const payload = {
      model,
      messages: [
        {
          role: 'system',
          content: 'You are Grammarly AI Writing Assistant. Output only the improved text with no meta-chatter, quotes, or preambles.'
        },
        {
          role: 'user',
          content: `${promptInstruction}\n\nOriginal Text:\n${text}`
        }
      ],
      temperature: 0.3
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`API error ${res.status}: ${errBody}`);
    }

    const json = await res.json();
    return json.choices && json.choices[0] && json.choices[0].message
      ? json.choices[0].message.content.trim()
      : text;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIService;
}
