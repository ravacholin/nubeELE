import type { WordItem } from '../types';

export const MAX_CLOUD_WORDS = 40;
export type CloudFocus = 'more' | 'verbs' | 'expressions' | 'advanced';

function freshWords(current: WordItem[], additions: WordItem[]): WordItem[] {
  const seen = new Set(current.map(word => (word.lemma || word.word).trim().toLowerCase()));
  const fresh = additions.filter(word => {
    const key = (word.lemma || word.word).trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return fresh;
}

export function matchesCloudFocus(word: WordItem, focus: CloudFocus): boolean {
  if (focus === 'verbs') return word.category === 'verbo';
  if (focus === 'expressions') return word.category === 'expresion';
  if (focus === 'advanced') return word.level === 'B2' || word.level === 'C1';
  return true;
}

export function appendCloudWords(current: WordItem[], additions: WordItem[], retainedIds = new Set<string>()): WordItem[] {
  const fresh = freshWords(current, additions);
  if (!fresh.length) return current;
  const combined = [...current, ...fresh];
  let excess = combined.length - MAX_CLOUD_WORDS;
  // Arrival order determines eviction, while explicitly selected terms stay.
  return combined.filter(word => {
    if (excess > 0 && !retainedIds.has(word.id)) { excess--; return false; }
    return true;
  });
}

export function changeCloudFocus(current: WordItem[], additions: WordItem[], focus: CloudFocus, retainedIds = new Set<string>()): WordItem[] {
  return appendCloudWords(current.filter(word => matchesCloudFocus(word, focus)), additions.filter(word => matchesCloudFocus(word, focus)), retainedIds);
}

export function keepSelectedWords(current: WordItem[], incoming: WordItem[], selectedIds: Set<string>): WordItem[] {
  return appendCloudWords(current.filter(word => selectedIds.has(word.id)), incoming, selectedIds);
}

export function replaceSelectedWords(current: WordItem[], incoming: WordItem[], selectedIds: Set<string>): WordItem[] {
  const fresh = freshWords(current, incoming);
  if (!fresh.length) return current;
  let index = 0;
  // Keep unfilled slots if the vocabulary source has fewer alternatives.
  return current.map(word => selectedIds.has(word.id) && index < fresh.length ? fresh[index++] : word);
}
