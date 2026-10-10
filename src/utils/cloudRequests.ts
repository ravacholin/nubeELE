import type { CloudData } from '../types';

/** Tab-local cache: never persists prompts, API keys or generated content to storage. */
export function createCloudRequests(fetcher: typeof fetch = fetch, now = Date.now) {
  const recent = new Map<string, { expires: number; data: CloudData }>();
  const pending = new Map<string, Promise<CloudData>>();
  return async (prompt: string, level: string, headers: Record<string, string>): Promise<CloudData> => {
    const key = JSON.stringify([prompt.trim().normalize('NFC').toLowerCase(), level, headers['x-gemini-api-key'] || '']);
    const hit = recent.get(key);
    if (hit && hit.expires > now()) return structuredClone(hit.data);
    recent.delete(key);
    let request = pending.get(key);
    if (!request) {
      request = (async () => {
        const response = await fetcher('/api/generate-cloud', {
          method: 'POST', headers,
          body: JSON.stringify({ prompt, level, focus: 'general' }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Error al generar la nube');
        if (!result.data || !Array.isArray(result.data.words) || !result.data.words.length) {
          throw new Error('No se recibieron palabras. Volvé a intentar.');
        }
        // A temporary Google failure must not trap the user in a cached fallback.
        if (result.source === 'gemini' || result.source === 'curated') {
          if (recent.size >= 24) recent.delete(recent.keys().next().value!);
          recent.set(key, { expires: now() + 5 * 60_000, data: structuredClone(result.data) });
        }
        return result.data as CloudData;
      })();
      pending.set(key, request);
    }
    try { return structuredClone(await request); }
    finally { if (pending.get(key) === request) pending.delete(key); }
  };
}

export const requestCloud = createCloudRequests();
