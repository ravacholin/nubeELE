import { requestWordDetails } from './utils/wordDetails';
import { requestCloud } from './utils/cloudRequests';
import { appendCloudWords, changeCloudFocus, keepSelectedWords, replaceSelectedWords, matchesCloudFocus, MAX_CLOUD_WORDS, type CloudFocus } from './utils/cloudWords';
import { readCloudSnapshot, saveCloudSnapshot } from './utils/cloudSnapshot';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { PwaControls } from './components/PwaControls';
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
  RotateCcw,
  Search,
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
  const [initialSnapshot] = useState(readCloudSnapshot);
  const isOnline = useOnlineStatus();
  const [topicInput, setTopicInput] = useState('');
  const [isSuggestOpen, setIsSuggestOpen] = useState(false);
  const [currentTopic, setCurrentTopic] = useState(initialSnapshot?.topic ?? 'verduras');
  const [selectedLevel, setSelectedLevel] = useState('Todos');

  const [cloudData, setCloudData] = useState<CloudData | null>(initialSnapshot?.cloud ?? null);
  const hiddenDuringGeneration = useRef(new Set<string>());
  const [words, setWords] = useState<WordItem[]>(initialSnapshot?.cloud.words ?? []);
  const wordsRef = useRef(words);
  wordsRef.current = words;
  const [retainedIds, setRetainedIds] = useState(new Set<string>());
  const retainedIdsRef = useRef(retainedIds);
  retainedIdsRef.current = retainedIds;
  const [isSelecting, setIsSelecting] = useState(false);
  const [cloudFocus, setCloudFocus] = useState<CloudFocus>(initialSnapshot?.focus ?? 'more');
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
    if (!isOnline) {
      setDetailError('Conecta a internet para completar esta ficha.');
      return;
    }
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
  }, [selectedWord?.id, currentTopic, detailRetry, isOnline]);

  // Warm just one likely selection after the cloud is usable, never all its cards.
  useEffect(() => {
    if (!isOnline || isLoading || selectedWord || !words.length) return;
    const first = [...words].sort((a, b) => b.weight - a.weight)[0];
    if (!first.detailsPending) return;
    const timer = setTimeout(() => {
      requestWordDetails(first, currentTopic, getApiHeaders()).catch(() => {});
    }, 1200);
    return () => clearTimeout(timer);
  }, [words, currentTopic, selectedWord?.id, isLoading, isOnline]);
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

  useEffect(() => {
    if (!cloudData || isLoading || isExpanding) return;
    saveCloudSnapshot({ version: 1, topic: currentTopic, focus: cloudFocus, cloud: { ...cloudData, words } });
  }, [cloudData, words, currentTopic, cloudFocus, isLoading, isExpanding]);

  // Fetch or generate word cloud
  const fetchCloud = useCallback(async (query: string, level = 'Todos') => {
    if (!navigator.onLine) {
      setErrorMessage('Conecta a internet para generar otra nube. Puedes seguir explorando tus palabras.');
      return;
    }
    const requestId = ++cloudRequestId.current;
    const originalWords = wordsRef.current;
    const selectedIds = new Set(retainedIdsRef.current);
    hiddenDuringGeneration.current.clear();
    const getRetained = (previous: WordItem[]) => originalWords
      .filter(word => selectedIds.has(word.id) && !hiddenDuringGeneration.current.has(word.id))
      .map(word => previous.find(current => current.id === word.id) || word);
    setIsLoading(true);
    setIsExpanding(false);
    setErrorMessage(null);
    setSelectedWord(null);

    let receivedProgress = false;
    const applyCloud = (data: CloudData | null) => {
      if (requestId !== cloudRequestId.current) return;
      if (!data) {
        if (receivedProgress) { setWords(previous => getRetained(previous)); setCloudData(null); setSelectedWord(null); }
        return;
      }
      receivedProgress = true;
      setCloudData(data);
      setCurrentTopic(query);
      setCloudFocus('more');
      setWords(previous => keepSelectedWords(getRetained(previous), data.words.filter(w => !hiddenDuringGeneration.current.has(w.id)).map(w => {
        const existing = previous.find(item => item.id === w.id);
        return {
          ...w,
          ...existing,
          isFavorite: isWordSaved(w.id) || isWordSaved(w.lemma || w.word) || !!w.isFavorite,
        };
      }), selectedIds));
    };
    try {
      const data = await requestCloud(query, level, getApiHeaders(), applyCloud);
      applyCloud(data);
    } catch (err: any) {
      if (requestId !== cloudRequestId.current) return;
      if (receivedProgress) { setWords(previous => getRetained(previous)); setCloudData(null); setSelectedWord(null); }
      console.error(err);
      setErrorMessage(err.message || 'No se pudo generar la nube. Intenta de nuevo.');
    } finally {
      if (requestId === cloudRequestId.current) setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (initialSnapshot) return;
    if (!navigator.onLine) { setShowOnlySaved(true); return; }
    fetchCloud('verduras');
  }, [fetchCloud, initialSnapshot]);

  // Handle Form Submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicInput.trim()) return;
    fetchCloud(topicInput.trim(), selectedLevel);
  };

  // Change the cloud's focus, add coherent alternatives, or renew selected slots.
  const handleExpandCloud = async (type: CloudFocus, regenerate = false) => {
    if (isExpanding || isLoading || (regenerate && !retainedIds.size)) return;
    if (!navigator.onLine) {
      setErrorMessage('Conecta a internet para renovar el vocabulario.');
      return;
    }
    const requestId = cloudRequestId.current;
    const selection = new Set(retainedIds);
    const focus = type === 'more' ? cloudFocus : type;
    setIsExpanding(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/expand-cloud', {
        method: 'POST',
        headers: getApiHeaders(),
        body: JSON.stringify({
          topic: currentTopic,
          existingWords: words.map(word => word.lemma || word.word),
          expansionType: focus,
          ...(regenerate ? {
            wordCount: selection.size,
            replacementWords: words.filter(word => selection.has(word.id)).map(word => word.lemma || word.word),
          } : {}),
        }),
      });
      const data = await res.json();
      if (requestId !== cloudRequestId.current) return;
      if (!res.ok || !data.success || !Array.isArray(data.newWords)) {
        throw new Error(data.error || 'No se pudo renovar la nube.');
      }
      const additions = (data.newWords as WordItem[]).filter(word => matchesCloudFocus(word, focus));
      const update = (current: WordItem[]) => regenerate
        ? replaceSelectedWords(current, additions, selection)
        : type === 'more'
          ? appendCloudWords(current, additions, selection)
          : changeCloudFocus(current, additions, focus, selection);
      const next = update(words);
      const changingFocus = !regenerate && type !== 'more' && focus !== cloudFocus;
      if (!changingFocus && (!next.length || (next.length === words.length && next.every((word, index) => word.id === words[index].id)))) {
        setErrorMessage('No hay alternativas nuevas para este tema y enfoque. Se mantienen las palabras actuales.');
        return;
      }
      if (changingFocus && !next.length) {
        setErrorMessage('No hay términos disponibles para este enfoque y tema. Puedes buscar otro tema o elegir otro enfoque.');
      }
      if (regenerate) {
        const renewed = words.filter((word, index) => selection.has(word.id) && next[index]?.id !== word.id).length;
        if (renewed < selection.size) {
          setErrorMessage(`Se renovaron ${renewed} de ${selection.size} palabras. Las demás se mantienen porque no hay más alternativas disponibles.`);
        }
      } else {
        setCloudFocus(focus);
      }
      setWords(update);
    } catch (err: any) {
      if (requestId !== cloudRequestId.current) return;
      setErrorMessage(err.message || 'No se pudo renovar la nube. Las palabras se mantienen.');
    } finally {
      if (requestId === cloudRequestId.current) setIsExpanding(false);
    }
  };

  const handleToggleSelection = (id: string) => {
    if (isLoading || isExpanding || showOnlySaved) return;
    setRetainedIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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

  // A word's card closes when that word leaves the visible cloud.
  useEffect(() => {
    if (selectedWord && !displayedWords.some(word => word.id === selectedWord.id)) {
      setSelectedWord(null);
      setIsFullModalOpen(false);
    }
  }, [displayedWords, selectedWord?.id]);

  useEffect(() => {
    setRetainedIds(previous => {
      const next = new Set([...previous].filter(id => words.some(word => word.id === id)));
      return next.size === previous.size ? previous : next;
    });
  }, [words]);

  // Clear Board (Pizarra limpia para la clase)
  const handleClearBoard = () => {
    if (words.length === 0) return;
    ++cloudRequestId.current;
    setIsLoading(false);
    setIsExpanding(false);
    setPreviousWords([...words]);
    setWords([]);
    setRetainedIds(new Set());
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

  // Notices are transient: they leave on their own.
  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  // "/" jumps to the topic field from anywhere, like a command palette.
  const topicInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable=true], [role=dialog]')) return;
      event.preventDefault();
      topicInputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Restore cleared board
  const handleRestoreBoard = () => {
    if (previousWords.length > 0) {
      setWords([...previousWords]);
      setPreviousWords([]);
    }
  };

  const levelLabel = selectedLevel === 'Todos' ? 'A1—C1' : selectedLevel;
  const runTopic = (topic: string) => {
    setTopicInput(topic);
    setIsSuggestOpen(false);
    fetchCloud(topic, selectedLevel);
  };

  return (
    <div className="app-shell" data-presenting={isPresentationMode || undefined}>
      <header className="app-header">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            fetchCloud('verduras');
          }}
          className="brand"
          title="Volver al tema inicial"
        >
          <img className="brand-mark" src="/brand/nubeele-mark.svg" width="20" height="20" alt="" aria-hidden="true" />
          <span className="brand-name">Nube<span>ELE</span></span>
        </a>

        <form onSubmit={handleSearchSubmit} className="command-bar" role="search">
          <div className="command-field">
            <Search className="command-icon" aria-hidden="true" />
            <input
              ref={topicInputRef}
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onFocus={() => setIsSuggestOpen(true)}
              onBlur={() => setIsSuggestOpen(false)}
              onKeyDown={(e) => { if (e.key === 'Escape') { setIsSuggestOpen(false); e.currentTarget.blur(); } }}
              placeholder="Tema de vocabulario…"
              aria-label="Tema de la nube"
              aria-expanded={isSuggestOpen}
              aria-controls="topic-suggestions"
              aria-keyshortcuts="/"
              className="topic-input"
              enterKeyHint="go"
              autoComplete="off"
            />
            {!topicInput && !isSuggestOpen && <kbd className="command-kbd" aria-hidden="true">/</kbd>}
            {isSuggestOpen && (
              <ul id="topic-suggestions" className="suggest-panel" role="listbox" aria-label="Temas sugeridos">
                {SUGGESTED_TEMPLATES.map((tmpl, index) => (
                  <li key={tmpl.query} role="option" aria-selected={currentTopic === tmpl.query}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => runTopic(tmpl.query)}
                      className="suggest-item"
                    >
                      <span className="suggest-index">{String(index + 1).padStart(2, '0')}</span>
                      <span className="suggest-label">{tmpl.label}</span>
                      <span className="suggest-tag">{tmpl.tag}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <select
            value={selectedLevel}
            aria-label="Nivel MCER"
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="level-select"
          >
            {LEVELS.map(level => (
              <option key={level} value={level}>{level === 'Todos' ? 'A1—C1' : level}</option>
            ))}
          </select>

          <button type="submit" disabled={isLoading || !isOnline} className="generate-button" data-loading={isLoading || undefined} aria-label="Generar nube">
            <span className="generate-label">{isLoading ? 'Generando' : 'Generar'}</span>
            <ArrowRight className="generate-icon" aria-hidden="true" />
          </button>
        </form>

        <nav className="nav-actions" aria-label="Acciones">
          <PwaControls isOnline={isOnline} />
          <button
            onClick={() => setShowOnlySaved(!showOnlySaved)}
            className="nav-link"
            title="Mostrar solo las palabras guardadas"
            aria-label="Palabras guardadas"
            aria-pressed={showOnlySaved}
          >
            <Bookmark className="nav-icon" aria-hidden="true" />
            <span className="nav-count">{savedWordsList.length}</span>
          </button>
          <button
            onClick={() => setIsApiKeyModalOpen(true)}
            className="nav-link"
            title="Configurar API key de Gemini"
            aria-label="API key"
          >
            <KeyRound className="nav-icon" aria-hidden="true" />
            <span className="status-dot" data-on={hasCustomApiKey || undefined} aria-hidden="true" />
          </button>
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="nav-link"
            title="Exportar vocabulario para alumnos"
            aria-label="Exportar vocabulario"
          >
            <Share className="nav-icon" aria-hidden="true" />
          </button>
          <button
            onClick={() => togglePresentation()}
            className="nav-link"
            title="Pizarra: pantalla completa para proyector o Zoom"
            aria-label={isPresentationMode ? 'Salir de pizarra' : 'Modo pizarra'}
          >
            <Maximize2 className="nav-icon" aria-hidden="true" />
          </button>
        </nav>
      </header>

      <main
        data-generating={isLoading || undefined}
        aria-label="Nube de palabras interactiva"
        className={`cloud-stage ${isPresentationMode ? 'presentation-stage' : ''}`}
      >
        {isSelecting || retainedIds.size > 0 ? (
          <div className="selection-bar" aria-label="Selección de palabras">
            <span role="status">{retainedIds.size ? `${retainedIds.size} seleccionadas · se conservan al buscar otro tema` : 'Selecciona las palabras que quieres conservar o renovar'}</span>
            <button className="bar-button" onClick={() => handleExpandCloud('more', true)} disabled={!retainedIds.size || isLoading || isExpanding || !isOnline}>
              <RotateCcw aria-hidden="true" /> Regenerar selección
            </button>
            <button className="bar-button" onClick={() => { setRetainedIds(new Set()); setIsSelecting(false); }} disabled={isLoading || isExpanding}>Deseleccionar</button>
          </div>
        ) : null}
        {errorMessage && (
          <div role="alert" className="notice">
            <span className="notice-text">{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="notice-close" aria-label="Cerrar aviso">
              <X aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="cloud-body">
          <div className="cloud-caption">
            <h1 key={cloudData?.title} className="cloud-title">
              {cloudData?.title || 'Nube de palabras'}
            </h1>
            <span
              className="cloud-count"
              aria-label={`${displayedWords.length} palabras`}
              title={showOnlySaved ? undefined : `Hasta ${MAX_CLOUD_WORDS} términos. Al añadir nuevos, salen los más antiguos.`}
            >
              {String(displayedWords.length).padStart(2, '0')}
            </span>
            <span className="cloud-level">{isLoading ? 'Generando…' : isExpanding ? 'Renovando…' : showOnlySaved ? 'Guardadas' : cloudFocus === 'more' ? levelLabel : EXPANSIONS.find(item => item.type === cloudFocus)?.label}</span>
            {showOnlySaved && (
              <button onClick={() => setShowOnlySaved(false)} className="caption-link">Ver toda la nube</button>
            )}
            {isPresentationMode && (
              <button onClick={() => togglePresentation(false)} className="caption-link" title="Salir de la pizarra (Esc)">
                Salir
              </button>
            )}
          </div>

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
            onQuickTopic={runTopic}
            onToggleFavorite={handleToggleFavorite}
            isSelecting={isSelecting && !showOnlySaved}
            retainedIds={retainedIds}
            selectionDisabled={isLoading || isExpanding || showOnlySaved}
            onToggleSelectionMode={() => setIsSelecting(previous => !previous)}
            onToggleSelection={handleToggleSelection}
          />
        </div>

        {!isPresentationMode && (
          <footer className="cloud-footer">
            <div className="footer-group">
              <span className="row-label">Explorar</span>
              {EXPANSIONS.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => handleExpandCloud(type)}
                  disabled={isExpanding || isLoading || !isOnline}
                  className="bar-button"
                  aria-pressed={type === cloudFocus && type !== 'more'}
                  title={type === 'more' ? 'Añadir palabras del enfoque actual' : 'Cambiar la nube a este enfoque'}
                >
                  <span aria-hidden="true">{type === 'more' ? '+' : '↗'}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {cloudData?.suggestedTopics && cloudData.suggestedTopics.length > 0 && (
              <div className="footer-group">
                <span className="row-label">Relacionados</span>
                {cloudData.suggestedTopics.slice(0, 4).map((topic) => (
                  <button key={topic} onClick={() => runTopic(topic)} className="bar-button is-link">
                    <span>{topic}</span>
                    <ArrowUpRight aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}

            <div className="footer-group is-end">
              {words.length === 0 && previousWords.length > 0 ? (
                <button onClick={handleRestoreBoard} className="bar-button" title="Restaurar las palabras borradas">
                  <RotateCcw aria-hidden="true" />
                  <span>Restaurar</span>
                </button>
              ) : (
                <button
                  onClick={handleClearBoard}
                  disabled={words.length === 0}
                  className="bar-button"
                  title="Borrar la pizarra para dejarla en blanco"
                >
                  <span>Borrar</span>
                </button>
              )}
            </div>
          </footer>
        )}
      </main>

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
