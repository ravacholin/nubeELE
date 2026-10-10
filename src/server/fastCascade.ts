/** A short overall budget, real cancellation and cooldowns supplied per credential. */
export async function runFastCascade(
  models: string[],
  generate: (model: string, signal: AbortSignal, timeout: number) => Promise<string>,
  cooldowns: Map<string, number>,
  options = { attemptMs: 6000, totalMs: 18000 },
): Promise<{ text: string; modelUsed: string } | null> {
  const deadline = Date.now() + options.totalMs;
  for (const [model, until] of cooldowns) if (until <= Date.now()) cooldowns.delete(model);
  const available = models.filter(model => !cooldowns.has(model)).slice(0, 3);
  for (const model of available) {
    const timeout = Math.min(options.attemptMs, deadline - Date.now());
    if (timeout <= 0) break;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const text = await Promise.race([
        generate(model, controller.signal, timeout),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('Gemini timeout'));
          }, timeout);
        }),
      ]);
      if (!text.trim()) throw new Error('Empty Gemini response');
      return { text, modelUsed: model };
    } catch (error: any) {
      const status = Number(error.status || error.code);
      if (status === 401 || status === 403) return null;
      cooldowns.set(model, Date.now() + (status === 429 ? 60_000 : status === 404 ? 300_000 : 15_000));
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
