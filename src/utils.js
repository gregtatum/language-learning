const fs = require('fs');
const path = require('path');

/** @typedef {import("./types").Word} Word */

/**
 * @param {string} filePath
 * @returns {string}
 */
function getText(filePath) {
  return fs.readFileSync(path.join(__dirname, filePath), 'utf8');
}

/**
 * @param {string} filePath
 * @returns {string}
 */
function getTextCwd(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * @param {string} filePath
 */
function getPath(filePath) {
  return path.join(__dirname, filePath);
}

function outputWords(result) {
  const sortedWords = [...result.values()].sort((a, b) => {
    if (a.stem === undefined) {
      return -1;
    }
    if (b.stem === undefined) {
      return 1;
    }
    return b.frequency - a.frequency;
  });

  for (const { stem, frequency, tokens } of sortedWords) {
    let displayStem = stem;
    if (tokens.size === 1) {
      displayStem = [...tokens][0];
    }
    console.log(displayStem, '\t', frequency, '\t', [...tokens].join(', '));
  }
}

module.exports = { getText, getPath, outputWords, getTextCwd };
