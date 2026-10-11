import { WordDetailsStatus, WordLexicalExtras, type DetailState } from './WordDetailsStatus';
import React, { useState, useEffect } from 'react';
import { WordItem } from '../types';
import { playSpanishSpeech } from '../utils/audio';
import { getValidArticle, cleanDisplayWord } from '../utils/grammar';
import { getApiHeaders } from '../utils/apiKeyStorage';
import { RegionalVariantsSection } from './RegionalVariantsSection';
import { Volume2, X, ChevronLeft, ChevronRight, Maximize2, RotateCw, Sparkles, Plus, Check, ArrowRight } from 'lucide-react';

interface InteractiveWordCardProps {
  word: WordItem;
  closing?: boolean;
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
  closing = false,
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
    if (closing) return;
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
  }, [closing, onClose, onPrev, onNext]);

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

  const article = getValidArticle(word.category, word.article);
  const sentence = extraExample || word.example;

  return (
    <>
      <div className="sheet-backdrop" data-closing={closing || undefined} onClick={onClose} aria-hidden="true" />

      <aside
        role="region"
        aria-label="Ficha de información de palabra"
        data-closing={closing || undefined}
        className="lexical-sheet word-inspector"
      >
        <button type="button" onClick={onClose} className="sheet-handle" aria-label="Cerrar ficha" tabIndex={-1}>
          <span />
        </button>

        <div className="lexical-toolbar">
          <span className="eyebrow">
            <span>Ficha</span>
            <span className="tabular-nums">
              {String(currentIndex + 1).padStart(2, '0')} / {String(totalWords).padStart(2, '0')}
            </span>
          </span>

          <div className="toolbar-actions">
            <button onClick={onPrev} className="icon-button" title="Palabra anterior (←)" aria-label="Palabra anterior">
              <ChevronLeft aria-hidden="true" />
            </button>
            <button onClick={onNext} className="icon-button" title="Palabra siguiente (→)" aria-label="Palabra siguiente">
              <ChevronRight aria-hidden="true" />
            </button>
            <button onClick={onOpenFullDetail} className="icon-button" title="Abrir ficha completa" aria-label="Abrir ficha completa">
              <Maximize2 aria-hidden="true" />
            </button>
            <button onClick={onClose} className="icon-button" title="Cerrar ficha (Esc)" aria-label="Cerrar panel de palabra">
              <X aria-hidden="true" />
            </button>
          </div>
        </div>

        <div key={word.id} className="lexical-body">
          <div className="inspector-heading">
            <h3 className="lexical-title">
              {article && <span className="title-article">{article}</span>}
              <span>{cleanDisplayWord(word.lemma || word.word)}</span>
            </h3>
            <div className="lexical-meta">
              <span>{word.category}</span>
              {word.subcategory && <span>{word.subcategory}</span>}
              <span className="level-badge">{word.level}</span>
            </div>
            {word.translationEn && (
              <p className="lexical-translation">
                <span className="lexical-label">EN</span>
                <span>{word.translationEn}</span>
              </p>
            )}
          </div>

          <div className="lexical-actions">
            <button
              onClick={() => handleSpeakWord(0.9)}
              disabled={isPlayingWord}
              className="button-primary"
              data-playing={isPlayingWord || undefined}
              title="Escuchar pronunciación"
            >
              <Volume2 aria-hidden="true" />
              <span>{isPlayingWord ? 'Sonando' : 'Escuchar'}</span>
            </button>
            <button
              onClick={() => handleSpeakWord(0.7)}
              disabled={isPlayingWord}
              className="button-secondary"
              title="Pronunciación lenta (0.7×)"
            >
              <span>0.7×</span>
            </button>
            {onToggleFavorite && (
              <button
                onClick={() => onToggleFavorite(word.id)}
                className="button-secondary"
                aria-pressed={!!word.isFavorite}
                title={word.isFavorite ? 'Quitar de guardadas' : 'Guardar palabra'}
              >
                {word.isFavorite ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                <span>{word.isFavorite ? 'Guardada' : 'Guardar'}</span>
              </button>
            )}
          </div>

          {word.detailsPending ? <WordDetailsStatus state={detailState} /> : <>
            <WordLexicalExtras word={word} />

            <section className="lexical-section lexical-meaning">
              <h4 className="lexical-label">Significado</h4>
              <p>{word.meaning}</p>
            </section>

            {sentence && (
              <section className="lexical-section lexical-example">
                <div className="section-head">
                  <h4 className="lexical-label">En contexto</h4>
                  <button
                    onClick={handleSpeakSentence}
                    disabled={isPlayingSentence}
                    className={`icon-button ${isPlayingSentence ? 'is-playing' : ''}`}
                    title="Escuchar la frase"
                    aria-label="Escuchar la frase"
                  >
                    <Volume2 aria-hidden="true" />
                  </button>
                </div>
                <blockquote key={sentence}>{sentence}</blockquote>
                {word.collocation && (
                  <p className="lexical-collocation">
                    <span className="lexical-label">Colocación</span>
                    <span>{word.collocation}</span>
                  </p>
                )}
              </section>
            )}

            {word.category === 'sustantivo' && (
              <details className="regional-disclosure">
                <summary>Variantes regionales</summary>
                <RegionalVariantsSection word={word} />
              </details>
            )}

            <div className="sheet-footer">
              <button onClick={handleGenerateExtraSentence} disabled={isLoadingExtra} className="text-button">
                {isLoadingExtra ? <RotateCw className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
                <span>{isLoadingExtra ? 'Generando…' : 'Otra frase'}</span>
              </button>
              <button onClick={onNext} className="text-button is-strong">
                <span>Siguiente</span>
                <ArrowRight aria-hidden="true" />
              </button>
            </div>
          </>}
        </div>
      </aside>
    </>
  );
};
