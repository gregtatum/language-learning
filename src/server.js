// @ts-check
const { Nodehun } = require('nodehun');
const fs = require('fs/promises');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');

/** @typedef {import("./types").SegmenterClass} SegmenterClass */
/** @typedef {import("./types").Stem} Stem */
/** @typedef {import("express").Response} Response */

/** @type {SegmenterClass} */
const Segmenter =
  // @ts-expect-error - No segmenter definition
  Intl.Segmenter;

// @ts-ignore
require('dotenv').config();

const app = express();
app.use(require('morgan')('tiny'));
const jsonParser = bodyParser.json({
  limit: '100mb',
});

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
    endpoints: [
      {
        paths: ['/:locale/stem', '/:locale/stem.csv'],
        description: 'Stem a list of words.',
        getArgs: ['text'],
      },
    ],
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

/**
 * @param {Response} res
 * @param {string} localeParam
 * @returns {Promise<null | {locale: string, hunspell: Nodehun}>}
 */
async function getHunspell(res, localeParam) {
  const locale = validateLocale(localeParam);
  if (!locale) {
    res.status(400);
    res.json('invalid locale');
    return null;
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
    return null;
  }
  return { hunspell: new Nodehun(affix, dictionary), locale };
}

/**
 * @param {string} locale
 * @param {string} text
 * @param {Set<string>} ignoreWords
 * @param {Nodehun} hunspell
 * @returns {Promise<Stem[]>}
 */
async function getStems(locale, text, ignoreWords, hunspell) {
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
      let [stemString] = await hunspell.stem(segment.segment);
      if (!stemString) {
        stemString = '(unknown)';
      }
      if (ignoreWords.has(stemString)) {
        continue;
      }
      /** @type {Stem | undefined} */
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
      if (!stem.tokens.includes(segment.segment)) {
        stem.tokens.push(segment.segment);
      }
      const trimmedSentence = sentence.trim();
      if (!stem.sentences.includes(trimmedSentence)) {
        stem.sentences.push(trimmedSentence);
      }
      stem.frequency++;
    }
  }

  const stems = [...stemsByStem.values()];
  return stems.sort((a, b) => b.frequency - a.frequency);
}

app.post('/:locale/stem', jsonParser, async (req, res) => {
  try {
    if (typeof req.body.text !== 'string') {
      res.status(400);
      res.json('"text" must be a string');
      return;
    }

    /** @type {string} */
    const text = req.body.text;

    const ignoreWords = new Set();
    if (req.body.ignoreWords) {
      if (!Array.isArray(req.body.ignoreWords)) {
        res.status(400);
        res.json('"ignoreWords" must be an array');
        return;
      }
      for (const word of req.body.ignoreWords) {
        if (typeof word !== 'string') {
          res.status(400);
          res.json(
            'The "ignoreWords" list contained an item that was not a string.',
          );
          return;
        }
        ignoreWords.add(word);
      }
    }

    /** @type {unknown} */
    const limit = req.body.limit;
    if (typeof limit !== 'number' && limit !== undefined) {
      res.status(400);
      res.json('The "limit" must be a valid number');
      return;
    }

    const result = await getHunspell(res, req.params.locale);
    if (!result) {
      return;
    }
    const { locale, hunspell } = result;

    let stems = await getStems(locale, text, ignoreWords, hunspell);
    if (typeof limit === 'number') {
      stems = stems.slice(0, limit);
    }
    res.json({ stems });
  } catch (error) {
    res.status(501);
    res.json('Internal server error');
    console.error(error);
  }
});

app.get('/:locale/stem', async (req, res) => {
  try {
    const { text } = req.query;
    if (typeof text !== 'string') {
      res.status(400);
      res.json('"text" must be a string');
      return;
    }

    const result = await getHunspell(res, req.params.locale);
    if (!result) {
      return;
    }
    const { locale, hunspell } = result;

    res.json({ stems: await getStems(locale, text, new Set(), hunspell) });
  } catch (error) {
    res.status(501);
    res.json('Internal server error');
    console.error(error);
  }
});

app.get('/:locale/stem.csv', async (req, res) => {
  try {
    const { text } = req.query;
    if (typeof text !== 'string') {
      res.status(400);
      res.json('"text" must be a string');
      return;
    }

    const result = await getHunspell(res, req.params.locale);
    if (!result) {
      return;
    }
    const { locale, hunspell } = result;
    res.set({ 'content-type': 'text/csv; charset=utf-8' });

    const stems = await getStems(locale, text, new Set(), hunspell);
    res.write(`Stem:,Frequency:,Words:\n`);
    for (const stem of stems) {
      res.write(`${stem.stem},${stem.frequency},${stem.tokens.join(' ')}\n`);
    }
    res.json();
  } catch (error) {
    res.status(501);
    res.json('Internal server error');
    console.error(error);
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port http://${host}:${port}`);
});
