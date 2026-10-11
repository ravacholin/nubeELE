import { requestWordDetails } from './utils/wordDetails';
import { requestCloud } from './utils/cloudRequests';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
  WordItem,
  CloudData,
  LayoutMode,
} from './types';
import { PALETTES } from './utils/palettes';
import { WordCloudCanvas } from './components/WordCloudCanvas';
import { WordDetailModal } from './components/WordDetailModal';
import { ExportModal } from './components/ExportModal';
import { ApiKeyModal } from './components/ApiKeyModal';
import { getStoredApiKey, getApiHeaders } from './utils/apiKeyStorage';
import {
  getSavedWords,
  isWordSaved,
  saveWord,
  removeSavedWord,
  updateSavedWordDetails,
} from './utils/savedWordsStorage';
import {
  ArrowRight,
  ArrowUpRight,
  Maximize2,
  Minimize2,
  RotateCcw,
  Bookmark,
  KeyRound,
  Share,
  X,
} from 'lucide-react';

const SUGGESTED_TEMPLATES = [
  { label: 'Verduras y huerta', query: 'verduras y hortalizas', tag: 'A1–A2' },
  { label: 'Verbos de cocción', query: 'verbos de coccion y tecnicas culinarias', tag: 'B1' },
  { label: 'Emociones y estados', query: 'emociones y sentimientos', tag: 'B1–B2' },
  { label: 'Ciudad y barrio', query: 'lugares de la ciudad y el barrio', tag: 'A2' },
  { label: 'Viajes y estaciones', query: 'viajes, trenes y aeropuertos', tag: 'B1' },
  { label: 'Coloquialismos', query: 'expresiones coloquiales y modismos', tag: 'B2–C1' },
];

const EXPANSIONS = [
  { type: 'more', label: 'Más palabras' },
  { type: 'advanced', label: 'Avanzado B2–C1' },
  { type: 'verbs', label: 'Verbos' },
  { type: 'expressions', label: 'Expresiones' },
] as const;

const LEVELS = ['Todos', 'A1', 'A2', 'B1', 'B2', 'C1'];

/** Run a state change inside a view transition where the browser supports it. */
function withViewTransition(update: () => void) {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduced) { update(); return; }
  doc.startViewTransition(() => flushSync(update));
}

