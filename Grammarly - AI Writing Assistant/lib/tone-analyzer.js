/**
 * Grammarly - AI Writing Assistant
 * Tone Analyzer & Tone Rephraser Engine
 * Detects tone (Professional, Friendly, Confident, Academic, Urgent, Empathetic)
 * and provides instant rewriting suggestions.
 */

const ToneAnalyzer = {
  // Lexicon features for tone categories
  lexicon: {
    professional: [
      /\b(sincerely|regards|cordially|respectfully|pursuant|facilitate|implement|collaborate|coordinate|milestone|deliverable|objective|strategy|comprehensive|established|sufficient|appropriate|confirm|proceed|inquire|assist|request|schedule|agenda|feedback|opportunity)\b/gi,
      /\b(please let me know|look forward to|happy to assist|at your earliest convenience|for your reference)\b/gi
    ],
    friendly: [
      /\b(hey|hi|hello|awesome|great|cool|super|love|cheers|fun|glad|excited|wonderful|thanks|happy|sweet|rock|enjoy|breeze|yay)\b/gi,
      /\b(I'm|you're|we're|can't|won't|let's|gonna|wanna)\b/gi,
      /!{1}/g
    ],
    confident: [
      /\b(definitely|certainly|guarantee|proven|accomplish|succeed|deliver|achieve|confident|undoubtedly|clear|assert|master|lead|excel|ensure|convincing|will achieve|resolved)\b/gi,
      /\b(without doubt|rest assured|we will|i am certain|results speak)\b/gi
    ],
    academic: [
      /\b(furthermore|consequently|subsequently|moreover|thus|hence|in accordance|methodology|corpus|empirical|paradigm|hypothesis|significance|preliminary|theoretical|quantitative|qualitative|underlying|substantial)\b/gi
    ],
    urgent: [
      /\b(urgent|immediately|asap|deadline|critical|priority|crucial|vital|action required|emergency|time-sensitive|promptly|without delay|must have)\b/gi
    ],
    empathetic: [
      /\b(understand|appreciate|sympathize|compassion|considerate|kindly|grateful|apologize|supportive|patience|helpful|careful|generous|thoughtful|warmly)\b/gi,
      /\b(thank you for your time|appreciate your patience|understand your concern)\b/gi
    ]
  },

  /**
   * Analyze tone of text
   */
  analyze(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return {
        primary: 'Neutral',
        secondary: 'Balanced',
        summary: 'Neutral & Balanced tone',
        scores: {
          professional: 50,
          friendly: 50,
          confident: 50,
          academic: 20,
          urgent: 10,
          empathetic: 30
        },
        suggestions: []
      };
    }

    const clean = text.trim();
    const wordCount = (clean.match(/\b\w+\b/g) || []).length || 1;

    // Calculate hit frequencies
    const rawScores = {
      professional: 0,
      friendly: 0,
      confident: 0,
      academic: 0,
      urgent: 0,
      empathetic: 0
    };

    for (const [tone, patterns] of Object.entries(this.lexicon)) {
      for (const pat of patterns) {
        const matches = clean.match(pat);
        if (matches) {
          rawScores[tone] += matches.length * 15;
        }
      }
    }

    // Baseline normalization (0-100)
    const factor = Math.min(2.5, 100 / Math.max(10, wordCount));
    const scores = {
      professional: Math.min(100, Math.round(30 + (rawScores.professional * factor))),
      friendly: Math.min(100, Math.round(30 + (rawScores.friendly * factor))),
      confident: Math.min(100, Math.round(35 + (rawScores.confident * factor))),
      academic: Math.min(100, Math.round(15 + (rawScores.academic * factor))),
      urgent: Math.min(100, Math.round(10 + (rawScores.urgent * factor))),
      empathetic: Math.min(100, Math.round(25 + (rawScores.empathetic * factor)))
    };

    // Sort tones by score descending
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const topTone = sorted[0];
    const secondTone = sorted[1];

    const toneNames = {
      professional: 'Professional',
      friendly: 'Casual & Friendly',
      confident: 'Confident',
      academic: 'Academic / Formal',
      urgent: 'Urgent & Direct',
      empathetic: 'Empathetic & Polite'
    };

    const primary = topTone[1] >= 45 ? toneNames[topTone[0]] : 'Neutral / Direct';
    const secondary = secondTone[1] >= 40 ? toneNames[secondTone[0]] : 'Clear';

    // Tone suggestions
    const suggestions = [];
    if (scores.urgent > 65 && scores.empathetic < 30) {
      suggestions.push({
        type: 'Tone Advice',
        text: 'This message sounds quite urgent or blunt. Consider adding a polite greeting or courteous closing.'
      });
    }
    if (scores.friendly < 35 && scores.professional < 40 && scores.confident < 40) {
      suggestions.push({
        type: 'Tone Advice',
        text: 'The text is relatively neutral. You can make it warmer (friendly) or more structured (professional) based on your audience.'
      });
    }
    if (clean.includes('maybe') || clean.includes('I think') || clean.includes('I guess') || clean.includes('kind of')) {
      suggestions.push({
        type: 'Confidence Boost',
        text: 'Contains hedging phrases like "maybe" or "I think". Remove them for a more confident, assertive voice.'
      });
    }

    return {
      primary,
      secondary,
      summary: `${primary} · ${secondary}`,
      scores,
      suggestions
    };
  },

  /**
   * Rephrase text into target tone (Built-in offline intelligent rewriting)
   */
  rephrase(text, targetTone) {
    if (!text || typeof text !== 'string') return text;
    let modified = text.trim();

    switch (targetTone) {
      case 'professional':
        // Replace casual slang, conversational hedges with polished business terms
        modified = modified
          .replace(/\bhey\b/gi, 'Dear')
          .replace(/\bwhat's up\b/gi, 'I hope this message finds you well')
          .replace(/\bthanks\b/gi, 'Thank you')
          .replace(/\basap\b/gi, 'at your earliest convenience')
          .replace(/\bgonna\b/gi, 'going to')
          .replace(/\bwanna\b/gi, 'would like to')
          .replace(/\bgotta\b/gi, 'need to')
          .replace(/\bkinda\b/gi, 'somewhat')
          .replace(/\bawesome\b/gi, 'exceptional')
          .replace(/\bcool\b/gi, 'noted')
          .replace(/\bI think\b/gi, 'I recommend')
          .replace(/\bmaybe we can\b/gi, 'we propose to')
          .replace(/\blet me know\b/gi, 'please keep me informed')
          .replace(/!{2,}/g, '.');
        break;

      case 'friendly':
        // Make text warm, accessible, welcoming
        modified = modified
          .replace(/\bDear Sir\/Madam\b/gi, 'Hi there!')
          .replace(/\bSincerely\b/gi, 'Best wishes')
          .replace(/\bWith regards\b/gi, 'Cheers')
          .replace(/\bI am writing to inquire\b/gi, 'Just wanted to check in')
          .replace(/\bpursuant to\b/gi, 'as we discussed')
          .replace(/\butilize\b/gi, 'use')
          .replace(/\bcommence\b/gi, 'start')
          .replace(/\bterminate\b/gi, 'end');
        if (!modified.endsWith('!') && !modified.endsWith('?')) {
          modified += ' 😊';
        }
        break;

      case 'confident':
        // Remove hesitations, passive phrasing, doubt
        modified = modified
          .replace(/\bI think that\b/gi, 'Clearly,')
          .replace(/\bI believe that\b/gi, 'Evidence shows that')
          .replace(/\bI guess\b/gi, 'Indeed')
          .replace(/\bpossibly\b/gi, 'definitely')
          .replace(/\bmaybe\b/gi, 'certainly')
          .replace(/\bwe might be able to\b/gi, 'we will')
          .replace(/\btry to\b/gi, 'commit to')
          .replace(/\bsort of\b/gi, '')
          .replace(/\bkind of\b/gi, '');
        break;

      case 'concise':
        // Cut fluff, passive voice, and wordy filler
        modified = modified
          .replace(/\bin order to\b/gi, 'to')
          .replace(/\bat this point in time\b/gi, 'now')
          .replace(/\bdue to the fact that\b/gi, 'because')
          .replace(/\bhas the ability to\b/gi, 'can')
          .replace(/\bfor the purpose of\b/gi, 'to')
          .replace(/\bcompletely eliminate\b/gi, 'eliminate')
          .replace(/\bfirst and foremost\b/gi, 'first')
          .replace(/\beach and every\b/gi, 'each')
          .replace(/\bas a matter of fact\b/gi, 'in fact')
          .replace(/\bvery\s+/gi, '')
          .replace(/\breally\s+/gi, '');
        break;

      case 'empathetic':
        // Add courteous, polite, considerate tone
        modified = modified
          .replace(/\byou must\b/gi, 'we kindly ask that you')
          .replace(/\byou failed to\b/gi, 'we noticed that you may have missed')
          .replace(/\byou didn't\b/gi, 'it seems there was an omission with')
          .replace(/\bwrong\b/gi, 'needs a slight revision')
          .replace(/\bbad\b/gi, 'could be improved');
        if (!modified.toLowerCase().includes('thank')) {
          modified += ' Thank you for your understanding and collaboration!';
        }
        break;

      default:
        break;
    }

    return modified;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ToneAnalyzer;
}
