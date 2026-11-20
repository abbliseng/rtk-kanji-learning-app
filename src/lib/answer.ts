/** Checking typed keyword answers. */

export type Verdict =
  | { result: 'correct' }
  | { result: 'close' }
  | { result: 'other'; frames: number[] }
  | { result: 'wrong' };

/** Lowercase, strip accents and punctuation, drop a leading "to", "the", "a" or "an". */
export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^(to|the|an|a) /, '');
}

/** Every form of a keyword that counts as right: "again, or" also accepts "again" and "or". */
export function acceptedForms(keyword: string): string[] {
  const forms = new Set<string>([normalize(keyword)]);
  const withoutParens = keyword.replace(/\([^)]*\)/g, ' ');
  forms.add(normalize(withoutParens));
  for (const inner of keyword.match(/\(([^)]*)\)/g) ?? []) forms.add(normalize(inner));
  for (const piece of withoutParens.split(/[,/;]/)) forms.add(normalize(piece));
  forms.delete('');
  return [...forms];
}

export function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Typos allowed for a keyword of this length: none up to 4 letters, 1 up to 8, 2 from 9. */
export const typoAllowance = (length: number) => (length >= 9 ? 2 : length >= 5 ? 1 : 0);

export type KeywordIndex = Map<string, number[]>;

/** Maps every accepted form to the frames whose keyword it is. */
export function buildKeywordIndex(entries: { frame: number; keyword: string }[]): KeywordIndex {
  const index: KeywordIndex = new Map();
  for (const { frame, keyword } of entries) {
    for (const form of acceptedForms(keyword)) {
      const list = index.get(form) ?? [];
      list.push(frame);
      index.set(form, list);
    }
  }
  return index;
}

export function checkAnswer(input: string, frame: number, keyword: string, index: KeywordIndex): Verdict {
  const given = normalize(input);
  if (!given) return { result: 'wrong' };
  const forms = acceptedForms(keyword);
  if (forms.includes(given)) return { result: 'correct' };

  const others = (index.get(given) ?? []).filter((f) => f !== frame);
  if (others.length) return { result: 'other', frames: others };

  const squash = (s: string) => s.replace(/ /g, '');
  for (const form of forms) {
    if (squash(form) === squash(given)) return { result: 'correct' };
    if (levenshtein(squash(form), squash(given)) <= typoAllowance(squash(form).length)) {
      return { result: 'close' };
    }
  }
  return { result: 'wrong' };
}
