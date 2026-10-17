/**
 * Grammarly - AI Writing Assistant
 * Clarity & Conciseness Engine
 * Detects wordy phrases, redundancies, passive voice, and complex sentences
 */

const ClarityEngine = {
  // Concise alternatives for wordy expressions
  wordyPhrases: [
    { pattern: /\bin order to\b/gi, replacement: 'to', desc: 'Simplify "in order to" to the more direct "to".' },
    { pattern: /\bat this point in time\b/gi, replacement: 'now', desc: '"Now" or "currently" is more concise.' },
    { pattern: /\bat the present time\b/gi, replacement: 'currently', desc: '"Currently" or "now" is more direct.' },
    { pattern: /\bdue to the fact that\b/gi, replacement: 'because', desc: 'Use "because" for cleaner flow.' },
    { pattern: /\bhas the ability to\b/gi, replacement: 'can', desc: 'Replace with "can" to improve conciseness.' },
    { pattern: /\bis able to\b/gi, replacement: 'can', desc: 'Use "can" for a punchier active voice.' },
    { pattern: /\bin the event that\b/gi, replacement: 'if', desc: '"If" is clearer and more concise.' },
    { pattern: /\bfor the purpose of\b/gi, replacement: 'to', desc: 'Replace with "to" or "for".' },
    { pattern: /\ba large number of\b/gi, replacement: 'many', desc: 'Use "many" instead of "a large number of".' },
    { pattern: /\ba majority of\b/gi, replacement: 'most', desc: '"Most" makes your sentence simpler and clearer.' },
    { pattern: /\bin spite of the fact that\b/gi, replacement: 'although', desc: 'Use "although" or "even though".' },
    { pattern: /\bas a matter of fact\b/gi, replacement: 'in fact', desc: '"In fact" or "actually" is more concise.' },
    { pattern: /\bconduct an investigation into\b/gi, replacement: 'investigate', desc: 'Use the strong active verb "investigate".' },
    { pattern: /\bmake a decision\b/gi, replacement: 'decide', desc: 'Use the direct verb "decide".' },
    { pattern: /\btake into consideration\b/gi, replacement: 'consider', desc: 'Use the direct verb "consider".' },
    { pattern: /\bgive consideration to\b/gi, replacement: 'consider', desc: 'Use "consider" instead.' },
    { pattern: /\breach a conclusion\b/gi, replacement: 'conclude', desc: 'Use the active verb "conclude".' },
    { pattern: /\bwith reference to\b/gi, replacement: 'regarding', desc: 'Use "regarding" or "about".' },
    { pattern: /\bin reference to\b/gi, replacement: 'about', desc: 'Use "about" or "regarding".' },
    { pattern: /\bat an early date\b/gi, replacement: 'soon', desc: '"Soon" is clearer and more natural.' },
    { pattern: /\bin close proximity to\b/gi, replacement: 'near', desc: 'Use "near" for greater clarity.' },
    { pattern: /\bwith the exception of\b/gi, replacement: 'except', desc: 'Use "except" instead of "with the exception of".' },
    { pattern: /\bin a position to\b/gi, replacement: 'able to', desc: 'Replace with "able to" or "can".' },
    { pattern: /\bprior to\b/gi, replacement: 'before', desc: '"Before" sounds more natural and direct.' },
    { pattern: /\bsubsequent to\b/gi, replacement: 'after', desc: '"After" is simpler and cleaner.' },
    { pattern: /\buntil such time as\b/gi, replacement: 'until', desc: '"Until" is much more concise.' },
    { pattern: /\bit is important to note that\b/gi, replacement: 'notably', desc: 'Consider "notably" or stating the fact directly.' }
  ],

  // Redundant phrases (saying the same thing twice)
  redundancies: [
    { pattern: /\bcompletely eliminate\b/gi, replacement: 'eliminate', desc: '"Eliminate" already means complete removal.' },
    { pattern: /\bend result\b/gi, replacement: 'result', desc: 'A result is inherently at the end.' },
    { pattern: /\bfuture plans\b/gi, replacement: 'plans', desc: 'Plans are inherently for the future.' },
    { pattern: /\bpast history\b/gi, replacement: 'history', desc: 'History is already in the past.' },
    { pattern: /\bpast memories\b/gi, replacement: 'memories', desc: 'Memories are by definition from the past.' },
    { pattern: /\brevert back\b/gi, replacement: 'revert', desc: '"Revert" already implies returning back.' },
    { pattern: /\brepeat again\b/gi, replacement: 'repeat', desc: '"Repeat" already means to do again.' },
    { pattern: /\bbasic fundamentals\b/gi, replacement: 'fundamentals', desc: '"Fundamentals" are inherently basic.' },
    { pattern: /\bunexpected surprise\b/gi, replacement: 'surprise', desc: 'Surprises are by nature unexpected.' },
    { pattern: /\bclose proximity\b/gi, replacement: 'proximity', desc: 'Proximity already denotes closeness.' },
    { pattern: /\bsum total\b/gi, replacement: 'total', desc: 'Use "total" or "sum" alone.' },
    { pattern: /\beach and every\b/gi, replacement: 'each', desc: '"Each" is more concise than "each and every".' },
    { pattern: /\bfirst and foremost\b/gi, replacement: 'first', desc: '"First" is direct and sufficient.' },
    { pattern: /\bfree gift\b/gi, replacement: 'gift', desc: 'Gifts are inherently free.' },
    { pattern: /\bfinal outcome\b/gi, replacement: 'outcome', desc: 'An outcome is the final state.' },
    { pattern: /\bcollaborate together\b/gi, replacement: 'collaborate', desc: '"Collaborate" already means working together.' },
    { pattern: /\bjoin together\b/gi, replacement: 'join', desc: '"Join" already implies togetherness.' }
  ],

  /**
   * Check for wordiness & redundancies
   */
  checkClarity(text) {
    if (!text || typeof text !== 'string') return [];
    const issues = [];

    // 1. Wordy phrases
    for (const item of this.wordyPhrases) {
      item.pattern.lastIndex = 0;
      let match;
      while ((match = item.pattern.exec(text)) !== null) {
        const isCapitalized = match[0][0] === match[0][0].toUpperCase();
        const repl = isCapitalized
          ? item.replacement.charAt(0).toUpperCase() + item.replacement.slice(1)
          : item.replacement;

        issues.push({
          id: 'clarity_wordy_' + match.index,
          category: 'clarity',
          type: 'Wordy Phrase',
          text: match[0],
          offset: match.index,
          length: match[0].length,
          replacement: repl,
          explanation: item.desc
        });
      }
    }

    // 2. Redundancies
    for (const item of this.redundancies) {
      item.pattern.lastIndex = 0;
      let match;
      while ((match = item.pattern.exec(text)) !== null) {
        const isCapitalized = match[0][0] === match[0][0].toUpperCase();
        const repl = isCapitalized
          ? item.replacement.charAt(0).toUpperCase() + item.replacement.slice(1)
          : item.replacement;

        issues.push({
          id: 'clarity_redundancy_' + match.index,
          category: 'clarity',
          type: 'Redundant Expression',
          text: match[0],
          offset: match.index,
          length: match[0].length,
          replacement: repl,
          explanation: item.desc
        });
      }
    }

    // 3. Passive voice detection
    // e.g., "was completed by", "is written by", "were tested by", "has been approved by"
    const passiveRegex = /\b(is|are|was|were|been|being)\s+([a-z]+ed|[a-z]+en)\s+by\b/gi;
    let pMatch;
    while ((pMatch = passiveRegex.exec(text)) !== null) {
      issues.push({
        id: 'clarity_passive_' + pMatch.index,
        category: 'clarity',
        type: 'Passive Voice',
        text: pMatch[0],
        offset: pMatch.index,
        length: pMatch[0].length,
        replacement: null, // Open suggestion
        explanation: `Passive voice construction ("${pMatch[0]}"). Consider rewriting in the active voice for more direct, engaging communication.`
      });
    }

    // 4. Overly long / run-on sentences (> 35 words)
    const sentences = text.split(/(?<=[.!?])\s+/);
    let cumulativeOffset = 0;
    for (const s of sentences) {
      const words = s.trim().match(/[a-zA-Z0-9'’-]+/g) || [];
      if (words.length > 35) {
        issues.push({
          id: 'clarity_long_sentence_' + cumulativeOffset,
          category: 'clarity',
          type: 'Long Sentence',
          text: s.length > 60 ? s.slice(0, 57) + '...' : s,
          offset: cumulativeOffset,
          length: s.length,
          replacement: null,
          explanation: `This sentence is ${words.length} words long. Long sentences can reduce comprehension. Consider splitting it into two shorter sentences.`
        });
      }
      cumulativeOffset += s.length + 1;
    }

    return issues.sort((a, b) => a.offset - b.offset);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ClarityEngine;
}
