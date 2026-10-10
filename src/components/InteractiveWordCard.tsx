import { WordDetailsStatus, WordLexicalExtras, type DetailState } from './WordDetailsStatus';
import React, { useState, useEffect } from 'react';
import { WordItem } from '../types';
import { playSpanishSpeech } from '../utils/audio';
import { getValidArticle, cleanDisplayWord } from '../utils/grammar';
import { getApiHeaders } from '../utils/apiKeyStorage';
import { RegionalVariantsSection } from './RegionalVariantsSection';
import {
  Volume2,
  Volume1,
  BookOpen,
  X,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  RotateCw,
  Sparkles,
  Plus,
  Check,
} from 'lucide-react';

interface InteractiveWordCardProps {
  word: WordItem;
  detailState?: DetailState;
  totalWords: number;
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onOpenFullDetail: () => void;
  onToggleFavorite?: (id: string) => void;
}

export const InteractiveWordCard: React.FC<InteractiveWordCardProps> = ({
  word,
  detailState,
  totalWords,
  currentIndex,
  onClose,
  onPrev,
  onNext,
  onOpenFullDetail,
  onToggleFavorite,
}) => {
  const [isPlayingWord, setIsPlayingWord] = useState(false);
  const [isPlayingSentence, setIsPlayingSentence] = useState(false);
  const [extraExample, setExtraExample] = useState<string | null>(null);
  const [isLoadingExtra, setIsLoadingExtra] = useState(false);

  useEffect(() => { setExtraExample(null); }, [word.id]);

  // Close card when pressing Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        onPrev();
      } else if (e.key === 'ArrowRight') {
        onNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onPrev, onNext]);

  const handleSpeakWord = async (rate: number = 0.9) => {
    setIsPlayingWord(true);
    await playSpanishSpeech(word.word, rate);
    setIsPlayingWord(false);
  };

  const handleSpeakSentence = async () => {
    setIsPlayingSentence(true);
    const textToSpeak = extraExample || word.example;
    await playSpanishSpeech(textToSpeak, 0.85);
    setIsPlayingSentence(false);
  };

  // Generate an extra contextual sentence using Gemini
  const handleGenerateExtraSentence = async () => {
    if (isLoadingExtra) return;
    setIsLoadingExtra(true);

    try {
      const res = await fetch('/api/generate-activity', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          topic: word.word,
          words: [word.word],
          activityType: 'sentence',
        }),
      });

      const data = await res.json();
      if (data.activity?.challenges?.[0]?.instruction) {
        setExtraExample(data.activity.challenges[0].instruction);
      } else {
        setExtraExample(`Para ${word.lemma || word.word} correctamente, es fundamental prestar atención al tiempo y al contexto.`);
      }
    } catch {
      setExtraExample(`En el uso cotidiano en español es común ${word.lemma || word.word} con naturalidad y precisión.`);
    } finally {
      setIsLoadingExtra(false);
    }
  };

  const levelColorMap: Record<string, string> = {
    A1: 'bg-zinc-950/80 text-zinc-400 border-zinc-800',
    A2: 'bg-zinc-950/80 text-zinc-400 border-zinc-800',
    B1: 'bg-zinc-950/80 text-zinc-400 border-zinc-800',
    B2: 'bg-zinc-950/80 text-zinc-400 border-zinc-800',
    C1: 'bg-zinc-950/80 text-zinc-400 border-zinc-800',
  };

  return (
    <>
      {/* Mobile backdrop overlay to tap anywhere outside to close */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs sm:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="region"
        aria-label="Ficha de información de palabra"
        className="word-inspector fixed inset-x-2 bottom-2 max-h-[80vh] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[480px] sm:max-h-[82vh] z-50 bg-[#111111] border border-zinc-600 shadow-2xl overflow-hidden flex flex-col transition-all duration-200"
      >
        {/* Mobile swipe/close handle indicator */}
        <div
          onClick={onClose}
          className="sm:hidden w-full py-1.5 flex justify-center bg-[#151515] cursor-pointer border-b border-[#282828]"
          title="Toca para cerrar"
        >
          <div className="w-10 h-1 bg-zinc-600 rounded-full" />
        </div>

        {/* Sticky Top Bar with Pagination, Controls, and High-Contrast Close Button */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-[#181818] border-b border-[#303030] text-xs font-mono text-zinc-300 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-zinc-400 inline-block rounded-full" />
            <span className="font-bold text-white uppercase tracking-wider text-[11px]">
              Palabra
            </span>
            <span className="text-zinc-500">/</span>
            <span className="tabular-nums text-zinc-300 font-bold">
              {currentIndex + 1} de {totalWords}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onPrev}
              className="p-1.5 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer border border-[#27272a]"
              title="Palabra anterior (←)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={onNext}
              className="p-1.5 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer border border-[#27272a]"
              title="Palabra siguiente (→)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={onOpenFullDetail}
              className="p-1.5 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer border border-[#27272a]"
              title="Ver pantalla completa"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* High-visibility Close Button - always visible in sticky header */}
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-3 py-1.5 bg-zinc-600 hover:bg-zinc-500 active:bg-zinc-700 text-white border border-zinc-400 font-mono text-xs font-bold transition-all cursor-pointer shadow-md ml-1"
              title="Cerrar ficha (Esc)"
              aria-label="Cerrar panel de palabra"
            >
              <X className="w-4 h-4" />
              <span className="text-[11px] uppercase tracking-wider font-extrabold">Cerrar</span>
            </button>
          </div>
        </div>

      {/* Scrollable Body Content */}
      <div className="p-4 sm:p-5 space-y-4 font-sans overflow-y-auto flex-1 overscroll-contain">
        {/* Word Title & Pronunciation Audio */}
        <div className="inspector-heading flex items-start justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-2 flex-wrap">
              {(() => {
                const validArt = getValidArticle(word.category, word.article);
                return validArt ? (
                  <span className="text-zinc-500 font-mono text-lg font-normal">
                    {validArt}
                  </span>
                ) : null;
              })()}
              <h3 className="inspector-title text-2xl font-bold tracking-tight text-white font-mono uppercase">
                {cleanDisplayWord(word.lemma || word.word)}
              </h3>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs font-mono text-zinc-400">
              <span className="uppercase text-zinc-300">{word.category}</span>
              {word.subcategory && (
                <>
                  <span className="text-zinc-600">/</span>
                  <span className="text-zinc-400">{word.subcategory}</span>
                </>
              )}
              <span className="text-zinc-600">/</span>
              <span
                className={`px-1.5 py-0.5 border text-[10px] font-bold uppercase ${
                  levelColorMap[word.level] || 'border-zinc-700 text-zinc-400'
                }`}
              >
                {word.level}
              </span>
            </div>
          </div>

          {/* Action Buttons: Guardar palabra (+) & Audio Pronunciation */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {onToggleFavorite && (
              <button
                onClick={() => onToggleFavorite(word.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                  word.isFavorite
                    ? 'bg-zinc-950/80 text-zinc-300 border-zinc-500'
                    : 'bg-[#1c1c1c] hover:bg-zinc-800 text-zinc-200 border-[#27272a] hover:border-zinc-500'
                }`}
                title={word.isFavorite ? 'Palabra guardada (clic para quitar)' : 'Guardar palabra (+)'}
              >
                {word.isFavorite ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Guardada</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Guardar</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => handleSpeakWord(0.9)}
              disabled={isPlayingWord}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                isPlayingWord
                  ? 'bg-zinc-400 text-black animate-pulse'
                  : 'bg-white hover:bg-zinc-200 text-black'
              }`}
              title="Escuchar pronunciación nativa"
            >
              <Volume2 className="w-4 h-4" />
              <span>{isPlayingWord ? 'Sonando' : 'Voz'}</span>
            </button>
            <button
              onClick={() => handleSpeakWord(0.7)}
              disabled={isPlayingWord}
              className="p-1.5 bg-[#1c1c1c] border border-[#27272a] text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Pronunciación lenta (0.7x)"
            >
              <Volume1 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* English Translation */}
        {word.translationEn && (
          <div className="text-xs font-mono text-zinc-400 bg-[#141414] border border-[#282828] px-3 py-1.5 flex items-center gap-2">
            <span className="text-zinc-500 uppercase text-[10px] tracking-wider">Traducción:</span>
            <span className="text-zinc-200 font-sans text-sm">{word.translationEn}</span>
          </div>
        )}

        {word.detailsPending ? <WordDetailsStatus state={detailState} /> : <>
        <WordLexicalExtras word={word} />
        {/* Pedagogical Meaning */}
        <div className="bg-[#141414] border border-[#282828] p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] font-mono uppercase tracking-wider font-bold">
            <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
            <span>Definición didáctica</span>
          </div>
          <p className="text-zinc-200 text-sm leading-relaxed font-sans">
            {word.meaning}
          </p>
        </div>

        {/* Regional Pan-Hispanic Dialectal Variants (Only for nouns) */}
        {word.category === 'sustantivo' && (
          <RegionalVariantsSection word={word} />
        )}

        {/* Example in Context */}
        <div className="bg-[#141414] border border-[#282828] p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider font-bold">
              Ejemplo en contexto
            </span>
            <button
              onClick={handleSpeakSentence}
              disabled={isPlayingSentence}
              className={`p-1 text-xs transition-colors cursor-pointer ${
                isPlayingSentence
                  ? 'text-zinc-400 animate-pulse'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Escuchar frase completa"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-white text-sm font-sans leading-relaxed border-l-2 border-zinc-400 pl-2.5">
            "{extraExample || word.example}"
          </p>

          {word.collocation && (
            <div className="text-[11px] font-mono text-zinc-400 pt-1 border-t border-zinc-800 flex items-center gap-1.5">
              <span className="text-zinc-500 uppercase">Colocación:</span>
              <span className="text-zinc-200">{word.collocation}</span>
            </div>
          )}
        </div>

        {/* Action button to generate an extra sentence */}
        <div className="flex items-center justify-between pt-1 font-mono">
          <button
            onClick={handleGenerateExtraSentence}
            disabled={isLoadingExtra}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            {isLoadingExtra ? (
              <>
                <RotateCw className="w-3 h-3 animate-spin text-zinc-400" />
                <span>Generando...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3 text-zinc-400" />
                <span className="underline underline-offset-4">Otra frase de ejemplo</span>
              </>
            )}
          </button>

          <button
            onClick={onNext}
            className="text-xs font-bold text-white hover:underline flex items-center gap-1 uppercase tracking-wider cursor-pointer"
          >
            <span>Siguiente</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        </>}
      </div>

      {/* Sticky Bottom Bar with Quick Close Button for mobile ease */}
      <div className="px-3 sm:px-4 py-2 bg-[#141414] border-t border-[#282828] flex items-center justify-between text-xs font-mono text-zinc-400 shrink-0">
        <span className="text-[11px] text-zinc-500 hidden sm:inline">Pulsa [Esc] para salir</span>
        <span className="text-[10px] text-zinc-500 sm:hidden">Toca fuera para cerrar</span>
        <button
          onClick={onClose}
          className="px-3 py-1 bg-[#1c1e28] hover:bg-zinc-700 active:bg-zinc-800 text-zinc-200 text-xs uppercase tracking-wider font-bold transition-colors cursor-pointer border border-[#2f3240]"
        >
          Cerrar ficha
        </button>
      </div>
    </div>
    </>
  );
};
