import React, { useState } from 'react';
import { WordItem } from '../types';
import { playSpanishSpeech } from '../utils/audio';
import { getValidArticle, cleanDisplayWord } from '../utils/grammar';
import { RegionalVariantsSection } from './RegionalVariantsSection';
import { Volume2, Volume1, Star, Plus, Check, Minus, EyeOff, X, BookOpen, Quote } from 'lucide-react';

interface WordDetailModalProps {
  word: WordItem | null;
  onClose: () => void;
  onUpdateWeight: (id: string, delta: number) => void;
  onToggleFavorite: (id: string) => void;
  onHideWord: (id: string) => void;
}

export const WordDetailModal: React.FC<WordDetailModalProps> = ({
  word,
  onClose,
  onUpdateWeight,
  onToggleFavorite,
  onHideWord,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speechRate, setSpeechRate] = useState<number>(0.9);

  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!word) return null;

  const handleSpeak = async (rate: number) => {
    setIsPlaying(true);
    await playSpanishSpeech(word.word, rate);
    setIsPlaying(false);
  };

  const levelColorMap: Record<string, string> = {
    A1: 'border-emerald-600 text-emerald-400',
    A2: 'border-teal-600 text-teal-400',
    B1: 'border-amber-600 text-amber-400',
    B2: 'border-orange-600 text-orange-400',
    C1: 'border-rose-600 text-rose-400',
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#0d0e14] border border-[#27272a] shadow-2xl overflow-hidden font-mono flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#22242c] bg-[#12131a] shrink-0">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="uppercase text-white font-bold">{word.category}</span>
            {word.subcategory && (
              <>
                <span className="text-zinc-600">/</span>
                <span className="text-zinc-300">{word.subcategory}</span>
              </>
            )}
            <span className="text-zinc-600">/</span>
            <span
              className={`px-1.5 py-0.5 border text-[11px] font-bold uppercase ${
                levelColorMap[word.level] || 'border-zinc-700 text-zinc-300'
              }`}
            >
              Nivel {word.level}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleFavorite(word.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                word.isFavorite
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500'
                  : 'bg-[#181920] hover:bg-zinc-800 text-zinc-300 border-[#27272a] hover:border-zinc-500'
              }`}
              title={word.isFavorite ? 'Palabra guardada (clic para quitar)' : 'Guardar palabra (+)'}
            >
              {word.isFavorite ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Guardada</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Guardar</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500 text-xs font-bold transition-all cursor-pointer"
              title="Cerrar ficha (Esc)"
            >
              <X className="w-4 h-4" />
              <span className="text-[11px] uppercase tracking-wider">Cerrar</span>
            </button>
          </div>
        </div>

        {/* Word Title & Pronunciation */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-2">
                {(() => {
                  const validArt = getValidArticle(word.category, word.article);
                  return validArt ? (
                    <span className="text-zinc-500 text-xl font-normal">
                      {validArt}
                    </span>
                  ) : null;
                })()}
                <h2 className="text-3xl font-black uppercase tracking-tight text-white font-mono">
                  {cleanDisplayWord(word.lemma || word.word)}
                </h2>
              </div>
              {word.translationEn && (
                <p className="text-sm text-zinc-400 mt-1">
                  <span className="text-zinc-500 uppercase">EN:</span> {word.translationEn}
                </p>
              )}
            </div>

            {/* Pronunciation triggers */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => handleSpeak(speechRate)}
                disabled={isPlaying}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-zinc-200 text-black text-xs uppercase font-bold tracking-wider transition-colors cursor-pointer"
                title="Escuchar audio"
              >
                <Volume2 className="w-4 h-4 text-black" />
                <span>Audio</span>
              </button>
              <button
                onClick={() => setSpeechRate((r) => (r === 0.9 ? 0.65 : 0.9))}
                className="px-2 py-1.5 bg-[#181920] border border-[#27272a] text-zinc-300 hover:text-white text-xs transition-colors cursor-pointer"
                title="Alternar velocidad (0.9x / 0.65x)"
              >
                <Volume1 className="w-3.5 h-3.5 inline mr-1 text-zinc-400" />
                <span>{speechRate}x</span>
              </button>
            </div>
          </div>

          {/* Meaning Block */}
          <div className="bg-[#14161f] border border-[#27272a] p-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] uppercase tracking-wider font-bold">
              <BookOpen className="w-3.5 h-3.5 text-white" />
              <span>Significado didáctico</span>
            </div>
            <p className="text-zinc-200 text-sm leading-relaxed font-sans">
              {word.meaning}
            </p>
          </div>

          {/* Variantes Regionales en Países Hispanohablantes (Sustantivos) */}
          {word.category === 'sustantivo' && (
            <RegionalVariantsSection word={word} />
          )}

          {/* Example Sentence */}
          {word.example && (
            <div className="bg-[#14161f] border border-[#27272a] p-4 space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] uppercase tracking-wider font-bold">
                <Quote className="w-3.5 h-3.5 text-emerald-400" />
                <span>Frase en contexto</span>
              </div>
              <p className="text-white text-sm font-sans leading-relaxed border-l-2 border-emerald-400 pl-2.5">
                "{word.example}"
              </p>
              {word.collocation && (
                <p className="text-xs text-zinc-400 pt-2 border-t border-zinc-800">
                  <span className="text-zinc-500 uppercase">Colocación:</span> {word.collocation}
                </p>
              )}
            </div>
          )}

          {/* Controls: Weight adjustment & Hide */}
          <div className="flex items-center justify-between pt-2 border-t border-[#22242c] text-xs">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 uppercase text-[11px]">Tamaño en nube:</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onUpdateWeight(word.id, -1)}
                  disabled={word.weight <= 1}
                  className="p-1 border border-[#27272a] bg-[#181920] hover:bg-zinc-800 text-zinc-300 disabled:opacity-40 cursor-pointer"
                  title="Reducir tamaño"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 py-0.5 border border-[#27272a] bg-[#14161f] text-white font-bold">
                  {word.weight} / 5
                </span>
                <button
                  onClick={() => onUpdateWeight(word.id, 1)}
                  disabled={word.weight >= 5}
                  className="p-1 border border-[#27272a] bg-[#181920] hover:bg-zinc-800 text-zinc-300 disabled:opacity-40 cursor-pointer"
                  title="Aumentar tamaño"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <button
              onClick={() => onHideWord(word.id)}
              className="flex items-center gap-1 text-zinc-500 hover:text-rose-400 transition-colors uppercase text-[11px] cursor-pointer"
              title="Quitar palabra de la nube"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Ocultar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
