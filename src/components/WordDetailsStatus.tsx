import type { WordItem } from '../types';
export interface DetailState { loading: boolean; error: string | null; retry: () => void }
export function WordDetailsStatus({ state }: { state?: DetailState }) {
  return <div role={state?.error ? 'alert' : 'status'} className="detail-status" aria-live="polite">
    {state?.error ? <><p>{state.error}</p><button onClick={state.retry} className="button-secondary">Reintentar ficha</button></>
      : <><span className="skeleton-line" /><span className="skeleton-line" /><span className="skeleton-line is-short" /><p className="sr-only">Cargando definición y ejemplos…</p></>}
  </div>;
}
export function WordLexicalExtras({ word }: { word: WordItem }) {
  return <>
    {!!word.synonyms?.length && <section className="lexical-extra"><h4 className="lexical-label">Sinónimos</h4><p>{word.synonyms.join(' · ')}</p></section>}
    {!!word.pronunciationHint && <p className="lexical-hint"><span className="lexical-label">Pronunciación</span><span>{word.pronunciationHint}</span></p>}
  </>;
}
