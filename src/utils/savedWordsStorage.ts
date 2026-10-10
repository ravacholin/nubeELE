import { WordItem } from '../types';

const STORAGE_KEY = 'nube_ele_saved_words';

export function getSavedWords(): WordItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Error reading saved words from localStorage', err);
    return [];
  }
}

export function isWordSaved(wordIdOrText: string): boolean {
  const list = getSavedWords();
  const search = wordIdOrText.toLowerCase().trim();
  return list.some(
    (w) =>
      w.id === wordIdOrText ||
      w.word.toLowerCase().trim() === search ||
      w.lemma.toLowerCase().trim() === search
  );
}

export function saveWord(word: WordItem): void {
  try {
    const current = getSavedWords();
    const exists = current.some(
      (w) =>
        w.id === word.id ||
        w.word.toLowerCase().trim() === word.word.toLowerCase().trim()
    );
    if (!exists) {
      const updated = [{ ...word, isFavorite: true }, ...current];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event('nube-saved-words-changed'));
    }
  } catch (err) {
    console.warn('Error saving word to localStorage', err);
  }
}

export function removeSavedWord(wordIdOrText: string): void {
  try {
    const current = getSavedWords();
    const search = wordIdOrText.toLowerCase().trim();
    const updated = current.filter(
      (w) =>
        w.id !== wordIdOrText &&
        w.word.toLowerCase().trim() !== search &&
        w.lemma.toLowerCase().trim() !== search
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('nube-saved-words-changed'));
  } catch (err) {
    console.warn('Error removing saved word from localStorage', err);
  }
}

export function toggleSavedWord(word: WordItem): boolean {
  if (isWordSaved(word.id) || isWordSaved(word.word)) {
    removeSavedWord(word.id);
    return false;
  } else {
    saveWord(word);
    return true;
  }
}
