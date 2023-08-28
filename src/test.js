const fs = require('fs');
const path = require('path');

/** @type {typeof window.fetch} */
const fetch = require(// @ts-ignore
'node-fetch');

/**
 * @param {string} url
 * @param {unknown} data
 */
async function postData(url, data) {
  // Default options are marked with *
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (response.ok) {
    return response.json();
  }
  throw await response.json();
}

const text = fs.readFileSync(
  // path.join(__dirname, '../data/private/El-Pozo-de-la-Ascension-Ed-1.txt'),
  path.join(
    __dirname,
    '../data/private/El-Pozo-de-la-Ascension-Ed-revisada-Brandon-Sanderson.txt',
  ),
  'utf8',
);

/**
 * @returns {string[]}
 */
function getIgnoreWords() {
  /** @type {string[]} */
  const ignoreWords = [];

  for (const word of fs
    .readFileSync(path.join(__dirname, '../data/ignore-es.txt'), 'utf8')
    .split('\n')) {
    if (word) {
      ignoreWords.push(word.split('|')[0].trim());
    }
  }

  for (const word of fs
    .readFileSync(path.join(__dirname, '../data/ignore-es-names.txt'), 'utf8')
    .split('\n')) {
    if (word) {
      ignoreWords.push(word.trim());
    }
  }
  return ignoreWords;
}

/**
 * @param {unknown[]} array
 */
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

postData('http://localhost:3000/es/stem', {
  text,
  ignoreWords: getIgnoreWords(),
  limit: 500,
}).then(
  (data) => {
    /** @type {import('types').Stem[]} */
    const stems = data.stems;
    for (const { stem, frequency, tokens, sentences } of stems) {
      if (false) {
        console.log(stem);
      } else {
        console.log(stem, frequency, tokens);
        console.log(frequency, stem);
        shuffle(sentences);
        for (const sentence of sentences.slice(0, 5)) {
          console.log('    ' + sentence);
        }
      }
    }
  },
  (err) => {
    console.error('Error from the API:');
    console.error(err);
  },
);
