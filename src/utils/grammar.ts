/**
 * Utility functions to guarantee proper Spanish grammar:
 * - Articles ("el", "la", "los", "las") only before nouns ("sustantivos").
 * - Verbs and adjectives NEVER have articles.
 * - Prevents string bugs like "null fundir" or "null suave".
 */

const VALID_SPANISH_ARTICLES = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas']);

export function getValidArticle(category?: string, article?: string | null): string | null {
  if (!category || category.toLowerCase() !== 'sustantivo') {
    return null;
  }
  if (!article) return null;
  const clean = String(article).trim().toLowerCase();
  if (clean === 'null' || clean === 'undefined' || clean === 'none' || clean === '') {
    return null;
  }
  if (VALID_SPANISH_ARTICLES.has(clean)) {
    return clean;
  }
  return null;
}

export function cleanDisplayWord(text?: string | null): string {
  if (!text) return '';
  return String(text)
    .replace(/^null\s+/i, '')
    .replace(/^undefined\s+/i, '')
    .trim();
}
