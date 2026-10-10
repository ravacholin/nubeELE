import type { WordItem } from '../types';
export interface DetailState { loading: boolean; error: string | null; retry: () => void }
export function WordDetailsStatus({ state }: { state?: DetailState }) {
  return <div role={state?.error ? 'alert' : 'status'} className="border border-zinc-700 p-4 text-sm text-zinc-300" aria-live="polite">
    {state?.error ? <><p>{state.error}</p><button onClick={state.retry} className="mt-3 px-3 py-2 bg-white text-black text-xs font-mono cursor-pointer">Reintentar ficha</button></>
      : <p>Cargando definición y ejemplos…</p>}
  </div>;
}
export function WordLexicalExtras({ word }: { word: WordItem }) {
  return <>
    {!!word.synonyms?.length && <div className="text-sm text-zinc-300"><span className="text-xs font-mono text-zinc-400">SINÓNIMOS</span><p className="mt-1">{word.synonyms.join(' · ')}</p></div>}
    {!!word.pronunciationHint && <p className="text-xs text-zinc-400">Pronunciación: {word.pronunciationHint}</p>}
  </>;
}
