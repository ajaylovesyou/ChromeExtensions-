/**
 * Grammarly - AI Writing Assistant
 * Automated Verification Test Suite
 * Tests: Grammar Rules, Spell Checker, Clarity Engine, Tone Analyzer, Readability Engine
 */

// If running in Node.js environment, import dependencies
if (typeof require !== 'undefined') {
  global.ReadabilityEngine = require('../lib/readability.js');
  global.ToneAnalyzer = require('../lib/tone-analyzer.js');
  global.ClarityEngine = require('../lib/clarity-engine.js');
  global.GrammarEngine = require('../lib/grammar-rules.js');
  global.SpellChecker = require('../lib/spell-checker.js');
  global.AIService = require('../lib/ai-service.js');
}

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
    failedTests++;
  }
}

async function runAllTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING GRAMMARLY AI WRITING ASSISTANT TEST SUITE');
  console.log('====================================================\n');

  // --- 1. Readability & Statistics Tests ---
  console.log('--- 1. Testing Readability Engine ---');
  const sample1 = 'The quick brown fox jumps over the lazy dog. It was a sunny day.';
  const stats1 = ReadabilityEngine.getStats(sample1);
  assert(stats1.wordCount === 14, 'Correct word count', `Expected 14, got ${stats1.wordCount}`);
  assert(stats1.sentenceCount === 2, 'Correct sentence count', `Expected 2, got ${stats1.sentenceCount}`);

  const ease1 = ReadabilityEngine.getFleschReadingEase(stats1);
  assert(ease1 >= 80, 'High readability score for simple text', `Score: ${ease1}`);
  const score100 = ReadabilityEngine.calculateOverallScore(14, 0);
  assert(score100 === 100, 'Zero issues yield 100 quality score');

  // --- 2. Grammar Rules Tests ---
  console.log('\n--- 2. Testing Grammar Rules Engine ---');

  // Confused Words: their / there / they're
  const gTest1 = 'their are many options to choose from.';
  const gIssues1 = GrammarEngine.check(gTest1);
  assert(gIssues1.some(i => i.replacement && i.replacement.toLowerCase() === 'there are'), 'Flag "their are" -> "there are"');

  const gTest2 = 'You forgot to bring you car.';
  const gIssues2 = GrammarEngine.check('your welcome to join us.');
  assert(gIssues2.some(i => i.replacement && i.replacement.toLowerCase() === "you're welcome"), 'Flag "your welcome" -> "you\'re welcome"');

  const gTest3 = 'The phone lost it\'s signal.';
  const gIssues3 = GrammarEngine.check('its a great day.');
  assert(gIssues3.some(i => i.replacement && i.replacement.toLowerCase() === "it's a"), 'Flag "its a" -> "it\'s a"');

  // Comparative then/than
  const gTest4 = 'This model is faster then that one.';
  const gIssues4 = GrammarEngine.check(gTest4);
  assert(gIssues4.some(i => i.replacement && i.replacement.includes('than')), 'Flag "faster then" -> "faster than"');

  // Modal verbs with have
  const gTest5 = 'We should of known better.';
  const gIssues5 = GrammarEngine.check(gTest5);
  assert(gIssues5.some(i => i.replacement && i.replacement.toLowerCase() === 'should have'), 'Flag "should of" -> "should have"');

  // Indefinite article: a apple
  const gTest6 = 'She ate a apple for breakfast.';
  const gIssues6 = GrammarEngine.check(gTest6);
  assert(gIssues6.some(i => i.replacement && i.replacement.toLowerCase() === 'an apple'), 'Flag "a apple" -> "an apple"');

  // Subject-Verb Agreement: He have
  const gTest7 = 'He have completed the project.';
  const gIssues7 = GrammarEngine.check(gTest7);
  assert(gIssues7.some(i => i.replacement && i.replacement.toLowerCase() === 'he has'), 'Flag "He have" -> "He has"');

  // Repeated words: the the
  const gTest8 = 'We went to the the park.';
  const gIssues8 = GrammarEngine.check(gTest8);
  assert(gIssues8.some(i => i.type === 'Duplicate Word'), 'Flag repeated "the the"');

  // --- 3. Advanced Spell Checker Tests ---
  console.log('\n--- 3. Testing Advanced Spell Checker Engine ---');
  const spTest1 = 'This is definately a seperate issue and we recieved it untill tommorrow.';
  const spIssues1 = SpellChecker.check(spTest1);
  assert(spIssues1.some(i => i.text.toLowerCase() === 'definately' && i.replacement.toLowerCase() === 'definitely'), 'Correct "definately" -> "definitely"');
  assert(spIssues1.some(i => i.text.toLowerCase() === 'seperate' && i.replacement.toLowerCase() === 'separate'), 'Correct "seperate" -> "separate"');
  assert(spIssues1.some(i => i.text.toLowerCase() === 'recieved' && i.replacement.toLowerCase() === 'received'), 'Correct "recieved" -> "received"');
  assert(spIssues1.some(i => i.text.toLowerCase() === 'tommorrow' && i.replacement.toLowerCase() === 'tomorrow'), 'Correct "tommorrow" -> "tomorrow"');

  // Merged and Split words tests
  const spMergedTest = 'We have alot of work and atleast three items left.';
  const spMergedIssues = SpellChecker.check(spMergedTest);
  assert(spMergedIssues.some(i => i.text.toLowerCase() === 'alot' && i.replacement === 'a lot'), 'Detect merged word "alot" -> "a lot"');
  assert(spMergedIssues.some(i => i.text.toLowerCase() === 'atleast' && i.replacement === 'at least'), 'Detect merged word "atleast" -> "at least"');

  const spSplitTest = 'We did every thing possible.';
  const spSplitIssues = SpellChecker.check(spSplitTest);
  assert(spSplitIssues.some(i => i.text.toLowerCase() === 'every thing' && i.replacement.toLowerCase() === 'everything'), 'Detect split word "every thing" -> "everything"');

  // Phonetic Soundex/Metaphone matching test
  const phonetic1 = SpellChecker.getPhoneticKey('psychology');
  const phonetic2 = SpellChecker.getPhoneticKey('psycology');
  assert(phonetic1 === phonetic2, 'Phonetic keys match for sound-alike words ("psychology" vs "psycology")');

  // Damerau-Levenshtein distance with transposition
  const damerauDist = SpellChecker.damerauLevenshteinDistance('teh', 'the');
  assert(damerauDist <= 1.0, 'Damerau-Levenshtein scores transposition as a single swap');

  // Morphological Inflections test (valid derivatives should not be flagged)
  assert(SpellChecker.isWordValid('downloading') === true, 'Morphological engine recognizes valid gerund "-ing"');
  assert(SpellChecker.isWordValid('unlocked') === true, 'Morphological engine recognizes valid prefix "un-" and suffix "-ed"');
  assert(SpellChecker.isWordValid('fastest') === true, 'Morphological engine recognizes valid superlative "-est"');

  // Custom dictionary test
  SpellChecker.personalDictionary.add('mycustombrandname');
  assert(SpellChecker.isWordValid('mycustombrandname') === true, 'Custom dictionary word recognized as valid');

  // Contextual spelling error test
  const contextualIssues = GrammarEngine.check('Take a sneak peak at the product and bare in mind the deadline.');
  assert(contextualIssues.some(i => i.text.toLowerCase() === 'sneak peak' && i.replacement.toLowerCase() === 'sneak peek'), 'Catch contextual real-word typo "sneak peak" -> "sneak peek"');
  assert(contextualIssues.some(i => i.text.toLowerCase() === 'bare in mind' && i.replacement.toLowerCase() === 'bear in mind'), 'Catch contextual real-word typo "bare in mind" -> "bear in mind"');

  // --- 4. Clarity Engine Tests ---
  console.log('\n--- 4. Testing Clarity & Conciseness Engine ---');
  const clTest1 = 'In order to make a decision, we must completely eliminate the end result due to the fact that it is obsolete.';
  const clIssues1 = ClarityEngine.checkClarity(clTest1);
  assert(clIssues1.some(i => i.text.toLowerCase() === 'in order to' && i.replacement.toLowerCase() === 'to'), 'Simplify "in order to" -> "to"');
  assert(clIssues1.some(i => i.text.toLowerCase() === 'make a decision' && i.replacement.toLowerCase() === 'decide'), 'Simplify "make a decision" -> "decide"');
  assert(clIssues1.some(i => i.text.toLowerCase() === 'completely eliminate' && i.replacement.toLowerCase() === 'eliminate'), 'Remove redundancy "completely eliminate" -> "eliminate"');
  assert(clIssues1.some(i => i.text.toLowerCase() === 'end result' && i.replacement.toLowerCase() === 'result'), 'Remove redundancy "end result" -> "result"');
  assert(clIssues1.some(i => i.text.toLowerCase() === 'due to the fact that' && i.replacement.toLowerCase() === 'because'), 'Simplify "due to the fact that" -> "because"');

  // Passive voice detection
  const clTest2 = 'The report was completed by our senior engineer.';
  const clIssues2 = ClarityEngine.checkClarity(clTest2);
  assert(clIssues2.some(i => i.type === 'Passive Voice'), 'Detect passive voice ("was completed by")');

  // --- 5. Tone Analyzer Tests ---
  console.log('\n--- 5. Testing Tone Analyzer Engine ---');
  const toneProf = 'Pursuant to our strategy, we confirm the milestone deliverable. Best regards and please let me know.';
  const tResult1 = ToneAnalyzer.analyze(toneProf);
  assert(tResult1.primary.toLowerCase().includes('professional'), 'Detect Professional tone');

  const toneFriend = 'Hey team, awesome work today! Love the energy and excited for what is coming up next!';
  const tResult2 = ToneAnalyzer.analyze(toneFriend);
  assert(tResult2.primary.toLowerCase().includes('casual') || tResult2.primary.toLowerCase().includes('friendly'), 'Detect Friendly/Casual tone');

  const rephrasedProf = ToneAnalyzer.rephrase('hey what\'s up let me know asap', 'professional');
  assert(rephrasedProf.includes('earliest convenience') || rephrasedProf.includes('Dear') || rephrasedProf.includes('please'), 'Professional rephrase eliminates casual slang');

  // --- 6. Unified AIService & FixAll Tests ---
  console.log('\n--- 6. Testing Unified AIService ---');
  // Empty text test (prevent popup crash)
  const emptyAnalysis = await AIService.analyzeText('');
  assert(emptyAnalysis && emptyAnalysis.summary !== undefined, 'Empty text returns valid summary object');
  assert(emptyAnalysis.summary.grammarCount === 0, 'Empty text grammar count is 0');
  assert(emptyAnalysis.summary.spellingCount === 0, 'Empty text spelling count is 0');
  assert(emptyAnalysis.summary.clarityCount === 0, 'Empty text clarity count is 0');

  // Verify vocabulary words are valid and not flagged
  assert(SpellChecker.isWordValid('weight') === true, '"weight" is recognized as valid English word');
  assert(SpellChecker.isWordValid('lose') === true, '"lose" is recognized as valid English word');
  assert(SpellChecker.isWordValid('decide') === true, '"decide" is recognized as valid English word');
  assert(SpellChecker.isWordValid('result') === true, '"result" is recognized as valid English word');

  const messyText = 'their are people who has to loose weight.';
  const fullAnalysis = await AIService.analyzeText(messyText);
  assert(fullAnalysis.issues.length >= 2, 'Detects multiple issues in composite text', `Found ${fullAnalysis.issues.length}`);

  const fixedAll = AIService.fixAll(messyText, fullAnalysis.issues);
  assert(!fixedAll.includes('their are'), 'fixAll replaces "their are" cleanly');
  assert(fixedAll.toLowerCase().includes('there are'), 'fixAll produces "there are"');

  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    throw new Error(`${failedTests} tests failed.`);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAllTests };
}

// Auto-run if executed directly in Node
if (typeof require !== 'undefined' && require.main === module) {
  runAllTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
