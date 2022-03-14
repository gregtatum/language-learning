// @ts-check
const fs = require('fs');
const { execSync } = require('child_process');
const { getText, getTextCwd, getPath, outputWords } = require('./utils');
/** @typedef {import("./types").Word} Word */

const ignoreWords = new Set(getText('../data/ignore-list.txt').split('\n'));

const dictionaryPath = getPath('../data');
const scratchFilePath = getPath('.scratch');

const [, , fileRaw] = process.argv;
if (!fileRaw) {
  console.error('No file path was provided.');
  console.error('Usage: node src/hunspell.js data/file.txt');
  process.exit(1);
}

let text = getTextCwd(fileRaw);

// Replace characters hunspell has trouble with.
text = text.replaceAll('-', '\n');
text = text.replaceAll('.', '\n');
fs.writeFileSync(scratchFilePath, text);

const cmd = `DICPATH="${dictionaryPath}" hunspell -d fr -s ${scratchFilePath}`;
// ```
// vrai vrai
//
// dit dit
// dit dire
//
// Blondine blondin
// ```
const hunSpellOutput = execSync(cmd);
fs.rmSync(scratchFilePath);

// ```
// [
//   "vrai vrai",
//   "dit dit\ndit dire",
//   "Blondine blondin",
// ]
// ```
const hunSpellStems = hunSpellOutput.toString().split('\n\n');

/** @type {Map<string, Word>} */
const result = new Map();

for (const lines of hunSpellStems) {
  // Use the last stem listed.
  if (!lines) continue;
  const line = lines.split('\n').reverse()[0];
  if (!line) continue;
  const [word, stem] = line.split(' ');

  if (ignoreWords.has(stem) || ignoreWords.has(word)) {
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
  entry.tokens.add(word);
}

outputWords(result);
