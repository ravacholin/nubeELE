import React, { useEffect, useState } from 'react';
import { WordItem, RegionalUsage } from '../types';
import { getCuratedRegionalUsage, fetchRegionalUsage } from '../utils/regionalVariants';
import { cleanDisplayWord } from '../utils/grammar';
import { playSpanishSpeech } from '../utils/audio';
import { Globe, Volume2, Sparkles, Loader2, Info } from 'lucide-react';

interface RegionalVariantsSectionProps {
  word: WordItem;
  compact?: boolean;
}

export const RegionalVariantsSection: React.FC<RegionalVariantsSectionProps> = ({
  word,
  compact = false,
}) => {
  const isNoun = word.category?.toLowerCase() === 'sustantivo';

  // Instant pre-population from word object or curated library
  const [regionalUsage, setRegionalUsage] = useState<RegionalUsage | null>(() => {
    if (!isNoun) return null;
    return word.regionalUsage || getCuratedRegionalUsage(word.word, word.lemma);
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [speakingVariant, setSpeakingVariant] = useState<string | null>(null);

  useEffect(() => {
    if (!isNoun) {
      setRegionalUsage(null);
      return;
    }

    // Check if current word already has regional usage
    const preExisting = word.regionalUsage || getCuratedRegionalUsage(word.word, word.lemma);
    if (preExisting) {
      setRegionalUsage(preExisting);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetchRegionalUsage(word.word, word.lemma, word.category)
      .then((data) => {
        if (isMounted) {
          setRegionalUsage(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [word.id, word.word, word.lemma, word.category, isNoun]);

  if (!isNoun) {
    return null;
  }

  const handleSpeakVariant = async (term: string) => {
    setSpeakingVariant(term);
    await playSpanishSpeech(term, 0.88);
    setSpeakingVariant(null);
  };

  const nounName = cleanDisplayWord(word.lemma || word.word);

  return (
    <div className="bg-[#12141d] border border-[#27272a] p-3.5 space-y-3 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#22242c] pb-2">
        <div className="flex items-center gap-1.5 text-zinc-300 font-mono font-bold uppercase tracking-wider text-[11px]">
          <Globe className="w-3.5 h-3.5 text-zinc-400" />
          <span>Países hispanohablantes y variantes</span>
        </div>
        <span className="text-[10px] font-mono uppercase bg-zinc-950/80 text-zinc-300 border border-zinc-800/80 px-1.5 py-0.5">
          Sustantivo
        </span>
      </div>

      {loading && !regionalUsage ? (
        <div className="flex items-center gap-2 py-3 text-xs text-zinc-400 font-mono">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
          <span>Consultando mapa dialectal hispanohablante...</span>
        </div>
      ) : regionalUsage ? (
        <div className="space-y-3">
          {/* Primary Countries where this noun is used */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
              <span className="text-zinc-500 font-bold">1.</span>
              <span>
                Dónde se dice <strong className="text-white font-bold">«{nounName}»</strong>:
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {regionalUsage.primaryCountries.map((country, idx) => {
                const flag = regionalUsage.primaryFlags?.[idx] || '';
                return (
                  <span
                    key={`${country}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#181a24] border border-[#2c2f3d] text-zinc-200 text-xs font-mono"
                  >
                    {flag && <span>{flag}</span>}
                    <span>{country}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Regional Variants in other countries */}
          {regionalUsage.variants && regionalUsage.variants.length > 0 ? (
            <div className="space-y-2 pt-1 border-t border-[#22242c]">
              <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                <span className="text-zinc-500 font-bold">2.</span>
                <span>Variantes en otros países hispanohablantes:</span>
              </div>

              <div className="space-y-2">
                {regionalUsage.variants.map((v, i) => (
                  <div
                    key={i}
                    className="bg-[#0b0c10] border border-[#2c2f3d] p-2.5 text-xs space-y-1.5 transition-colors hover:border-zinc-600"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-zinc-300 font-mono text-[11px]">
                        {v.flags && v.flags.length > 0 && (
                          <span className="text-sm">{v.flags.join(' ')}</span>
                        )}
                        <span className="font-semibold text-zinc-300">{v.countries.join(', ')}:</span>
                      </div>

                      <button
                        onClick={() => handleSpeakVariant(v.variant)}
                        disabled={speakingVariant === v.variant}
                        className="flex items-center gap-1 px-1.5 py-0.5 bg-[#1f2230] hover:bg-zinc-700 text-zinc-200 text-[10px] font-mono border border-zinc-700 cursor-pointer transition-colors"
                        title={`Escuchar variante: ${v.variant}`}
                      >
                        <Volume2 className="w-3 h-3 text-zinc-400" />
                        <span>Escuchar</span>
                      </button>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-zinc-400 font-mono uppercase tracking-wide">
                        {v.variant}
                      </span>
                    </div>

                    {v.note && (
                      <p className="text-[11px] text-zinc-400 font-sans leading-relaxed border-l-2 border-zinc-700 pl-2">
                        {v.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-[#0b0c10] border border-[#27272a] p-2.5 text-xs text-zinc-300 font-sans flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                Término <strong className="text-white">panhispánico uniforme</strong>: se utiliza
                con este mismo significado y forma habitual en todos los países de habla hispana sin
                sinónimos regionales excluyentes.
              </p>
            </div>
          )}

          {/* Linguistic explanation */}
          {regionalUsage.explanation && !compact && (
            <div className="text-[11px] text-zinc-400 font-sans leading-relaxed pt-1.5 border-t border-[#22242c] flex items-start gap-1.5">
              <Sparkles className="w-3 h-3 text-zinc-400 shrink-0 mt-0.5" />
              <span>{regionalUsage.explanation}</span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
