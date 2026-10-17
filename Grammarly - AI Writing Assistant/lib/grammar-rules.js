/**
 * Grammarly - AI Writing Assistant
 * Grammar & Syntax Checking Engine
 */

const GrammarEngine = {
  // Built-in rule catalogue
  rules: [
    // --- 1. Common Confusions / Homophones ---
    {
      id: 'their_there_theyre',
      category: 'grammar',
      name: 'Confused Word: Their / There / They\'re',
      check(text) {
        const issues = [];
        // "their are" -> "there are"
        const reg1 = /\b(their)\s+(is|are|was|were|will|has|have|had|seems|looks)\b/gi;
        let match;
        while ((match = reg1.exec(text)) !== null) {
          const matchedWord = match[1];
          const repl = match[0].replace(new RegExp(`^${matchedWord}`, 'i'), matchedWord[0] === matchedWord[0].toUpperCase() ? 'There' : 'there');
          issues.push({
            id: 'their_there_1_' + match.index,
            category: 'grammar',
            type: 'Confused Word',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: `Did you mean "${repl}"? "Their" indicates possession, while "there" refers to a place or existence.`
          });
        }
        // "there house", "there car", "there opinions" (possessive noun)
        const reg2 = /\b(there)\s+(car|house|dog|cat|books|work|job|idea|family|team|name|efforts|children|friends|parents|lives|eyes|hands|head|mind|goals)\b/gi;
        while ((match = reg2.exec(text)) !== null) {
          const matchedWord = match[1];
          const repl = match[0].replace(new RegExp(`^${matchedWord}`, 'i'), matchedWord[0] === matchedWord[0].toUpperCase() ? 'Their' : 'their');
          issues.push({
            id: 'there_their_2_' + match.index,
            category: 'grammar',
            type: 'Confused Word',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: `Did you mean "${repl}"? Use "their" to show possession.`
          });
        }
        // "they're" instead of "their"
        const reg3 = /\b(they're|theyre)\s+(car|house|dog|cat|books|work|job|idea|family|team|name|efforts|children|friends|parents|lives|goals)\b/gi;
        while ((match = reg3.exec(text)) !== null) {
          const matchedWord = match[1];
          const repl = match[0].replace(new RegExp(`^${matchedWord}`, 'i'), matchedWord[0] === matchedWord[0].toUpperCase() ? 'Their' : 'their');
          issues.push({
            id: 'theyre_their_3_' + match.index,
            category: 'grammar',
            type: 'Confused Word',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: `Did you mean "${repl}"? "They're" is short for "they are", whereas "their" indicates possession.`
          });
        }
        return issues;
      }
    },

    {
      id: 'your_youre',
      category: 'grammar',
      name: 'Confused Word: Your vs You\'re',
      check(text) {
        const issues = [];
        // "your welcome" -> "you're welcome"
        const reg1 = /\b(your)\s+(welcome|right|wrong|invited|going|doing|coming|making|saying|beautiful|amazing|awesome|late|early)\b/gi;
        let match;
        while ((match = reg1.exec(text)) !== null) {
          const matchedWord = match[1];
          const repl = match[0].replace(new RegExp(`^${matchedWord}`, 'i'), matchedWord[0] === matchedWord[0].toUpperCase() ? "You're" : "you're");
          issues.push({
            id: 'your_youre_' + match.index,
            category: 'grammar',
            type: 'Confused Word',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: `Did you mean "${repl}"? Use "you're" as a contraction for "you are".`
          });
        }
        // "you're car", "you're name" -> "your car", "your name"
        const reg2 = /\b(you're|youre)\s+(car|house|dog|cat|book|work|job|idea|family|team|name|phone|email|account|profile|feedback|time|effort)\b/gi;
        while ((match = reg2.exec(text)) !== null) {
          const matchedWord = match[1];
          const repl = match[0].replace(new RegExp(`^${matchedWord}`, 'i'), matchedWord[0] === matchedWord[0].toUpperCase() ? 'Your' : 'your');
          issues.push({
            id: 'youre_your_' + match.index,
            category: 'grammar',
            type: 'Confused Word',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: `Did you mean "${repl}"? Use "your" to denote possession.`
          });
        }
        return issues;
      }
    },

    {
      id: 'its_it_is',
      category: 'grammar',
      name: 'Confused Word: Its vs It\'s',
      check(text) {
        const issues = [];
        // "its a", "its an", "its the", "its not", "its been" -> "it's"
        const reg1 = /\b(its)\s+(a|an|the|not|been|going|important|clear|obvious|time|too|very|really|great|essential)\b/gi;
        let match;
        while ((match = reg1.exec(text)) !== null) {
          const matchedWord = match[1];
          const repl = match[0].replace(new RegExp(`^${matchedWord}`, 'i'), matchedWord[0] === matchedWord[0].toUpperCase() ? "It's" : "it's");
          issues.push({
            id: 'its_it_is_' + match.index,
            category: 'grammar',
            type: 'Confused Word',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: `Did you mean "${repl}"? Use "it's" as a contraction for "it is" or "it has".`
          });
        }
        // "it's color", "it's speed", "it's design" -> "its color"
        const reg2 = /\b(it's)\s+(color|speed|design|performance|name|purpose|origin|size|weight|impact|flavor|structure|battery)\b/gi;
        while ((match = reg2.exec(text)) !== null) {
          const matchedWord = match[1];
          const repl = match[0].replace(new RegExp(`^${matchedWord}`, 'i'), matchedWord[0] === matchedWord[0].toUpperCase() ? "Its" : "its");
          issues.push({
            id: 'it_is_its_' + match.index,
            category: 'grammar',
            type: 'Confused Word',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: `Did you mean "${repl}"? "Its" is the possessive form with no apostrophe.`
          });
        }
        return issues;
      }
    },

    {
      id: 'then_than',
      category: 'grammar',
      name: 'Confused Word: Then vs Than',
      check(text) {
        const issues = [];
        // Comparative with "then" -> "than" (e.g. "better then", "more then", "faster then")
        const reg1 = /\b(better|worse|more|less|faster|slower|bigger|smaller|greater|higher|lower|older|younger|rather|other)\s+(then)\b/gi;
        let match;
        while ((match = reg1.exec(text)) !== null) {
          const repl = match[0].replace(/then$/i, 'than');
          issues.push({
            id: 'then_than_' + match.index,
            category: 'grammar',
            type: 'Confused Word',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: `Did you mean "${repl}"? Use "than" for comparisons and "then" for time sequences.`
          });
        }
        return issues;
      }
    },

    {
      id: 'affect_effect',
      category: 'grammar',
      name: 'Confused Word: Affect vs Effect',
      check(text) {
        const issues = [];
        // "the affect", "an affect" -> "the effect"
        const reg1 = /\b(the|an|a|this|that|any|positive|negative|side)\s+(affect)\b/gi;
        let match;
        while ((match = reg1.exec(text)) !== null) {
          const repl = match[0].replace(/affect$/i, 'effect');
          issues.push({
            id: 'affect_effect_noun_' + match.index,
            category: 'grammar',
            type: 'Confused Word',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: `Did you mean "${repl}"? "Effect" is usually a noun (the result), while "affect" is a verb (to influence).`
          });
        }
        // "will effect", "to effect", "can effect" -> "will affect"
        const reg2 = /\b(will|can|could|would|should|might|may|to|negatively|positively)\s+(effect)\b/gi;
        while ((match = reg2.exec(text)) !== null) {
          const repl = match[0].replace(/effect$/i, 'affect');
          issues.push({
            id: 'affect_effect_verb_' + match.index,
            category: 'grammar',
            type: 'Confused Word',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: `Did you mean "${repl}"? "Affect" is typically a verb meaning to produce an impact or change.`
          });
        }
        return issues;
      }
    },

    {
      id: 'lose_loose',
      category: 'grammar',
      name: 'Confused Word: Lose vs Loose',
      check(text) {
        const issues = [];
        // "loose weight", "loose money", "loose the game", "going to loose"
        const reg1 = /\b(going to|will|to|don't|did not|might|can|could)\s+(loose)\b/gi;
        let match;
        while ((match = reg1.exec(text)) !== null) {
          const repl = match[0].replace(/loose$/i, 'lose');
          issues.push({
            id: 'lose_loose_' + match.index,
            category: 'grammar',
            type: 'Confused Word',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: `Did you mean "${repl}"? "Lose" means to suffer a loss; "loose" means not tight.`
          });
        }
        const reg2 = /\b(loose)\s+(weight|money|hope|focus|control|access|time|the game|your mind)\b/gi;
        while ((match = reg2.exec(text)) !== null) {
          const repl = match[0].replace(/^loose/i, 'lose');
          issues.push({
            id: 'loose_verb_' + match.index,
            category: 'grammar',
            type: 'Confused Word',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: `Did you mean "${repl}"? "Lose" means to misplace or forfeit; "loose" means not tight.`
          });
        }
        return issues;
      }
    },

    // --- 2. Modal Verb Preposition Errors ("could of", "should of", "would of") ---
    {
      id: 'modal_of_have',
      category: 'grammar',
      name: 'Incorrect Preposition with Modals',
      check(text) {
        const issues = [];
        const reg = /\b(could|should|would|might|must)\s+of\b/gi;
        let match;
        while ((match = reg.exec(text)) !== null) {
          const modal = match[1];
          const repl = `${modal} have`;
          issues.push({
            id: 'modal_of_' + match.index,
            category: 'grammar',
            type: 'Grammar Error',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: `"${match[0]}" is incorrect. Use "${repl}" (or "${modal}'ve").`
          });
        }
        return issues;
      }
    },

    // --- 3. Indefinite Articles (A vs An) ---
    {
      id: 'indefinite_articles',
      category: 'grammar',
      name: 'Indefinite Article Usage',
      check(text) {
        const issues = [];
        // "a" before vowel sound words
        const regA = /\b(a)\s+([aeio][a-z]*|urgent[a-z]*|obvious[a-z]*|important[a-z]*|hour[a-z]*|honest[a-z]*|honor[a-z]*)\b/gi;
        let match;
        while ((match = regA.exec(text)) !== null) {
          const nextWord = match[2].toLowerCase();
          // Skip exceptions starting with 'u' that sound like 'y' (university, user, unique, European, one)
          if (/^(uniform|unique|universal|university|user|useful|useless|euphemism|european|one)\b/i.test(nextWord)) {
            continue;
          }
          const repl = (match[1][0] === 'A' ? 'An ' : 'an ') + match[2];
          issues.push({
            id: 'article_an_' + match.index,
            category: 'grammar',
            type: 'Article Mistake',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: `Use "an" instead of "a" before words starting with a vowel sound.`
          });
        }

        // "an" before consonant sound words
        const regAn = /\b(an)\s+([bcdfghjklmpqrstvwxyz][a-z]*|uniform[a-z]*|unique[a-z]*|universal[a-z]*|university|user[a-z]*|useful[a-z]*|useless|european[a-z]*|one)\b/gi;
        while ((match = regAn.exec(text)) !== null) {
          const nextWord = match[2].toLowerCase();
          // Exclude vowel sound 'h' (hour, honest, honor, heir)
          if (/^(hour|honest|honor|heir)/i.test(nextWord)) {
            continue;
          }

          const repl = (match[1][0] === 'A' ? 'A ' : 'a ') + match[2];
          issues.push({
            id: 'article_a_' + match.index,
            category: 'grammar',
            type: 'Article Mistake',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: `Use "a" instead of "an" before words starting with a consonant sound.`
          });
        }
        return issues;
      }
    },

    // --- 4. Subject-Verb Agreement ---
    {
      id: 'subject_verb_agreement',
      category: 'grammar',
      name: 'Subject-Verb Agreement',
      check(text) {
        const issues = [];
        // "He/She/It have" -> "has"
        const reg1 = /\b(he|she|it|this|that|everyone|everybody|someone|somebody|anyone|anybody|nobody|each)\s+(have)\b/gi;
        let match;
        while ((match = reg1.exec(text)) !== null) {
          const repl = `${match[1]} has`;
          issues.push({
            id: 'sva_have_' + match.index,
            category: 'grammar',
            type: 'Subject-Verb Agreement',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: `The singular subject "${match[1]}" requires the singular verb "has".`
          });
        }

        // "They/We/You is/was" -> "are/were"
        const reg2 = /\b(they|we|you)\s+(is)\b/gi;
        while ((match = reg2.exec(text)) !== null) {
          const repl = `${match[1]} are`;
          issues.push({
            id: 'sva_is_' + match.index,
            category: 'grammar',
            type: 'Subject-Verb Agreement',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: `The plural pronoun "${match[1]}" requires the verb "are".`
          });
        }

        const reg3 = /\b(they|we|you)\s+(was)\b/gi;
        while ((match = reg3.exec(text)) !== null) {
          const repl = `${match[1]} were`;
          issues.push({
            id: 'sva_was_' + match.index,
            category: 'grammar',
            type: 'Subject-Verb Agreement',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: `The pronoun "${match[1]}" requires the plural past verb "were".`
          });
        }

        // "He/She don't" -> "doesn't"
        const reg4 = /\b(he|she|it|everyone|everybody)\s+(don't|dont)\b/gi;
        while ((match = reg4.exec(text)) !== null) {
          const repl = `${match[1]} doesn't`;
          issues.push({
            id: 'sva_dont_' + match.index,
            category: 'grammar',
            type: 'Subject-Verb Agreement',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: `Third-person singular subjects take "doesn't" rather than "don't".`
          });
        }

        // "Everyone are" -> "Everyone is"
        const reg5 = /\b(everyone|everybody|nobody|each of them)\s+(are|were)\b/gi;
        while ((match = reg5.exec(text)) !== null) {
          const repl = `${match[1]} ${match[2].toLowerCase() === 'are' ? 'is' : 'was'}`;
          issues.push({
            id: 'sva_indefinite_' + match.index,
            category: 'grammar',
            type: 'Subject-Verb Agreement',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: `Indefinite pronouns like "${match[1]}" are grammatically singular.`
          });
        }

        return issues;
      }
    },

    // --- 5. Repeated / Duplicate Words ---
    {
      id: 'duplicate_words',
      category: 'grammar',
      name: 'Repeated Words',
      check(text) {
        const issues = [];
        const reg = /\b(the|is|in|that|and|to|with|of|for|on|at|it|you|we)\s+\1\b/gi;
        let match;
        while ((match = reg.exec(text)) !== null) {
          const singleWord = match[1];
          issues.push({
            id: 'dup_word_' + match.index,
            category: 'grammar',
            type: 'Duplicate Word',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: singleWord,
            explanation: `The word "${singleWord}" is duplicated. Remove the repetition.`
          });
        }
        return issues;
      }
    },

    // --- 6. Incorrect Idioms and Non-standard Expressions ---
    {
      id: 'nonstandard_idioms',
      category: 'grammar',
      name: 'Common Idiom & Expression Fixes',
      check(text) {
        const idioms = [
          { pattern: /\birregardless\b/gi, repl: 'regardless', desc: '"Irregardless" is nonstandard English. Use "regardless".' },
          { pattern: /\bsupposably\b/gi, repl: 'supposedly', desc: 'Did you mean "supposedly"?' },
          { pattern: /\bfor all intensive purposes\b/gi, repl: 'for all intents and purposes', desc: 'The correct idiom is "for all intents and purposes".' },
          { pattern: /\bone in the same\b/gi, repl: 'one and the same', desc: 'The correct idiom is "one and the same".' },
          { pattern: /\bnip it in the butt\b/gi, repl: 'nip it in the bud', desc: 'The correct idiom is "nip it in the bud".' },
          { pattern: /\bsneak peak\b/gi, repl: 'sneak peek', desc: '"Peak" is a mountain summit. Use "peek" for a preview.' },
          { pattern: /\bpeace of mind\b/gi, repl: 'peace of mind', desc: null },
          { pattern: /\bpiece of mind\b/gi, repl: 'peace of mind', desc: 'Did you mean "peace of mind" (tranquility)?' },
          { pattern: /\bchomping at the bit\b/gi, repl: 'champing at the bit', desc: 'The traditional expression is "champing at the bit".' },
          { pattern: /\bbare in mind\b/gi, repl: 'bear in mind', desc: 'Did you mean "bear in mind" (remember)?' },
          { pattern: /\bfree reign\b/gi, repl: 'free rein', desc: 'The correct idiom is "free rein" (referring to horses\' reins).' },
          { pattern: /\bdeep-seeded\b/gi, repl: 'deep-seated', desc: 'The correct phrase is "deep-seated".' },
          { pattern: /\btow the line\b/gi, repl: 'toe the line', desc: 'The correct expression is "toe the line".' },
          { pattern: /\bbaited breath\b/gi, repl: 'bated breath', desc: 'The correct spelling is "bated breath" (short for abated).' },
          { pattern: /\bflush out the\b/gi, repl: 'flesh out the', desc: 'Did you mean "flesh out" (to add detail or substance)?' },
          { pattern: /\bmute point\b/gi, repl: 'moot point', desc: 'The correct legal and debate term is "moot point".' },
          { pattern: /\bshoe-in\b/gi, repl: 'shoo-in', desc: 'The correct spelling is "shoo-in".' },
          { pattern: /\bwet your appetite\b/gi, repl: 'whet your appetite', desc: 'Use "whet" (to stimulate or sharpen) your appetite.' },
          { pattern: /\btake it for granite\b/gi, repl: 'take it for granted', desc: 'The correct phrase is "take it for granted".' },
          { pattern: /\bcase and point\b/gi, repl: 'case in point', desc: 'The correct expression is "case in point".' },
          { pattern: /\bfirstly\b/gi, repl: 'first', desc: 'In modern usage, "first" is preferred over "firstly".' }
        ];

        const issues = [];
        for (const item of idioms) {
          if (!item.desc) continue;
          item.pattern.lastIndex = 0;
          let match;
          while ((match = item.pattern.exec(text)) !== null) {
            const repl = match[0][0] === match[0][0].toUpperCase()
              ? item.repl.charAt(0).toUpperCase() + item.repl.slice(1)
              : item.repl;
            issues.push({
              id: 'idiom_' + match.index,
              category: 'grammar',
              type: 'Incorrect Expression',
              text: match[0],
              offset: match.index,
              length: match[0].length,
              replacement: repl,
              explanation: item.desc
            });
          }
        }
        return issues;
      }
    },

    // --- 7. Capitalization & Punctuation Polish ---
    {
      id: 'capitalization_punctuation',
      category: 'grammar',
      name: 'Capitalization & Punctuation',
      check(text) {
        const issues = [];

        // Standalone lowercase "i" as a pronoun (e.g. "when i go", "i think")
        const regI = /(^|[\s,;."(])(i)([\s,;.?!)']|$)/g;
        let match;
        while ((match = regI.exec(text)) !== null) {
          const startIdx = match.index + match[1].length;
          issues.push({
            id: 'cap_i_' + startIdx,
            category: 'grammar',
            type: 'Capitalization',
            text: 'i',
            offset: startIdx,
            length: 1,
            replacement: 'I',
            explanation: 'The pronoun "I" should always be capitalized.'
          });
        }

        // Sentence start lowercase letter after [.!?]
        const regSentence = /(?<=[.!?]\s+)([a-z])/g;
        while ((match = regSentence.exec(text)) !== null) {
          issues.push({
            id: 'cap_sentence_' + match.index,
            category: 'grammar',
            type: 'Capitalization',
            text: match[1],
            offset: match.index,
            length: 1,
            replacement: match[1].toUpperCase(),
            explanation: 'Sentences should begin with a capital letter.'
          });
        }

        // Double or multiple spaces
        const regSpace = /[^\S\r\n]{2,}/g;
        while ((match = regSpace.exec(text)) !== null) {
          issues.push({
            id: 'multi_space_' + match.index,
            category: 'grammar',
            type: 'Punctuation',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: ' ',
            explanation: 'Remove extra spaces between words.'
          });
        }

        // Multiple exclamation/question marks (e.g., "???", "!!!", "?!")
        const regPunct = /([!?]{2,})/g;
        while ((match = regPunct.exec(text)) !== null) {
          const repl = match[0].includes('?') ? '?' : '!';
          issues.push({
            id: 'multi_punct_' + match.index,
            category: 'grammar',
            type: 'Punctuation',
            text: match[0],
            offset: match.index,
            length: match[0].length,
            replacement: repl,
            explanation: 'Multiple punctuation marks can seem informal or aggressive. Use a single mark.'
          });
        }

        return issues;
      }
    }
  ],

  /**
   * Run all grammar checks on the given text
   */
  check(text, userOptions = {}) {
    if (!text || typeof text !== 'string') return [];
    const allIssues = [];

    for (const rule of this.rules) {
      if (userOptions[rule.id] === false) continue;
      try {
        const found = rule.check(text);
        if (Array.isArray(found)) {
          allIssues.push(...found);
        }
      } catch (err) {
        console.error(`Grammar rule error [${rule.id}]:`, err);
      }
    }

    // Sort by offset ascending
    return allIssues.sort((a, b) => a.offset - b.offset);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GrammarEngine;
}
