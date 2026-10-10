import type { CloudData } from '../types';

type Progress = (data: CloudData | null) => void;

/** Tab-local cache: never persists prompts, API keys or generated content to storage. */
export function createCloudRequests(fetcher: typeof fetch = fetch, now = Date.now) {
  const recent = new Map<string, { expires: number; data: CloudData }>();
  const pending = new Map<string, { promise: Promise<CloudData>; listeners: Set<Progress>; latest?: CloudData | null }>();
  return async (prompt: string, level: string, headers: Record<string, string>, onProgress?: Progress): Promise<CloudData> => {
    const key = JSON.stringify([prompt.trim().normalize('NFC').toLowerCase(), level, headers['x-gemini-api-key'] || '']);
    const hit = recent.get(key);
    if (hit && hit.expires > now()) return structuredClone(hit.data);
    recent.delete(key);
    let request = pending.get(key);
    if (!request) {
      const entry = { promise: null as unknown as Promise<CloudData>, listeners: new Set<Progress>(), latest: undefined as CloudData | null | undefined };
      if (onProgress) entry.listeners.add(onProgress);
      const publish = (data: CloudData | null) => {
        entry.latest = data;
        for (const listener of entry.listeners) listener(structuredClone(data));
      };
      entry.promise = (async () => {
        const response = await fetcher('/api/generate-cloud', {
          method: 'POST', headers: { ...headers, Accept: 'application/x-ndjson' },
          body: JSON.stringify({ prompt, level, focus: 'general' }),
        });
        let result: any;
        if (response.ok && response.headers.get('content-type')?.includes('application/x-ndjson') && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          const consume = (line: string) => {
            if (!line.trim()) return;
            const event = JSON.parse(line);
            if (event.type === 'error') throw new Error(event.error || 'Error al generar la nube');
            if (event.type === 'reset') publish(null);
            if (event.type === 'progress' && !result) publish(event.data);
            if (event.type === 'complete') result = event;
          };
          try {
            while (true) {
              const { value, done } = await reader.read();
              buffer += decoder.decode(value, { stream: !done });
              let newline: number;
              while ((newline = buffer.indexOf('\n')) >= 0) {
                consume(buffer.slice(0, newline));
                buffer = buffer.slice(newline + 1);
              }
              if (done) { consume(buffer); break; }
            }
            if (!result) throw new Error('Se interrumpió la generación. Volvé a intentar.');
          } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
        } else {
          const body = await response.text();
          try { result = JSON.parse(body); }
          catch { throw new Error('El servidor no pudo responder. Volvé a intentar en unos segundos.'); }
        }
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
      request = entry;
      pending.set(key, entry);
    } else if (onProgress) {
      request.listeners.add(onProgress);
      if (request.latest !== undefined) onProgress(structuredClone(request.latest));
    }
    try { return structuredClone(await request.promise); }
    finally { if (onProgress) request.listeners.delete(onProgress); if (pending.get(key) === request) pending.delete(key); }
  };
}

export const requestCloud = createCloudRequests();
