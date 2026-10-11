import { useDialogFocus } from '../hooks/useDialogFocus';
import { WordDetailsStatus, WordLexicalExtras, type DetailState } from './WordDetailsStatus';
import React, { useState } from 'react';
import { WordItem } from '../types';
import { playSpanishSpeech } from '../utils/audio';
import { getValidArticle, cleanDisplayWord } from '../utils/grammar';
import { RegionalVariantsSection } from './RegionalVariantsSection';
import { Volume2, Plus, Check, Minus, EyeOff, X } from 'lucide-react';

interface WordDetailModalProps {
  word: WordItem | null;
  detailState?: DetailState;
  onClose: () => void;
  onUpdateWeight: (id: string, delta: number) => void;
  onToggleFavorite: (id: string) => void;
  onHideWord: (id: string) => void;
}

export const WordDetailModal: React.FC<WordDetailModalProps> = ({
  word,
  detailState,
  onClose,
  onUpdateWeight,
  onToggleFavorite,
  onHideWord,
}) => {
  const dialogRef = useDialogFocus(!!word);
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

  const article = getValidArticle(word.category, word.article);

  return (
    <div
      ref={dialogRef} tabIndex={-1} role="dialog"
      aria-modal="true"
      aria-label="Ficha completa de palabra"
      className="lexical-overlay"
      onClick={onClose}
    >
      <div className="lexical-sheet lexical-expanded" onClick={(e) => e.stopPropagation()}>
        <div className="lexical-toolbar">
          <span className="eyebrow">
            <span>Ficha completa</span>
            <span>Nivel {word.level}</span>
          </span>
          <div className="toolbar-actions">
            <button onClick={onClose} className="icon-button" title="Cerrar ficha (Esc)" aria-label="Cerrar ficha completa">
              <X aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="lexical-body">
          <div className="inspector-heading">
            <h2 className="lexical-title">
              {article && <span className="title-article">{article}</span>}
              <span>{cleanDisplayWord(word.lemma || word.word)}</span>
            </h2>
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
            <button onClick={() => handleSpeak(speechRate)} disabled={isPlaying} className="button-primary" data-playing={isPlaying || undefined}>
              <Volume2 aria-hidden="true" />
              <span>{isPlaying ? 'Sonando' : 'Escuchar'}</span>
            </button>
            <button
              onClick={() => setSpeechRate((r) => (r === 0.9 ? 0.65 : 0.9))}
              className="button-secondary"
              title="Alternar velocidad (0.9× / 0.65×)"
              aria-pressed={speechRate !== 0.9}
            >
              <span>{speechRate}×</span>
            </button>
            <button
              onClick={() => onToggleFavorite(word.id)}
              className="button-secondary"
              aria-pressed={!!word.isFavorite}
            >
              {word.isFavorite ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
              <span>{word.isFavorite ? 'Guardada' : 'Guardar'}</span>
            </button>
          </div>

          {word.detailsPending ? <WordDetailsStatus state={detailState} /> : <>
            <WordLexicalExtras word={word} />

            <section className="lexical-section lexical-meaning">
              <h3 className="lexical-label">Significado</h3>
              <p>{word.meaning}</p>
            </section>

            {word.example && (
              <section className="lexical-section lexical-example">
                <h3 className="lexical-label">En contexto</h3>
                <blockquote>{word.example}</blockquote>
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
          </>}

          <div className="lexical-adjustments">
            <div className="stepper">
              <span className="lexical-label">Tamaño en la nube</span>
              <div className="stepper-controls">
                <button onClick={() => onUpdateWeight(word.id, -1)} disabled={word.weight <= 1} className="icon-button" aria-label="Reducir tamaño">
                  <Minus aria-hidden="true" />
                </button>
                <span className="stepper-value tabular-nums">{word.weight}<span>/5</span></span>
                <button onClick={() => onUpdateWeight(word.id, 1)} disabled={word.weight >= 5} className="icon-button" aria-label="Aumentar tamaño">
                  <Plus aria-hidden="true" />
                </button>
              </div>
            </div>

            <button onClick={() => onHideWord(word.id)} className="text-button" title="Quitar palabra de la nube">
              <EyeOff aria-hidden="true" />
              <span>Ocultar de la nube</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