export default function App() {
  const cloudRequestId = useRef(0);
  const [topicInput, setTopicInput] = useState('');
  const [currentTopic, setCurrentTopic] = useState('verduras');
  const [selectedLevel, setSelectedLevel] = useState('Todos');

  const [cloudData, setCloudData] = useState<CloudData | null>(null);
  const hiddenDuringGeneration = useRef(new Set<string>());
  const [words, setWords] = useState<WordItem[]>([]);
  const [previousWords, setPreviousWords] = useState<WordItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Layout & Presentation States (Elegant Dark Brutalist)
  const layoutMode: LayoutMode = 'floating';
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  // Interactive Exploration Word
  const [selectedWord, setSelectedWord] = useState<WordItem | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailRetry, setDetailRetry] = useState(0);
  useEffect(() => {
    setDetailError(null);
    if (!selectedWord?.detailsPending) return;
    let active = true;
    const word = selectedWord;
    requestWordDetails(word, currentTopic, getApiHeaders()).then(details => {
      if (!active) return;
      const enrichment = { ...details, detailsPending: false };
      setWords(list => list.map(item => item.id === word.id ? { ...item, ...enrichment } : item));
      setSelectedWord(current => current?.id === word.id ? { ...current, ...enrichment } : current);
      updateSavedWordDetails(word.id, enrichment);
    }).catch(error => { if (active) setDetailError(error.message || 'No se pudo completar la ficha.'); });
    return () => { active = false; };
  }, [selectedWord?.id, currentTopic, detailRetry]);

  // Warm just one likely selection after the cloud is usable, never all its cards.
  useEffect(() => {
    if (isLoading || selectedWord || !words.length) return;
    const first = [...words].sort((a, b) => b.weight - a.weight)[0];
    if (!first.detailsPending) return;
    const timer = setTimeout(() => {
      requestWordDetails(first, currentTopic, getApiHeaders()).catch(() => {});
    }, 1200);
    return () => clearTimeout(timer);
  }, [words, currentTopic, selectedWord?.id, isLoading]);
  const detailState = { loading: !!selectedWord?.detailsPending && !detailError, error: detailError, retry: () => setDetailRetry(value => value + 1) };
  const [isFullModalOpen, setIsFullModalOpen] = useState(false);

  // Modals & Saved Words
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [hasCustomApiKey, setHasCustomApiKey] = useState(() => !!getStoredApiKey());
  const [savedWordsList, setSavedWordsList] = useState<WordItem[]>(() => getSavedWords());
  const [showOnlySaved, setShowOnlySaved] = useState(false);
  const [saveToast, setSaveToast] = useState<{ text: string; word: string; isSaved: boolean } | null>(null);

  // Listen for local API key and saved words modifications
  useEffect(() => {
    const handleKeyChange = () => {
      setHasCustomApiKey(!!getStoredApiKey());
      setDetailRetry(value => value + 1);
    };
    const handleSavedChange = () => {
      setSavedWordsList(getSavedWords());
    };
    window.addEventListener('gemini-api-key-changed', handleKeyChange);
    window.addEventListener('nube-saved-words-changed', handleSavedChange);
    return () => {
      window.removeEventListener('gemini-api-key-changed', handleKeyChange);
      window.removeEventListener('nube-saved-words-changed', handleSavedChange);
    };
  }, []);

  // Single elegant dark minimalist brutalist palette
  const activePalette = PALETTES.noche;

  // Fetch or generate word cloud
  const fetchCloud = useCallback(async (query: string, level = 'Todos') => {
    const requestId = ++cloudRequestId.current;
    hiddenDuringGeneration.current.clear();
    setIsLoading(true);
    setErrorMessage(null);
    setSelectedWord(null);

    let receivedProgress = false;
    const applyCloud = (data: CloudData | null) => {
      if (requestId !== cloudRequestId.current) return;
      if (!data) {
        if (receivedProgress) { setWords([]); setCloudData(null); setSelectedWord(null); }
        return;
      }
      receivedProgress = true;
      setCloudData(data);
      setCurrentTopic(query);
      setWords(previous => data.words.filter(w => !hiddenDuringGeneration.current.has(w.id)).map(w => {
        const existing = previous.find(item => item.id === w.id);
        return {
          ...w,
          ...existing,
          isFavorite: isWordSaved(w.id) || isWordSaved(w.lemma || w.word) || !!w.isFavorite,
        };
      }));
    };
    try {
      const data = await requestCloud(query, level, getApiHeaders(), applyCloud);
      applyCloud(data);
    } catch (err: any) {
      if (requestId !== cloudRequestId.current) return;
      if (receivedProgress) { setWords([]); setCloudData(null); setSelectedWord(null); }
      console.error(err);
      setErrorMessage(err.message || 'No se pudo generar la nube. Intenta de nuevo.');
    } finally {
      if (requestId === cloudRequestId.current) setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchCloud('verduras');
  }, [fetchCloud]);

  // Handle Form Submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicInput.trim()) return;
    fetchCloud(topicInput.trim(), selectedLevel);
  };

  // Expand Cloud with more words
  const handleExpandCloud = async (type: 'more' | 'advanced' | 'verbs' | 'expressions') => {
    if (isExpanding || isLoading) return;
    const requestId = cloudRequestId.current;
    setIsExpanding(true);

    try {
      const existingWordNames = words.map((w) => w.lemma || w.word);
      const res = await fetch('/api/expand-cloud', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          topic: currentTopic,
          existingWords: existingWordNames,
          expansionType: type,
        }),
      });

      const data = await res.json();
      if (requestId !== cloudRequestId.current) return;
      if (data.success && Array.isArray(data.newWords)) {
        setWords((prev) => [...prev, ...data.newWords]);
      } else {
        throw new Error(data.error || 'No se pudieron añadir palabras');
      }
    } catch (err: any) {
      if (requestId !== cloudRequestId.current) return;
      console.warn('Expand error, fallback complementario:', err);
      const fallbackAdditions: WordItem[] = [
        { id: `fb_${Date.now()}_1`, word: 'el aderezo', lemma: 'aderezo', article: 'el', category: 'sustantivo', level: 'A2', weight: 3, meaning: 'Salsa o condimento con que se sazona una ensalada o plato.', example: 'Preparamos un aderezo con aceite, vinagre y mostaza.' },
        { id: `fb_${Date.now()}_2`, word: 'condimentar', lemma: 'condimentar', article: null, category: 'verbo', level: 'B1', weight: 4, meaning: 'Añadir especias a la comida para realzar su sabor.', example: 'Condimenta las verduras con romero y pimienta negra.' },
        { id: `fb_${Date.now()}_3`, word: 'crujiente', lemma: 'crujiente', article: null, category: 'adjetivo', level: 'A2', weight: 4, meaning: 'Que cruje al masticarlo; textura fresca y apetecible.', example: 'La zanahoria cruda es fresca y crujiente.' },
      ];
      setWords((prev) => [...prev, ...fallbackAdditions]);
    } finally {
      setIsExpanding(false);
    }
  };

  // Next / Previous Word navigation
  const handleNextWord = () => {
    if (!words.length) return;
    if (!selectedWord) {
      setSelectedWord(words[0]);
      return;
    }
    const idx = words.findIndex((w) => w.id === selectedWord.id);
    const nextIdx = (idx + 1) % words.length;
    setSelectedWord(words[nextIdx]);
  };

  const handlePrevWord = () => {
    if (!words.length) return;
    if (!selectedWord) {
      setSelectedWord(words[words.length - 1]);
      return;
    }
    const idx = words.findIndex((w) => w.id === selectedWord.id);
    const prevIdx = (idx - 1 + words.length) % words.length;
    setSelectedWord(words[prevIdx]);
  };

  const handleUpdateWeight = (id: string, delta: number) => {
    setWords((prev) =>
      prev.map((w) =>
        w.id === id
          ? { ...w, weight: Math.max(1, Math.min(5, w.weight + delta)) }
          : w
      )
    );
    if (selectedWord && selectedWord.id === id) {
      setSelectedWord((prev) =>
        prev ? { ...prev, weight: Math.max(1, Math.min(5, prev.weight + delta)) } : null
      );
    }
  };

  const handleToggleFavorite = (id: string) => {
    setWords((prev) => {
      let toggledWord: WordItem | undefined;
      const updated = prev.map((w) => {
        if (w.id === id) {
          const nextFav = !w.isFavorite;
          toggledWord = { ...w, isFavorite: nextFav };
          if (nextFav) {
            saveWord(toggledWord);
            setSaveToast({ text: 'Palabra guardada en tu lista', word: w.lemma || w.word, isSaved: true });
          } else {
            removeSavedWord(w.id);
            removeSavedWord(w.lemma || w.word);
            setSaveToast({ text: 'Palabra eliminada de guardadas', word: w.lemma || w.word, isSaved: false });
          }
          return toggledWord;
        }
        return w;
      });
      setTimeout(() => setSaveToast(null), 2500);
      return updated;
    });

    if (selectedWord && selectedWord.id === id) {
      setSelectedWord((prev) =>
        prev ? { ...prev, isFavorite: !prev.isFavorite } : null
      );
    }
  };

  const handleHideWord = (id: string) => {
    if (isLoading) hiddenDuringGeneration.current.add(id);
    setWords((prev) => prev.filter((w) => w.id !== id));
    if (selectedWord?.id === id) setSelectedWord(null);
  };

  // Filtered words when viewing only saved words
  const displayedWords = useMemo(() => {
    if (!showOnlySaved) return words;
    const inCloudSaved = words.filter((w) => w.isFavorite);
    if (inCloudSaved.length > 0) return inCloudSaved;
    return savedWordsList;
  }, [showOnlySaved, words, savedWordsList]);

  // Clear Board (Pizarra limpia para la clase)
  const handleClearBoard = () => {
    if (words.length === 0) return;
    ++cloudRequestId.current;
    setIsLoading(false);
    setPreviousWords([...words]);
    setWords([]);
    setSelectedWord(null);
    setCloudData((prev) =>
      prev
        ? {
            ...prev,
            title: 'Pizarra limpia',
            summary: 'La pizarra está vacía. Añade términos con tu clase o genera un nuevo campo léxico.',
            words: [],
          }
        : {
            title: 'Pizarra limpia',
            summary: 'La pizarra está vacía. Añade términos con tu clase o genera un nuevo campo léxico.',
            suggestedTopics: ['verduras', 'cocinar', 'emociones', 'ciudad'],
            challenge: 'Añade palabras de clase o genera un tema nuevo.',
            words: [],
          }
    );
  };

  const togglePresentation = (next = !isPresentationMode) => {
    withViewTransition(() => setIsPresentationMode(next));
  };

  useEffect(() => {
    if (!isPresentationMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !selectedWord && !document.querySelector('[role=dialog]')) togglePresentation(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPresentationMode, selectedWord]);

  // Restore cleared board
  const handleRestoreBoard = () => {
    if (previousWords.length > 0) {
      setWords([...previousWords]);
      setPreviousWords([]);
    }
  };

  const levelLabel = selectedLevel === 'Todos' ? 'A1—C1' : selectedLevel;
  const wordCount = String(words.length).padStart(2, '0');

  return (
    <div className="app-shell" data-presenting={isPresentationMode || undefined}>
      <header className="app-header">
        <div className="shell-row">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              fetchCloud('verduras');
            }}
            className="brand"
            title="Volver al tema inicial"
          >
            <span className="brand-mark" aria-hidden="true">N</span>
            <span className="brand-name">Nube<span>ELE</span></span>
            <span className="brand-tagline">Léxico interactivo</span>
          </a>

          <nav className="nav-actions" aria-label="Acciones">
            <button
              onClick={() => setShowOnlySaved(!showOnlySaved)}
              className="nav-link"
              title="Mostrar solo las palabras guardadas"
              aria-label="Palabras guardadas"
              aria-pressed={showOnlySaved}
            >
              <Bookmark className="nav-icon" aria-hidden="true" />
              <span className="nav-label">Guardadas</span>
              <span className="nav-count">{savedWordsList.length}</span>
            </button>

            <button
              onClick={() => setIsApiKeyModalOpen(true)}
              className="nav-link"
              title="Configurar API key de Gemini"
              aria-label="API key"
            >
              <KeyRound className="nav-icon" aria-hidden="true" />
              <span className="nav-label">API key</span>
              <span className="status-dot" data-on={hasCustomApiKey || undefined} aria-hidden="true" />
            </button>

            <button
              onClick={() => setIsExportModalOpen(true)}
              className="nav-link"
              title="Exportar vocabulario para alumnos"
              aria-label="Exportar vocabulario"
            >
              <Share className="nav-icon" aria-hidden="true" />
              <span className="nav-label">Exportar</span>
            </button>

            <button
              onClick={() => togglePresentation()}
              className="nav-primary"
              title="Modo pantalla completa para proyector o Zoom"
              aria-label={isPresentationMode ? 'Salir de pizarra' : 'Modo pizarra'}
            >
              <span className="nav-label">{isPresentationMode ? 'Salir' : 'Pizarra'}</span>
              {isPresentationMode ? <Minimize2 className="nav-icon" aria-hidden="true" /> : <Maximize2 className="nav-icon" aria-hidden="true" />}
            </button>
          </nav>
        </div>
      </header>

      <main className="workspace">
        {!isPresentationMode && (
          <section className="compose-panel" aria-labelledby="intro-title">
            <div className="intro">
              <p className="eyebrow intro-eyebrow">
                <span>N° 01</span>
                <span>Un espacio para el vocabulario</span>
              </p>
              <h1 id="intro-title" className="intro-title">
                El español, <em>en palabras.</em>
              </h1>
              <div className="intro-aside">
                <p className="intro-description">
                  Explorá, escuchá y enseñá español: una nube de léxico por tema, con fichas, voz y variantes regionales.
                </p>
                <dl className="intro-meta">
                  <div><dt>Lengua</dt><dd>ELE</dd></div>
                  <div><dt>Niveles</dt><dd>A1—C1</dd></div>
                </dl>
              </div>
            </div>

            <form onSubmit={handleSearchSubmit} className="compose-form">
              <label className="field topic-field">
                <span className="field-label">Tema</span>
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  placeholder="¿Qué querés explorar?"
                  aria-label="Tema de la nube"
                  className="topic-input"
                  enterKeyHint="go"
                />
              </label>

              <label className="field level-field">
                <span className="field-label">Nivel</span>
                <select
                  value={selectedLevel}
                  aria-label="Nivel MCER"
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="level-select"
                >
                  {LEVELS.map(level => (
                    <option key={level} value={level}>{level === 'Todos' ? 'Todos' : level}</option>
                  ))}
                </select>
              </label>

              <button type="submit" disabled={isLoading} className="generate-button" data-loading={isLoading || undefined}>
                <span>{isLoading ? 'Generando' : 'Generar'}</span>
                <ArrowRight className="generate-icon" aria-hidden="true" />
              </button>
            </form>

            <div className="topic-explorer">
              <span className="row-label">Sugerencias</span>
              <ul className="topic-list">
                {SUGGESTED_TEMPLATES.map((tmpl, index) => (
                  <li key={tmpl.query}>
                    <button
                      onClick={() => {
                        setTopicInput(tmpl.query);
                        fetchCloud(tmpl.query, selectedLevel);
                      }}
                      aria-pressed={currentTopic === tmpl.query}
                      className="topic-chip"
                    >
                      <span className="topic-index">{String(index + 1).padStart(2, '0')}</span>
                      <span>{tmpl.label}</span>
                      <span className="topic-tag">{tmpl.tag}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {errorMessage && (
          <div role="alert" className="notice">
            <span className="notice-label">Error</span>
            <span className="notice-text">{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="notice-close" aria-label="Cerrar aviso">
              <X aria-hidden="true" />
            </button>
          </div>
        )}

        <section
          data-generating={isLoading || undefined}
          aria-label="Nube de palabras interactiva"
          className={`cloud-stage ${isPresentationMode ? 'presentation-stage' : ''}`}
        >
          <header className="cloud-header">
            <div className="cloud-heading">
              <p className="eyebrow">
                <span>N° 02</span>
                <span>{isLoading ? 'Generando nube…' : `Nube · ${levelLabel}`}</span>
              </p>
              <h2 key={cloudData?.title} className="cloud-title">
                {cloudData?.title || 'Nube de palabras'}
              </h2>
              {cloudData?.summary && <p className="cloud-summary">{cloudData.summary}</p>}
            </div>

            <div className="cloud-meta">
              <span className="cloud-count" aria-label={`${words.length} palabras`}>
                <strong>{wordCount}</strong>
                <span>palabras</span>
              </span>
              <div className="cloud-actions">
                {words.length === 0 && previousWords.length > 0 ? (
                  <button onClick={handleRestoreBoard} className="text-button" title="Restaurar las palabras borradas">
                    <RotateCcw aria-hidden="true" />
                    <span>Restaurar</span>
                  </button>
                ) : (
                  <button
                    onClick={handleClearBoard}
                    disabled={words.length === 0}
                    className="text-button"
                    title="Borrar la pizarra para dejarla en blanco"
                  >
                    <span>Borrar</span>
                  </button>
                )}
                {isPresentationMode && (
                  <button onClick={() => togglePresentation(false)} className="text-button is-strong" title="Salir de la pizarra (Esc)">
                    <Minimize2 aria-hidden="true" />
                    <span>Salir</span>
                  </button>
                )}
              </div>
            </div>
          </header>

          {showOnlySaved && (
            <div className="saved-banner">
              <span>Guardadas · {String(displayedWords.length).padStart(2, '0')}</span>
              <button onClick={() => setShowOnlySaved(false)} className="text-button">
                Ver toda la nube
              </button>
            </div>
          )}

          <div className="cloud-body">
            <WordCloudCanvas
              words={displayedWords}
              palette={activePalette}
              layoutMode={layoutMode}
              onSelectWord={(w) => setSelectedWord(w)}
              selectedWord={selectedWord}
              detailState={detailState}
              onCloseSelectedWord={() => setSelectedWord(null)}
              onPrevWord={handlePrevWord}
              onNextWord={handleNextWord}
              onOpenFullDetail={() => setIsFullModalOpen(true)}
              isPresentationMode={isPresentationMode}
              onRestoreWords={handleRestoreBoard}
              hasRestorableWords={previousWords.length > 0}
              onQuickTopic={(topic) => {
                setTopicInput(topic);
                fetchCloud(topic, selectedLevel);
              }}
              onToggleFavorite={handleToggleFavorite}
            />
          </div>

          {!isPresentationMode && (
            <footer className="cloud-footer">
              <div className="footer-row">
                <span className="row-label">Ampliar</span>
                <div className="chip-row">
                  {EXPANSIONS.map(({ type, label }) => (
                    <button
                      key={type}
                      onClick={() => handleExpandCloud(type)}
                      disabled={isExpanding || isLoading}
                      className="chip"
                    >
                      <span aria-hidden="true">+</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {cloudData?.suggestedTopics && cloudData.suggestedTopics.length > 0 && (
                <div className="footer-row">
                  <span className="row-label">Relacionados</span>
                  <div className="chip-row">
                    {cloudData.suggestedTopics.slice(0, 4).map((topic) => (
                      <button
                        key={topic}
                        onClick={() => {
                          setTopicInput(topic);
                          fetchCloud(topic, selectedLevel);
                        }}
                        className="link-button"
                      >
                        <span>{topic}</span>
                        <ArrowUpRight aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </footer>
          )}
        </section>
      </main>

      <footer className="app-footer">
        <div className="shell-row">
          <span className="brand-name">Nube<span>ELE</span></span>
          <span>Español en palabras</span>
          <span className="app-footer-meta">ELE · A1—C1</span>
        </div>
      </footer>

      {isFullModalOpen && selectedWord && (
        <WordDetailModal
          key={selectedWord.id}
          word={selectedWord}
          detailState={detailState}
          onClose={() => setIsFullModalOpen(false)}
          onUpdateWeight={handleUpdateWeight}
          onToggleFavorite={handleToggleFavorite}
          onHideWord={handleHideWord}
        />
      )}

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title={cloudData?.title || currentTopic}
        words={showOnlySaved ? displayedWords : words}
      />

      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onKeyChange={(hasKey) => setHasCustomApiKey(hasKey)}
      />

      {saveToast && (
        <div key={saveToast.word + saveToast.isSaved} role="status" aria-live="polite" className="save-feedback">
          <span className="save-feedback-mark" aria-hidden="true">{saveToast.isSaved ? '+' : '−'}</span>
          <span>{saveToast.isSaved ? 'Guardada' : 'Quitada'}</span>
          <strong>{saveToast.word}</strong>
        </div>
      )}
    </div>
  );
}
