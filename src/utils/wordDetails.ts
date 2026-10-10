import type { WordItem } from '../types';
export type WordDetails = Pick<WordItem, 'meaning' | 'example' | 'translationEn' | 'collocation' | 'pronunciationHint' | 'synonyms'>;

export function createWordDetailRequests(fetcher: typeof fetch = fetch, now = Date.now) {
  const cache = new Map<string, { expires: number; data: WordDetails }>();
  const pending = new Map<string, Promise<WordDetails>>();
  return async (word: WordItem, topic: string, headers: Record<string, string>): Promise<WordDetails> => {
    const context = word.topicContext || topic;
    const lemma = word.lemma || word.word;
    const key = JSON.stringify([lemma, context, word.level, word.category, headers['x-gemini-api-key'] || '']);
    const cached = cache.get(key);
    if (cached && cached.expires > now()) return structuredClone(cached.data);
    cache.delete(key);
    let request = pending.get(key);
    if (!request) {
      request = (async () => {
        const response = await fetcher('/api/word-details', {
          method: 'POST', headers,
          body: JSON.stringify({ word: lemma, topic: context, level: word.level, category: word.category }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'No se pudo completar la ficha.');
        if (!result.data?.meaning || !result.data?.example) throw new Error('La ficha llegó incompleta. Volvé a intentar.');
        if (cache.size >= 64) cache.delete(cache.keys().next().value!);
        cache.set(key, { expires: now() + 10 * 60_000, data: structuredClone(result.data) });
        return result.data as WordDetails;
      })();
      pending.set(key, request);
    }
    try { return structuredClone(await request); }
    finally { if (pending.get(key) === request) pending.delete(key); }
  };
}
export const requestWordDetails = createWordDetailRequests();
