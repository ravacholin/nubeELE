import { requestCloud } from './utils/cloudRequests';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
} from './utils/savedWordsStorage';
import {
  Search,
  Plus,
  Maximize2,
  Minimize2,
  Share2,
  RotateCw,
  RotateCcw,
  Eraser,
  Zap,
  Flame,
  Layers,
  Sparkles,
  KeyRound,
  BookmarkCheck,
  Check,
} from 'lucide-react';

const SUGGESTED_TEMPLATES = [
  { label: 'Verduras & Huerto', query: 'verduras y hortalizas', tag: 'A1-A2' },
  { label: 'Verbos de Cocción', query: 'verbos de coccion y tecnicas culinarias', tag: 'B1' },
  { label: 'Emociones & Estados', query: 'emociones y sentimientos', tag: 'B1-B2' },
  { label: 'Ciudad & Barrio', query: 'lugares de la ciudad y el barrio', tag: 'A2' },
  { label: 'Viajes & Estaciones', query: 'viajes, trenes y aeropuertos', tag: 'B1' },
  { label: 'Coloquialismos', query: 'expresiones coloquiales y modismos', tag: 'B2-C1' },
];

export default function App() {
  const cloudRequestId = useRef(0);
  const [topicInput, setTopicInput] = useState('');
  const [currentTopic, setCurrentTopic] = useState('verduras');
  const [selectedLevel, setSelectedLevel] = useState('Todos');

  const [cloudData, setCloudData] = useState<CloudData | null>(null);
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
    setIsLoading(true);
    setErrorMessage(null);
    setSelectedWord(null);

    try {
      const data = await requestCloud(query, level, getApiHeaders());
      if (requestId !== cloudRequestId.current) return;
      setCloudData(data);
      setCurrentTopic(query);
      const enrichedWords = data.words.map((w) => ({
        ...w,
        isFavorite: isWordSaved(w.id) || isWordSaved(w.lemma || w.word) || !!w.isFavorite,
      }));
      setWords(enrichedWords);
    } catch (err: any) {
      if (requestId !== cloudRequestId.current) return;
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
    if (isExpanding) return;
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
      if (data.success && Array.isArray(data.newWords)) {
        setWords((prev) => [...prev, ...data.newWords]);
      } else {
        throw new Error(data.error || 'No se pudieron añadir palabras');
      }
    } catch (err: any) {
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

  // Restore cleared board
  const handleRestoreBoard = () => {
    if (previousWords.length > 0) {
      setWords([...previousWords]);
      setPreviousWords([]);
    }
  };

  return (
    <div className={`app-shell min-h-screen flex flex-col font-sans text-[#f4f4f5] transition-colors duration-300 ${activePalette.bgClass} selection:bg-white selection:text-black`}>
      {/* 1. TOP BAR - Minimalist Brutalist Dark */}
      <header className="app-header sticky top-0 z-40 bg-[#0c0c0c]/95 backdrop-blur-md border-b border-[#27272a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          {/* Zone 1: Minimalist Brutalist Brand */}
          <div className="flex items-center gap-3">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                fetchCloud('verduras');
              }}
              className="group flex items-center gap-2.5 text-sm tracking-tight text-white hover:text-white"
              title="Reiniciar con tema por defecto"
            >
              <span className="w-5 h-5 bg-white text-black font-black font-mono text-[11px] flex items-center justify-center tracking-tighter">
                N
              </span>
              <span className="font-bold uppercase tracking-wider text-sm font-mono text-zinc-100">
                NubeELE
              </span>
              <span className="hidden sm:inline-block w-px h-3.5 bg-zinc-800" />
              <span className="hidden sm:inline-block text-[11px] font-mono uppercase tracking-widest text-zinc-400">
                Léxico interactivo
              </span>
            </a>
          </div>

          {/* Primary Actions (Sharp Brutalist Buttons) */}
          <div className="nav-actions flex items-center gap-2">
            {/* Guardadas filter button */}
            <button
              onClick={() => setShowOnlySaved(!showOnlySaved)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 border text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                showOnlySaved
                  ? 'bg-zinc-400 text-black border-zinc-400 font-bold'
                  : 'bg-[#1c1c1c] hover:bg-zinc-800 text-zinc-300 border-[#27272a]'
              }`}
              title="Filtrar palabras guardadas con el icono de +"
              aria-label="Palabras guardadas"
              aria-pressed={showOnlySaved}
            >
              <BookmarkCheck className={`w-3.5 h-3.5 ${showOnlySaved ? 'text-black' : 'text-zinc-400'}`} />
              <span className="hidden sm:inline">Guardadas</span>
              <span>({savedWordsList.length})</span>
            </button>

            {/* Gemini API key */}
            <button
              onClick={() => setIsApiKeyModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 border text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                hasCustomApiKey
                  ? 'bg-zinc-950/40 hover:bg-zinc-900/60 text-zinc-300 border-zinc-700/80'
                  : 'bg-[#1c1c1c] hover:bg-zinc-800 text-zinc-300 border-[#27272a]'
              }`}
              title="Configurar API key de Gemini"
              aria-label="API key"
            >
              <KeyRound className="hidden sm:block w-3.5 h-3.5 text-zinc-400" />
              <span className="whitespace-nowrap">API key</span>
            </button>

            <button
              onClick={() => setIsExportModalOpen(true)}
              className="p-1.5 bg-[#1c1c1c] hover:bg-zinc-800 text-zinc-300 hover:text-white border border-[#27272a] text-xs transition-colors cursor-pointer"
              title="Exportar vocabulario para alumnos"
              aria-label="Exportar vocabulario"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsPresentationMode(!isPresentationMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition-all cursor-pointer border ${
                isPresentationMode
                  ? 'bg-zinc-400 text-black border-zinc-400 font-bold'
                  : 'bg-white text-black hover:bg-zinc-200 border-white font-semibold'
              }`}
              title="Modo pantalla completa para proyector o Zoom"
              aria-label={isPresentationMode ? 'Salir de pizarra' : 'Modo pizarra'}
            >
              {isPresentationMode ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Salir</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Pizarra</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="workspace flex-1 max-w-7xl w-full mx-auto">
        {/* Dynamic Topic Generator Bar - Minimalist Brutalist Hero */}
        {!isPresentationMode && (
          <section className="compose-panel">
            <div className="intro-heading">
              <div>
                <h1 className="intro-title">
                  Nubes de palabras.
                </h1>
                <p className="intro-description">
                  Español para explorar, escuchar y enseñar.
                </p>
              </div>

              <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                <span>ELE · A1—C1</span>
              </div>
            </div>

            {/* Search and level filter */}
            <form onSubmit={handleSearchSubmit} className="compose-form">
              <div className="topic-field relative">
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  placeholder="¿Qué tema querés explorar?"
                  aria-label="Tema de la nube"
                  className="topic-input w-full pl-10 pr-4 py-2 sm:py-2.5 bg-[#181818] hover:bg-[#202020] focus:bg-[#181818] border border-[#27272a] text-sm text-white placeholder:text-zinc-400 focus:outline-hidden focus:border-white transition-all font-mono"
                />
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>

              {/* Level Filter */}
              <select
                value={selectedLevel}
                aria-label="Nivel MCER"
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="level-select px-3 py-2 sm:py-2.5 bg-[#181818] border border-[#27272a] text-xs font-mono uppercase tracking-wider text-zinc-200 focus:outline-hidden focus:border-white cursor-pointer"
              >
                <option value="Todos">Niveles: Todos</option>
                <option value="A1">Nivel A1</option>
                <option value="A2">Nivel A2</option>
                <option value="B1">Nivel B1</option>
                <option value="B2">Nivel B2</option>
                <option value="C1">Nivel C1</option>
              </select>

              {/* Generate Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="generate-button flex items-center justify-center gap-2 px-5 sm:px-6 py-2 sm:py-2.5 bg-white hover:bg-zinc-200 disabled:bg-zinc-700 text-black rounded-none text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0"
              >
                {isLoading ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin text-black" />
                    <span>Generando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-black" />
                    <span>Generar nube</span>
                  </>
                )}
              </button>
            </form>

            <details className="topic-explorer text-xs font-mono text-zinc-400">
              <summary className="cursor-pointer hover:text-white py-1">Explorar temas</summary>
            <div className="flex flex-wrap gap-2 pt-3">
              {SUGGESTED_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.query}
                  onClick={() => {
                    setTopicInput(tmpl.query);
                    fetchCloud(tmpl.query, selectedLevel);
                  }}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 text-xs font-mono uppercase tracking-wider border transition-all cursor-pointer shrink-0 ${
                    currentTopic === tmpl.query
                      ? 'bg-white text-black border-white font-bold'
                      : 'bg-[#181818] text-zinc-300 border-[#27272a] hover:border-zinc-500 hover:text-white'
                  }`}
                >
                  <span>{tmpl.label}</span>
                  <span className="text-[10px] text-zinc-400 font-sans opacity-70">[{tmpl.tag}]</span>
                </button>
              ))}
            </div>
            </details>

          </section>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-4 bg-rose-950/40 border border-rose-800 text-xs font-mono text-rose-300 flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-white hover:underline uppercase text-[11px] font-bold cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Word Cloud Visual Stage Container - Brutalist Frame */}
        <section className={`cloud-stage bg-[#111111] border border-[#27272a] overflow-hidden flex flex-col transition-all ${
          isPresentationMode ? 'presentation-stage fixed inset-0 z-50 rounded-none border-none' : ''
        }`}>
          {/* Cloud Header / Toolbar */}
          <div className="cloud-header px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[#282828] bg-[#141414] flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="cloud-title text-white">
                  {cloudData?.title || 'Nube de palabras'}
                </h2>
                <span className="cloud-count text-xs text-zinc-400 font-mono">
                  {String(words.length).padStart(2, '0')}
                </span>
              </div>
              {cloudData?.summary && (
                <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1 max-w-xl font-sans">
                  {cloudData.summary}
                </p>
              )}
            </div>

            {/* Stage controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">

              {/* Borrar pizarra button */}
              <button
                onClick={handleClearBoard}
                disabled={words.length === 0}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-mono uppercase tracking-wider border transition-all ${
                  words.length === 0
                    ? 'opacity-30 cursor-not-allowed bg-[#1c1c1c] border-[#27272a] text-zinc-600'
                    : 'bg-[#1c1c1c] hover:bg-rose-950/60 hover:border-rose-700 hover:text-rose-300 border-[#27272a] text-zinc-300 cursor-pointer'
                }`}
                title="Borrar la pizarra para dejarla en blanco"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Borrar</span>
              </button>

              {/* Restaurar pizarra button */}
              {words.length === 0 && previousWords.length > 0 && (
                <button
                  onClick={handleRestoreBoard}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-white text-black border border-white text-xs font-mono uppercase tracking-wider font-bold transition-all cursor-pointer"
                  title="Restaurar las palabras borradas"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-black" />
                  <span>Restaurar ({previousWords.length})</span>
                </button>
              )}

              {/* Presentation Exit Button if in presentation mode */}
              {isPresentationMode && (
                <button
                  onClick={() => setIsPresentationMode(false)}
                  className="flex items-center gap-1 px-3 py-1 bg-white text-black text-xs font-mono uppercase font-bold cursor-pointer"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Salir</span>
                </button>
              )}
            </div>
          </div>

          {/* Interactive Word Cloud Visual Canvas */}
          {showOnlySaved && (
            <div className="px-4 py-2 bg-zinc-950/70 border-b border-zinc-700/80 flex items-center justify-between text-xs font-mono text-zinc-300">
              <div className="flex items-center gap-2">
                <BookmarkCheck className="w-4 h-4 text-zinc-400" />
                <span>Mostrando palabras guardadas con el icono de + ({displayedWords.length})</span>
              </div>
              <button
                onClick={() => setShowOnlySaved(false)}
                className="text-zinc-400 hover:text-white underline cursor-pointer text-[11px] uppercase"
              >
                Ver toda la nube
              </button>
            </div>
          )}

          <div className="cloud-body flex-1 relative min-h-[460px] sm:min-h-[540px]">
            <WordCloudCanvas
              words={displayedWords}
              palette={activePalette}
              layoutMode={layoutMode}
              onSelectWord={(w) => setSelectedWord(w)}
              selectedWord={selectedWord}
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

          {/* Cloud Footer Actions: Expand vocabulary */}
          {!isPresentationMode && (
            <div className="cloud-footer px-3 sm:px-5 py-2.5 sm:py-3 border-t border-[#282828] bg-[#141414] flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 text-xs font-mono">
              <details className="min-w-0">
                <summary className="cursor-pointer text-zinc-400 hover:text-white py-1">Ampliar nube</summary>
                <div className="flex flex-wrap gap-2 pt-3">
                <button
                  onClick={() => handleExpandCloud('more')}
                  disabled={isExpanding}
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#1c1c1c] hover:bg-zinc-800 border border-[#27272a] text-zinc-300 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3 text-zinc-400" />
                  <span>Más palabras</span>
                </button>
                <button
                  onClick={() => handleExpandCloud('advanced')}
                  disabled={isExpanding}
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#1c1c1c] hover:bg-zinc-800 border border-[#27272a] text-zinc-300 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Layers className="w-3 h-3 text-zinc-400" />
                  <span>Avanzado (B2-C1)</span>
                </button>
                <button
                  onClick={() => handleExpandCloud('verbs')}
                  disabled={isExpanding}
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#1c1c1c] hover:bg-zinc-800 border border-[#27272a] text-zinc-300 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Flame className="w-3 h-3 text-zinc-400" />
                  <span>Verbos</span>
                </button>
                <button
                  onClick={() => handleExpandCloud('expressions')}
                  disabled={isExpanding}
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#1c1c1c] hover:bg-zinc-800 border border-[#27272a] text-zinc-300 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Zap className="w-3 h-3 text-zinc-400" />
                  <span>Expresiones</span>
                </button>
                </div>
              </details>

              {/* Related Topic tags */}
              {cloudData?.suggestedTopics && cloudData.suggestedTopics.length > 0 && (
                <details className="min-w-0 text-zinc-400 text-[11px]">
                  <summary className="cursor-pointer hover:text-white py-1">Temas relacionados</summary>
                  <div className="flex flex-wrap items-center gap-2 pt-3">
                    {cloudData.suggestedTopics.slice(0, 4).map((topic, i) => (
                      <React.Fragment key={topic}>
                        <button
                          onClick={() => {
                            setTopicInput(topic);
                            fetchCloud(topic, selectedLevel);
                          }}
                          className="hover:text-white uppercase transition-colors cursor-pointer underline underline-offset-4 decoration-zinc-700 hover:decoration-white"
                        >
                          {topic}
                        </button>
                        {i < 3 && <span className="text-zinc-600">/</span>}
                      </React.Fragment>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </section>

      </main>

      {/* FOOTER - Minimalist Brutalist */}
      <footer className="app-footer mt-auto border-t border-[#282828] bg-[#0c0c0c] py-4 text-xs font-mono text-zinc-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white uppercase tracking-wider">NubeELE</span>
            <span className="text-zinc-700">|</span>
            <span>Español en palabras</span>
          </div>

        </div>
      </footer>

      {/* Full Word Detail Drawer / Modal */}
      {isFullModalOpen && selectedWord && (
        <WordDetailModal
          word={selectedWord}
          onClose={() => setIsFullModalOpen(false)}
          onUpdateWeight={handleUpdateWeight}
          onToggleFavorite={handleToggleFavorite}
          onHideWord={handleHideWord}
        />
      )}

      {/* Export Vocabulary Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title={cloudData?.title || currentTopic}
        words={showOnlySaved ? displayedWords : words}
      />

      {/* Gemini API Key Instructional & Management Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onKeyChange={(hasKey) => setHasCustomApiKey(hasKey)}
      />

      {/* Floating Save Toast Notification */}
      {saveToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-[#151515] border-2 border-zinc-500 shadow-2xl text-xs font-mono text-zinc-100 rounded-none pointer-events-none transition-all"
        >
          {saveToast.isSaved ? (
            <Check className="w-4 h-4 text-zinc-400 shrink-0" />
          ) : (
            <BookmarkCheck className="w-4 h-4 text-zinc-400 shrink-0" />
          )}
          <span>
            {saveToast.text}: <strong className="text-zinc-300 uppercase">«{saveToast.word}»</strong>
          </span>
        </div>
      )}
    </div>
  );
}
