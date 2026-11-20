import { describe, expect, it } from 'vitest';
import { acceptedForms, buildKeywordIndex, checkAnswer, normalize } from '../src/lib/answer';
import { KANJI, keywordIndex } from '../src/lib/kanji';

const index = buildKeywordIndex([
  { frame: 1, keyword: 'one' },
  { frame: 2, keyword: 'again, or' },
  { frame: 3, keyword: 'saké' },
  { frame: 4, keyword: 'vis-à-vis' },
  { frame: 5, keyword: 'beckon' },
  { frame: 6, keyword: 'beacon' },
  { frame: 7, keyword: 'sign of the snake' },
  { frame: 8, keyword: 'abbreviation' }
]);

describe('normalize', () => {
  it('folds case, accents, punctuation and leading articles', () => {
    expect(normalize('  The Sign-of the Snake! ')).toBe('sign of the snake');
    expect(normalize('Saké')).toBe('sake');
    expect(normalize('to beckon')).toBe('beckon');
  });
});

describe('acceptedForms', () => {
  it('splits comma alternatives and parentheses', () => {
    expect(acceptedForms('again, or')).toEqual(expect.arrayContaining(['again or', 'again', 'or']));
    expect(acceptedForms('i (one)')).toEqual(expect.arrayContaining(['i', 'one']));
  });
});

describe('checkAnswer', () => {
  it('accepts exact answers and variants', () => {
    expect(checkAnswer('One', 1, 'one', index).result).toBe('correct');
    expect(checkAnswer('again', 2, 'again, or', index).result).toBe('correct');
    expect(checkAnswer('sake', 3, 'saké', index).result).toBe('correct');
    expect(checkAnswer('vis a vis', 4, 'vis-à-vis', index).result).toBe('correct');
    expect(checkAnswer('visavis', 4, 'vis-à-vis', index).result).toBe('correct');
  });

  it('flags the keyword of another kanji', () => {
    expect(checkAnswer('beacon', 5, 'beckon', index)).toEqual({ result: 'other', frames: [6] });
  });

  it('tolerates small typos depending on length', () => {
    expect(checkAnswer('becon', 5, 'beckon', index).result).toBe('close');
    expect(checkAnswer('abreviaton', 8, 'abbreviation', index).result).toBe('close');
    expect(checkAnswer('two', 1, 'one', index).result).toBe('wrong');
    expect(checkAnswer('', 1, 'one', index).result).toBe('wrong');
  });

  it('accepts every real keyword for its own frame', () => {
    for (const k of KANJI) {
      expect(checkAnswer(k.keyword, k.frame, k.keyword, keywordIndex).result, `frame ${k.frame}`).toBe('correct');
    }
  });
});
