export interface Word {
  stem: string;
  frequency: number;
  tokens: Set<string>;
}

export interface Stem {
  stem: string;
  frequency: number;
  tokens: string[];
  sentences: string[];
}

export declare class Segmenter {
  constructor(
    locale: string,
    options?: { granularity: 'grapheme' | 'word' | 'sentence' },
  );
  segment(text: string): Iterable<{
    segment: string;
    isWordLike: boolean;
    index: number;
    input: string;
  }>;
}

export type SegmenterClass = typeof Segmenter;
