// @ts-check
const { Nodehun } = require('nodehun');
const fs = require('fs/promises');
const path = require('path');
const express = require('express');

/** @typedef {import("./types").SegmenterClass} SegmenterClass */
/** @typedef {import("./types").Stem} Stem */

/** @type {SegmenterClass} */
const Segmenter =
  // @ts-expect-error - No segmenter definition
  Intl.Segmenter;

// @ts-ignore
require('dotenv').config();

const app = express();
const host = process.env.HOST;
const port = process.env.PORT;
if (!host) {
  throw new Error('.env requires a HOST');
}
if (!port) {
  throw new Error('.env requires a PORT');
}

app.get('/', (req, res) => {
  res.json({
    endpoints: [{ path: '/stem', description: 'Stem a list of words.' }],
  });
});

/**
 * Returns the validated locale, which can be passed to the file system.
 * @param {string} locale
 * @returns {string | null}
 */
function validateLocale(locale) {
  // Expect BCP-47 identifiers like "en" or "en-US".
  if (/^\w\w+(-\w\w+)?$/.exec(locale)) {
    return locale;
  }
  return null;
}

app.get('/:locale/stem', async (req, res) => {
  try {
    const { text } = req.query;
    const locale = validateLocale(req.params.locale);
    if (!locale) {
      res.status(400);
      res.json('invalid locale');
      return;
    }
    if (typeof text !== 'string') {
      res.status(400);
      res.json('"text" must be a string');
      return;
    }
    let affix, dictionary;
    try {
      affix = await fs.readFile(
        path.join(__dirname, '../dictionaries', locale, 'index.aff'),
      );
      dictionary = await fs.readFile(
        path.join(__dirname, '../dictionaries', locale, 'index.dic'),
      );
    } catch (error) {
      res.status(404);
      res.json(`The locale "${locale} could not be found."`);
      return;
    }
    const hunspell = new Nodehun(affix, dictionary);

    const sentenceSegmenter = new Segmenter(locale, {
      granularity: 'sentence',
    });
    const wordSegmenter = new Segmenter(locale, { granularity: 'word' });
    /** @type {Map<string, Stem>} */
    const stemsByStem = new Map();
    for (const { segment: sentence } of sentenceSegmenter.segment(text)) {
      for (const segment of wordSegmenter.segment(sentence)) {
        if (!segment.isWordLike) {
          continue;
        }
        const [stemString] = await hunspell.stem(segment.segment);
        if (!stemString) {
          continue;
        }
        let stem = stemsByStem.get(stemString);
        if (!stem) {
          stem = {
            stem: stemString,
            frequency: 0,
            tokens: [],
            sentences: [],
          };
          stemsByStem.set(stemString, stem);
        }
        stem.tokens.push(segment.segment);
        stem.sentences.push(sentence);
        stem.frequency++;
      }
    }

    const stems = [...stemsByStem.values()];
    stems.sort((a, b) => b.frequency - a.frequency);

    res.json({ stems });
  } catch (error) {
    res.status(501);
    res.json('Internal server error');
    console.error(error);
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port http://${host}:${port}`);
});
