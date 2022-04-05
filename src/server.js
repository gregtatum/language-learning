// @ts-check
const { Nodehun } = require('nodehun');
const fs = require('fs/promises');
const path = require('path');
const express = require('express');

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
    res.send('invalid locale');
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
 * @param {Nodehun} hunspell
 * @returns {Promise<Stem[]>}
 */
async function getStems(locale, text, hunspell) {
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
  return stems.sort((a, b) => b.frequency - a.frequency);
}

app.get('/:locale/stem', async (req, res) => {
  try {
    const { text } = req.query;
    if (typeof text !== 'string') {
      res.status(400);
      res.send('"text" must be a string');
      return;
    }

    const result = await getHunspell(res, req.params.locale);
    if (!result) {
      return;
    }
    const { locale, hunspell } = result;

    res.json({ stems: await getStems(locale, text, hunspell) });
  } catch (error) {
    res.status(501);
    res.send('Internal server error');
    console.error(error);
  }
});

app.get('/:locale/stem.csv', async (req, res) => {
  try {
    const { text } = req.query;
    if (typeof text !== 'string') {
      res.status(400);
      res.send('"text" must be a string');
      return;
    }

    const result = await getHunspell(res, req.params.locale);
    if (!result) {
      return;
    }
    const { locale, hunspell } = result;
    res.set({ 'content-type': 'text/csv; charset=utf-8' });

    const stems = await getStems(locale, text, hunspell);
    res.write(`Stem:,Frequency:,Words:\n`);
    for (const stem of stems) {
      res.write(`${stem.stem},${stem.frequency},${stem.tokens.join(' ')}\n`);
    }
    res.send();
  } catch (error) {
    res.status(501);
    res.send('Internal server error');
    console.error(error);
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port http://${host}:${port}`);
});
