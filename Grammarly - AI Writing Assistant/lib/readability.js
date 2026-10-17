/**
 * Grammarly - AI Writing Assistant
 * Readability & Text Statistics Engine
 */

const ReadabilityEngine = {
  /**
   * Count syllables in an English word
   */
  countWordSyllables(word) {
    word = word.toLowerCase().trim();
    if (!word) return 0;
    if (word.length <= 3) return 1;

    // Remove non-alphabetic
    word = word.replace(/(?:[^laeiouy]|ed|es|e)$/, '');
    word = word.replace(/^y/, '');

    const syllableMatches = word.match(/[aeiouy]{1,2}/g);
    return syllableMatches ? Math.max(1, syllableMatches.length) : 1;
  },

  /**
   * Calculate text statistics
   */
  getStats(text) {
    if (!text || typeof text !== 'string') {
      return {
        wordCount: 0,
        charCount: 0,
        sentenceCount: 0,
        syllableCount: 0,
        avgWordsPerSentence: 0,
        avgSyllablesPerWord: 0,
        readingTimeSeconds: 0,
        speakingTimeSeconds: 0
      };
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return {
        wordCount: 0,
        charCount: 0,
        sentenceCount: 0,
        syllableCount: 0,
        avgWordsPerSentence: 0,
        avgSyllablesPerWord: 0,
        readingTimeSeconds: 0,
        speakingTimeSeconds: 0
      };
    }

    const words = trimmed.match(/[a-zA-Z0-9'’-]+/g) || [];
    const wordCount = words.length;
    const charCount = trimmed.length;

    // Sentence splitting by punctuation (. ! ?)
    const sentences = trimmed.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).filter(s => s.trim().length > 0);
    const sentenceCount = Math.max(1, sentences.length);

    let totalSyllables = 0;
    for (const w of words) {
      totalSyllables += this.countWordSyllables(w);
    }

    const avgWordsPerSentence = wordCount > 0 ? parseFloat((wordCount / sentenceCount).toFixed(1)) : 0;
    const avgSyllablesPerWord = wordCount > 0 ? parseFloat((totalSyllables / wordCount).toFixed(2)) : 0;

    // Average reading speed: 220 words per minute
    const readingTimeSeconds = Math.ceil((wordCount / 220) * 60);
    // Average speaking speed: 130 words per minute
    const speakingTimeSeconds = Math.ceil((wordCount / 130) * 60);

    return {
      wordCount,
      charCount,
      sentenceCount,
      syllableCount: totalSyllables,
      avgWordsPerSentence,
      avgSyllablesPerWord,
      readingTimeSeconds,
      speakingTimeSeconds
    };
  },

  /**
   * Flesch Reading Ease score (0 to 100)
   * Formula: 206.835 - 1.015 * (total words / total sentences) - 84.6 * (total syllables / total words)
   */
  getFleschReadingEase(stats) {
    if (stats.wordCount < 3) return 100;
    const score = 206.835 - (1.015 * stats.avgWordsPerSentence) - (84.6 * stats.avgSyllablesPerWord);
    return Math.max(0, Math.min(100, Math.round(score)));
  },

  /**
   * Flesch-Kincaid Grade Level
   * Formula: 0.39 * (total words / total sentences) + 11.8 * (total syllables / total words) - 15.59
   */
  getGradeLevel(stats) {
    if (stats.wordCount < 3) return 'Elementary';
    const grade = (0.39 * stats.avgWordsPerSentence) + (11.8 * stats.avgSyllablesPerWord) - 15.59;
    const rounded = Math.max(1, Math.round(grade));

    if (rounded <= 5) return '5th Grade (Very Easy)';
    if (rounded <= 6) return '6th Grade (Easy)';
    if (rounded <= 8) return '7th-8th Grade (Plain English)';
    if (rounded <= 10) return '9th-10th Grade (Conversational)';
    if (rounded <= 12) return 'High School';
    if (rounded <= 16) return 'College Level';
    return 'Graduate / Scholarly';
  },

  /**
   * Get readability qualitative description
   */
  getReadabilityLabel(score) {
    if (score >= 90) return { label: 'Very Easy', color: '#10b981', desc: 'Easily understood by an average 11-year-old student' };
    if (score >= 80) return { label: 'Easy', color: '#10b981', desc: 'Conversational English for consumers' };
    if (score >= 70) return { label: 'Fairly Easy', color: '#3b82f6', desc: 'Accessible to most readers' };
    if (score >= 60) return { label: 'Standard', color: '#3b82f6', desc: 'Plain English, easily understood by 13-15 year olds' };
    if (score >= 50) return { label: 'Fairly Difficult', color: '#f59e0b', desc: 'High school reading level' };
    if (score >= 30) return { label: 'Difficult', color: '#f97316', desc: 'College level reading' };
    return { label: 'Very Difficult', color: '#ef4444', desc: 'Best suited for university graduates & specialists' };
  },

  /**
   * Overall Quality Score (0-100) taking into account issues count and length
   */
  calculateOverallScore(wordCount, issuesCount) {
    if (wordCount === 0) return 100;
    // Issue density penalty
    const issuesPerHundredWords = (issuesCount / Math.max(15, wordCount)) * 100;
    const penalty = issuesPerHundredWords * 14;
    const score = Math.max(35, Math.min(100, Math.round(100 - penalty)));
    return score;
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReadabilityEngine;
}
