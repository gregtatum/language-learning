// @ts-check
const natural = require('natural');
const { getText, outputWords } = require('./utils');
/** @typedef {import("./types").Word} Word */
/** @typedef {import("./types").SegmenterClass} SegmenterClass */

const text = getText('../data/contes-de-fées-2-blondine-perdue.txt');
const ignoreWords = new Set(getText('../data/ignore-fr.txt').split('\n'));
const verbDeStemmer = getVerbDeStemmer();

/**
 * @returns {Map<string, string>}
 */
function getVerbDeStemmer() {
  const verbs = getText('../data/verbs.txt').split('\n');
  const verbDeStemmer = new Map();
  for (const verb of verbs) {
    verbDeStemmer.set(natural.PorterStemmerFr.stem(verb), verb);
  }
  return verbDeStemmer;
}

// This gave bad results:
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getTagger() {
  const language = 'FR';
  const defaultCategory = '?';
  const lexicon = new natural.Lexicon(language, defaultCategory);
  const ruleSet = new natural.RuleSet(language);
  return new natural.BrillPOSTagger(lexicon, ruleSet);
}

/** @type {SegmenterClass} */
const Segmenter =
  // @ts-expect-error - No segmenter definition
  Intl.Segmenter;

const wordSegmenter = new Segmenter('fr', { granularity: 'word' });
const sentenceSegmenter = new Segmenter('fr', { granularity: 'sentence' });

/** @type {Map<string, Word>} */
const result = new Map();

for (const { segment: sentence } of sentenceSegmenter.segment(text)) {
  const tokenList = [];
  for (const { segment, isWordLike } of wordSegmenter.segment(sentence)) {
    if (isWordLike) {
      tokenList.push(segment);
    }
  }
  for (const token of tokenList) {
    let stem = natural.PorterStemmerFr.stem(token);
    if (
      stem.startsWith("s'") ||
      stem.startsWith("l'") ||
      stem.startsWith("d'")
    ) {
      stem = stem.slice(2);
    }
    const verb = verbDeStemmer.get(stem);
    if (verb) {
      // De-stem verbs, as the infinite is more useful.
      stem = verb;
    }
    if (ignoreWords.has(stem) || ignoreWords.has(token)) {
      continue;
    }

    let entry = result.get(stem);
    if (!entry) {
      entry = {
        stem,
        frequency: 0,
        tokens: new Set(),
      };
      result.set(stem, entry);
    }

    entry.frequency++;
    entry.tokens.add(token);
  }
}

outputWords(result);
