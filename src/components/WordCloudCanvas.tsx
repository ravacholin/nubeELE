import { packCloudBoxes } from '../utils/cloudLayout';
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { WordItem, LayoutMode, ColorPalette } from '../types';
import {
  playSpanishSpeech,
  prefetchSpanishAudio,
  setPreferredVoice,
  getPreferredVoice,
} from '../utils/audio';
import { getValidArticle, cleanDisplayWord } from '../utils/grammar';
import {
  Volume2,
  VolumeX,
  GripHorizontal,
  Plus,
  Check,
  RotateCcw,
  Sparkles,
  Shuffle,
  Activity,
} from 'lucide-react';
import { InteractiveWordCard } from './InteractiveWordCard';

interface WordCloudCanvasProps {
  words: WordItem[];
  palette: ColorPalette;
  layoutMode: LayoutMode;
  onSelectWord: (word: WordItem) => void;
  selectedWord: WordItem | null;
  onCloseSelectedWord: () => void;
  onPrevWord: () => void;
  onNextWord: () => void;
  onOpenFullDetail: () => void;
  isPresentationMode?: boolean;
  onRestoreWords?: () => void;
  hasRestorableWords?: boolean;
  onQuickTopic?: (topic: string) => void;
  onToggleFavorite?: (id: string) => void;
}

interface PhysicsNode {
  id: string;
  word: WordItem;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  phase: number;
  floatFreq: number;
  isDragging?: boolean;
}

export const WordCloudCanvas: React.FC<WordCloudCanvasProps> = ({
  words,
  palette,
  layoutMode,
  onSelectWord,
  selectedWord,
  onCloseSelectedWord,
  onPrevWord,
  onNextWord,
  onOpenFullDetail,
  isPresentationMode = false,
  onRestoreWords,
  hasRestorableWords = false,
  onQuickTopic,
  onToggleFavorite,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 960, height: 600 });
  const [layoutHeight, setLayoutHeight] = useState(480);
  const [hoveredWordId, setHoveredWordId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<PhysicsNode[]>([]);
  const [playingWordId, setPlayingWordId] = useState<string | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const draggingNodeRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const nodesRef = useRef<PhysicsNode[]>([]);
  nodesRef.current = nodes;

  // Mobile visual display mode: 'canvas' (floating/spiral physics) or 'mosaico' (flow tag cloud cluster)
  const [mobileViewStyle, setMobileViewStyle] = useState<'canvas' | 'mosaico'>('canvas');

  // Measure container dimensions (accurately respect mobile screen width)
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { clientWidth } = containerRef.current;
        const isMobileScreen = clientWidth > 0 && clientWidth < 640;
        setDimensions({
          width: Math.max(clientWidth || 360, 280),
          height: isPresentationMode ? Math.max(window.innerHeight - 96, 480) : isMobileScreen ? 480 : 600,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [isPresentationMode, words.length, mobileViewStyle]);

  // Prefetch audio in background whenever words update
  useEffect(() => {
    if (words.length > 0) {
      prefetchSpanishAudio(words.map((w) => w.word));
    }
  }, [words]);

  // Compute font size based on weight (1 to 5) with dedicated mobile scaling
  const getFontSize = useCallback(
    (weight: number, isMobile: boolean) => {
      if (isPresentationMode && !isMobile) {
        switch (weight) {
          case 5: return 52;
          case 4: return 42;
          case 3: return 32;
          case 2: return 24;
          case 1: default: return 18;
        }
      }
      if (isMobile) {
        // Clear, readable, perfectly proportioned scale for mobile phones (320px - 480px)
        switch (weight) {
          case 5: return 20;
          case 4: return 17;
          case 3: return 15;
          case 2: return 13;
          case 1: default: return 12;
        }
      }
      // Desktop standard
      switch (weight) {
        case 5: return 42;
        case 4: return 32;
        case 3: return 24;
        case 2: return 19;
        case 1: default: return 15;
      }
    },
    [isPresentationMode]
  );

  // Estimate node dimensions accurately for non-overlapping bounding boxes
  const estimateDimensions = useCallback(
    (word: WordItem, fontSize: number) => {
      const displayWord = cleanDisplayWord(word.lemma || word.word);
      const article = getValidArticle(word.category, word.article);
      const isMobile = dimensions.width < 640;
      // Match the fixed tag box: monospace text, smaller article and horizontal padding.
      // Actions live outside the box so hovering never changes the cloud layout.
      const wordWidth = displayWord.length * fontSize * 0.61;
      const articleWidth = article ? article.length * fontSize * 0.62 * 0.61 + 6 : 0;
      const estimatedWidth = Math.ceil(wordWidth + articleWidth + (isMobile ? 14 : 22));
      const estimatedHeight = Math.max(44, Math.ceil(fontSize + 20));

      return { estimatedWidth, estimatedHeight };
    },
    [dimensions.width]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedWord) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNextWord();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrevWord();
      } else if (e.key === 'Escape') {
        onCloseSelectedWord();
      } else if (e.key === ' ') {
        e.preventDefault();
        handlePronounce(selectedWord.word, selectedWord.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedWord, onNextWord, onPrevWord, onCloseSelectedWord]);

  // Non-overlapping initial placement algorithm (Archimedean Packing)
  const layoutNodesCollisionFree = useCallback(
    (currentWords: WordItem[], forceMode?: LayoutMode): PhysicsNode[] => {
      const { width, height } = dimensions;
      const isMobile = width < 640;
      const sortedWords = [...currentWords].sort((a, b) => b.weight - a.weight);
      const boxes = sortedWords.map(word => {
        let fontSize = getFontSize(word.weight, isMobile);
        const maxWidth = width - 40;
        while (estimateDimensions(word, fontSize).estimatedWidth > maxWidth) fontSize *= 0.95;
        const { estimatedWidth, estimatedHeight } = estimateDimensions(word, fontSize);
        return { width: estimatedWidth, height: estimatedHeight, fontSize };
      });
      const packed = packCloudBoxes(boxes, width, height, forceMode === 'spiral' ? 0 : Math.random() * Math.PI * 2);
      setLayoutHeight(packed.height);
      return sortedWords.map((w, index) => {
        const { x: finalX, y: finalY } = packed.positions[index];
        const { width: estimatedWidth, height: estimatedHeight, fontSize } = boxes[index];
        const colors = palette.textColors;
        const color = colors[index % colors.length];

        return {
          id: w.id,
          word: w,
          x: finalX,
          y: finalY,
          targetX: finalX,
          targetY: finalY,
          vx: 0,
          vy: 0,
          width: estimatedWidth,
          height: estimatedHeight,
          fontSize,
          color,
          phase: Math.random() * Math.PI * 2,
          floatFreq: 0.0009 + (index % 5) * 0.0003,
        };
      });

    },
    [dimensions, layoutMode, getFontSize, estimateDimensions, palette]
  );

  // Initialize or re-layout nodes when words, layout mode, or dimensions change
  useEffect(() => {
    const newNodes = layoutNodesCollisionFree(words);
    setNodes(newNodes);
  }, [words, layoutMode, dimensions.width, dimensions.height, layoutNodesCollisionFree]);

  // Keep resting tags still and separate their bounding boxes during dragging.
  useEffect(() => {
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.035);
      lastTime = now;

      setNodes((prevNodes) => {
        if (!prevNodes.length) return prevNodes;

        const currentMouse = mousePosRef.current;
        const dragging = draggingNodeRef.current;

        return prevNodes.map((node, i) => {
          // If node is currently being dragged
          if (dragging && dragging.id === node.id && currentMouse) {
            const nextX = currentMouse.x - dragging.offsetX;
            const nextY = currentMouse.y - dragging.offsetY;
            return {
              ...node,
              x: nextX,
              y: nextY,
              targetX: nextX,
              targetY: nextY,
              vx: 0,
              vy: 0,
              isDragging: true,
            };
          }

          // Gentle spring force toward equilibrium target
          const kSpring = 1.4;
          const kDamping = 0.86;

          let fx = (node.targetX - node.x) * kSpring;
          let fy = (node.targetY - node.y) * kSpring;

          // Keep the resting layout calm; movement is reserved for dragging and rearranging.

          // Strict Rectangular 2D AABB Collision Separation
          // Guarantees words NEVER overlap horizontally or vertically
          for (let j = 0; j < prevNodes.length; j++) {
            if (i === j) continue;
            const other = prevNodes[j];

            const nodeCenterX = node.x + node.width / 2;
            const nodeCenterY = node.y + node.height / 2;
            const otherCenterX = other.x + other.width / 2;
            const otherCenterY = other.y + other.height / 2;

            const dx = nodeCenterX - otherCenterX;
            const dy = nodeCenterY - otherCenterY;

            // Required separation with padding
            const padX = 16;
            const padY = 12;
            const minDistX = (node.width + other.width) / 2 + padX;
            const minDistY = (node.height + other.height) / 2 + padY;

            const overlapX = minDistX - Math.abs(dx);
            const overlapY = minDistY - Math.abs(dy);

            // If overlapping on both axes, apply strong separating impulse
            if (overlapX > 0 && overlapY > 0) {
              if (overlapX < overlapY) {
                const signX = dx >= 0 ? 1 : -1;
                const push = overlapX * 3.8;
                fx += signX * push;
              } else {
                const signY = dy >= 0 ? 1 : -1;
                const push = overlapY * 3.8;
                fy += signY * push;
              }
            }
          }

          let newVx = (node.vx + fx * dt) * kDamping;
          let newVy = (node.vy + fy * dt) * kDamping;

          // Clamp max velocity to prevent sudden jumps
          const maxV = 16;
          newVx = Math.max(-maxV, Math.min(maxV, newVx));
          newVy = Math.max(-maxV, Math.min(maxV, newVy));

          let newX = node.x + newVx;
          let newY = node.y + newVy;

          // Strict boundary constraints inside stage
          const isMobileStage = dimensions.width < 640;
          const margin = isMobileStage ? 8 : 16;
          newX = Math.max(margin, Math.min(dimensions.width - node.width - margin, newX));
          newY = Math.max(margin, Math.min(Math.max(dimensions.height, layoutHeight) - node.height - margin, newY));

          return {
            ...node,
            x: newX,
            y: newY,
            vx: newVx,
            vy: newVy,
            isDragging: false,
          };
        });
      });

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [dimensions, layoutHeight]);

  // Handle Dragging (Mouse)
  const handleMouseDown = (e: React.MouseEvent, node: PhysicsNode) => {
    if (e.button !== 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    draggingNodeRef.current = {
      id: node.id,
      offsetX: mouseX - node.x,
      offsetY: mouseY - node.y,
    };
    mousePosRef.current = { x: mouseX, y: mouseY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    mousePosRef.current = { x: mouseX, y: mouseY };
  };

  const handleMouseLeave = () => {
    mousePosRef.current = null;
    draggingNodeRef.current = null;
  };

  const handleMouseUp = () => {
    if (draggingNodeRef.current) {
      // Update equilibrium target coordinate to the drop location so it settles naturally
      const draggedId = draggingNodeRef.current.id;
      setNodes((prev) =>
        prev.map((n) => (n.id === draggedId ? { ...n, targetX: n.x, targetY: n.y } : n))
      );
    }
    draggingNodeRef.current = null;
  };

  // Handle Dragging (Touch on Mobile)
  const touchStartPosRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent, node: PhysicsNode) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;

    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };

    draggingNodeRef.current = {
      id: node.id,
      offsetX: touchX - node.x,
      offsetY: touchY - node.y,
    };
    mousePosRef.current = { x: touchX, y: touchY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current || !draggingNodeRef.current) return;
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    mousePosRef.current = { x: touchX, y: touchY };
  };

  const handleTouchEnd = (e: React.TouchEvent, node: PhysicsNode) => {
    if (touchStartPosRef.current && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      const dist = Math.hypot(
        touch.clientX - touchStartPosRef.current.x,
        touch.clientY - touchStartPosRef.current.y
      );
      // If movement was minimal (< 10px), it's an intentional tap!
      if (dist < 10) {
        handleWordClick(node.word);
      }
    }
    handleMouseUp();
    touchStartPosRef.current = null;
  };

  // Re-scramble / Reorganize physics impulse
  const handleReorganize = () => {
    const reordered = layoutNodesCollisionFree(words);
    setNodes(reordered);
  };

  // Pronounce word with high-fidelity Studio Neural Gemini TTS (Single natural voice)
  const handlePronounce = async (text: string, wordId?: string) => {
    if (wordId) setPlayingWordId(wordId);
    try {
      await playSpanishSpeech(text, {
        rate: 0.9,
        onEnd: () => setPlayingWordId(null),
      });
    } finally {
      setPlayingWordId(null);
    }
  };

  // Word selection (Always interactive)
  const handleWordClick = (word: WordItem) => {
    onSelectWord(word);
    handlePronounce(word.word, word.id);
  };

  const handleQuickAudio = (e: React.SyntheticEvent, word: WordItem) => {
    e.stopPropagation();
    handlePronounce(word.word, word.id);
  };

  // Grouped words for categories view
  const categorizedWords = useMemo(() => {
    const groups: Record<string, WordItem[]> = {
      Sustantivos: [],
      Verbos: [],
      Adjetivos: [],
      Expresiones: [],
      Otros: [],
    };

    words.forEach((w) => {
      if (w.category === 'sustantivo') groups.Sustantivos.push(w);
      else if (w.category === 'verbo') groups.Verbos.push(w);
      else if (w.category === 'adjetivo') groups.Adjetivos.push(w);
      else if (w.category === 'expresion') groups.Expresiones.push(w);
      else groups.Otros.push(w);
    });

    return Object.entries(groups).filter(([_, list]) => list.length > 0);
  }, [words]);

  const currentIndex = selectedWord ? words.findIndex((w) => w.id === selectedWord.id) : 0;

  // Category Tag Badge Helper
  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'sustantivo':
        return <span className="text-[9px] sm:text-[10px] text-zinc-400 font-mono tracking-wider">[sust]</span>;
      case 'verbo':
        return <span className="text-[9px] sm:text-[10px] text-zinc-400 font-mono tracking-wider">[verb]</span>;
      case 'adjetivo':
        return <span className="text-[9px] sm:text-[10px] text-zinc-400 font-mono tracking-wider">[adj]</span>;
      case 'expresion':
        return <span className="text-[9px] sm:text-[10px] text-zinc-400 font-mono tracking-wider">[expr]</span>;
      default:
        return null;
    }
  };

  // Render Empty Chalkboard / Whiteboard State (Brutalist Dark Minimalist)
  if (words.length === 0) {
    return (
      <div
        ref={containerRef}
        className={`relative w-full flex flex-col items-center justify-center p-6 sm:p-8 text-center select-none bg-[#0c0c0c] ${
          isPresentationMode ? 'h-full min-h-[640px]' : 'min-h-[460px] sm:min-h-[520px] md:min-h-[580px]'
        }`}
      >
        <div className="relative z-10 max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 mx-auto bg-[#181818] border border-[#27272a] flex items-center justify-center text-zinc-300">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-400">ELE</span>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-base sm:text-lg font-bold text-white font-mono uppercase tracking-wider">
              Pizarra vacía
            </h3>
            <p className="text-xs text-zinc-400 font-sans leading-relaxed max-w-sm mx-auto">
              La pizarra está limpia para la clase. Genera un nuevo campo léxico usando el buscador superior o selecciona un tema sugerido.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">

            {hasRestorableWords && onRestoreWords && (
              <button
                onClick={onRestoreWords}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1c1c1c] hover:bg-zinc-800 border border-[#27272a] text-zinc-200 text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-zinc-400" />
                <span>Restaurar palabras</span>
              </button>
            )}
          </div>

          {onQuickTopic && (
            <div className="pt-4 border-t border-[#242424]">
              <span className="text-[11px] text-zinc-400 font-mono uppercase tracking-widest block mb-2">
                Temas rápidos:
              </span>
              <div className="flex flex-wrap justify-center gap-1.5 font-mono">
                {[
                  { label: 'Verduras', query: 'verduras' },
                  { label: 'Cocinar', query: 'cocinar' },
                  { label: 'Emociones', query: 'emociones' },
                  { label: 'Ciudad', query: 'ciudad' },
                ].map((t) => (
                  <button
                    key={t.query}
                    onClick={() => onQuickTopic(t.query)}
                    className="px-2.5 py-1 text-xs border border-[#27272a] bg-[#181818] hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Render Categorized View (Brutalist Dark)
  if (layoutMode === 'categories') {
    return (
      <div className="w-full p-3 sm:p-6 md:p-8 min-h-[460px] sm:min-h-[520px] relative bg-[#0c0c0c]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {categorizedWords.map(([category, items]) => (
            <div
              key={category}
              className="bg-[#151515] border border-[#27272a] p-3.5 sm:p-4 flex flex-col"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#282828] mb-3">
                <h4 className="font-bold text-white text-xs font-mono uppercase tracking-wider">
                  {category}
                </h4>
                <span className="text-xs text-zinc-400 font-mono">
                  [{items.length}]
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {items.map((item) => {
                  const isSelected = selectedWord?.id === item.id;
                  const itemArticle = getValidArticle(item.category, item.article);
                  const itemDisplay = cleanDisplayWord(item.lemma || item.word);
                  const isPlaying = playingWordId === item.id;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleWordClick(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleWordClick(item);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={`group flex items-center gap-1.5 px-2.5 py-1.5 border text-xs font-mono transition-all text-left cursor-pointer select-none ${
                        isSelected
                          ? 'bg-white text-black border-white font-bold'
                          : 'bg-[#181818] border-[#27272a] text-zinc-200 hover:border-zinc-500 hover:text-white'
                      }`}
                    >
                      {itemArticle && (
                        <span className="text-zinc-500 text-[11px] font-normal">{itemArticle}</span>
                      )}
                      <div className="flex items-center gap-1 shrink-0 ml-auto">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite?.(item.id);
                          }}
                          className={`p-0.5 transition-all cursor-pointer ${
                            item.isFavorite
                              ? 'text-zinc-400 opacity-100'
                              : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-zinc-400 hover:text-zinc-400'
                          }`}
                          title={item.isFavorite ? 'Palabra guardada (clic para quitar)' : 'Guardar palabra (+)'}
                        >
                          {item.isFavorite ? (
                            <Check className="w-3.5 h-3.5 text-zinc-400" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={(e) => handleQuickAudio(e, item)}
                          className={`p-0.5 transition-opacity cursor-pointer ${
                            isPlaying
                              ? 'text-zinc-400 opacity-100 animate-pulse'
                              : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-zinc-400 hover:text-white'
                          }`}
                          title="Pronunciación estudio IA"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {selectedWord && (
          <InteractiveWordCard
            word={selectedWord}
            totalWords={words.length}
            currentIndex={currentIndex >= 0 ? currentIndex : 0}
            onClose={onCloseSelectedWord}
            onPrev={onPrevWord}
            onNext={onNextWord}
            onOpenFullDetail={onOpenFullDetail}
            onToggleFavorite={onToggleFavorite}
          />
        )}
      </div>
    );
  }

  // Render Cards Grid View (Brutalist Dark)
  if (layoutMode === 'cards') {
    return (
      <div className="w-full p-3 sm:p-6 md:p-8 min-h-[460px] sm:min-h-[520px] relative bg-[#0c0c0c]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
          {words.map((w) => {
            const isSelected = selectedWord?.id === w.id;
            const validArt = getValidArticle(w.category, w.article);
            const isPlaying = playingWordId === w.id;

            return (
              <div
                key={w.id}
                onClick={() => handleWordClick(w)}
                className={`cursor-pointer p-3.5 sm:p-4 border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-white text-black border-white'
                    : 'bg-[#151515] border-[#27272a] hover:border-zinc-500 text-zinc-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-mono mb-2">
                    <span className={`uppercase text-[10px] tracking-wider ${isSelected ? 'text-zinc-600' : 'text-zinc-400'}`}>
                      {w.category}
                    </span>
                    <span className={`px-1 py-0.5 text-[10px] font-bold border ${
                      isSelected ? 'border-black text-black' : 'border-zinc-700 text-zinc-300'
                    }`}>
                      {w.level}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between mb-2">
                    <h4 className="text-base font-bold font-mono uppercase tracking-wide">
                      {validArt && <span className="font-normal opacity-60 mr-1">{validArt}</span>}
                      {cleanDisplayWord(w.lemma || w.word)}
                    </h4>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite?.(w.id);
                        }}
                        className={`p-1 transition-colors cursor-pointer ${
                          w.isFavorite
                            ? 'text-zinc-400'
                            : isSelected
                            ? 'text-black hover:text-zinc-700'
                            : 'text-zinc-400 hover:text-zinc-400'
                        }`}
                        title={w.isFavorite ? 'Palabra guardada (clic para quitar)' : 'Guardar palabra (+)'}
                      >
                        {w.isFavorite ? (
                          <Check className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={(e) => handleQuickAudio(e, w)}
                        className={`p-1 transition-colors cursor-pointer ${
                          isPlaying
                            ? 'text-zinc-400 animate-pulse'
                            : isSelected
                            ? 'text-black'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                        title="Pronunciación estudio IA"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className={`text-xs line-clamp-2 leading-relaxed mb-2 font-sans ${
                    isSelected ? 'text-zinc-800' : 'text-zinc-300'
                  }`}>
                    {w.meaning}
                  </p>
                </div>

                {w.example && (
                  <p className={`text-[11px] italic font-sans border-t pt-2 line-clamp-1 ${
                    isSelected ? 'border-zinc-300 text-zinc-700' : 'border-[#282828] text-zinc-400'
                  }`}>
                    "{w.example}"
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {selectedWord && (
          <InteractiveWordCard
            word={selectedWord}
            totalWords={words.length}
            currentIndex={currentIndex >= 0 ? currentIndex : 0}
            onClose={onCloseSelectedWord}
            onPrev={onPrevWord}
            onNext={onNextWord}
            onOpenFullDetail={onOpenFullDetail}
            onToggleFavorite={onToggleFavorite}
          />
        )}
      </div>
    );
  }

  // Render Mobile Mosaico Flow Cloud View (Guaranteed 100% visible on small screens)
  if (mobileViewStyle === 'mosaico') {
    return (
      <div
        ref={containerRef}
        className="w-full p-4 min-h-[460px] bg-[#0c0c0c] relative flex flex-col justify-between"
      >
        {/* Top mini bar with switch back to canvas */}
        <div className="flex items-center justify-between pb-3 border-b border-[#242424] text-xs font-mono">
          <span className="text-[10px] text-zinc-500">Tocá una palabra</span>
          <button
            onClick={() => setMobileViewStyle('canvas')}
            className="flex items-center gap-1 px-2.5 py-1 border border-[#27272a] bg-[#181818] text-zinc-300 hover:text-white text-[10px] uppercase font-bold tracking-wider cursor-pointer"
          >
            <span>Ver flotante</span>
          </button>
        </div>

        {/* Cloud Tags wrap container - perfectly fits mobile screen */}
        <div className="flex-1 py-5 grid grid-cols-2 sm:flex sm:flex-wrap items-center sm:justify-center content-center gap-2">
          {words.map((w) => {
            const isSelected = selectedWord?.id === w.id;
            const isPlaying = playingWordId === w.id;
            const validArt = getValidArticle(w.category, w.article);
            const displayWord = cleanDisplayWord(w.lemma || w.word);
            const wideTile = displayWord.length > 8;
            const sizeClass =
              w.weight === 5
                ? 'text-sm font-extrabold py-2 px-2'
                : w.weight === 4
                ? 'text-sm font-bold py-2 px-2'
                : w.weight === 3
                ? 'text-xs font-semibold py-2 px-2'
                : 'text-xs font-medium py-2 px-2';

            return (
              <div
                key={w.id}
                onClick={() => handleWordClick(w)}
                className={`flex items-center gap-1 min-w-0 border font-mono transition-all cursor-pointer select-none ${wideTile ? 'col-span-2 sm:col-span-1' : ''} ${sizeClass} ${
                  isSelected
                    ? 'bg-white text-black border-white shadow-xl scale-105 ring-2 ring-white/20'
                    : isPlaying
                    ? 'bg-[#18181b] text-zinc-300 border-zinc-400 scale-105'
                    : 'bg-[#151515] border-[#282828] text-zinc-200 hover:border-zinc-500'
                }`}
              >
                {validArt && (
                  <span className="text-[0.75em] opacity-60 font-normal">{validArt}</span>
                )}
                <span className="uppercase tracking-tight min-w-0 break-words">
                  {displayWord}
                </span>
                <div className="flex items-center gap-3 shrink-0 ml-auto">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite?.(w.id);
                    }}
                    className={`relative before:absolute before:-inset-1.5 before:content-[''] p-0 transition-colors cursor-pointer ${
                      w.isFavorite
                        ? 'text-zinc-400'
                        : isSelected
                        ? 'text-black hover:text-zinc-700'
                        : 'text-zinc-400 hover:text-zinc-400'
                    }`}
                    title={w.isFavorite ? 'Palabra guardada (clic para quitar)' : 'Guardar palabra (+)'}
                  >
                    {w.isFavorite ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  </button>
                  <button
                    onClick={(e) => handleQuickAudio(e, w)}
                    className={`relative before:absolute before:-inset-1.5 before:content-[''] p-0 transition-colors cursor-pointer ${
                      isPlaying
                        ? 'text-zinc-400 animate-pulse'
                        : isSelected
                        ? 'text-black'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    title="Pronunciación"
                  >
                    <Volume2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected Word Drawer */}
        {selectedWord && (
          <InteractiveWordCard
            word={selectedWord}
            totalWords={words.length}
            currentIndex={currentIndex >= 0 ? currentIndex : 0}
            onClose={onCloseSelectedWord}
            onPrev={onPrevWord}
            onNext={onNextWord}
            onOpenFullDetail={onOpenFullDetail}
            onToggleFavorite={onToggleFavorite}
          />
        )}
      </div>
    );
  }

  // Floating Dynamic & Spiral Interactive Canvas View (Brutalist Dark Obsidian)
  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
      className={`tag-canvas relative w-full overflow-hidden select-none transition-colors duration-300 bg-[#0c0c0c] touch-pan-y ${
        isPresentationMode ? 'h-full min-h-[640px]' : 'min-h-[480px] md:min-h-[600px]'
      }`}
      style={{
        minHeight: Math.max(layoutHeight, isPresentationMode ? 640 : dimensions.width < 640 ? 480 : 600),
        cursor: draggingNodeRef.current ? 'grabbing' : 'default',
        backgroundImage: `radial-gradient(#242424 0.7px, transparent 0.7px)`,
        backgroundSize: '32px 32px',
      }}
    >
      {/* Top Floating Mini-Toolbar: Voice profile & Physics controls */}
      <div className="absolute top-2 sm:top-3 left-2 sm:left-4 right-2 sm:right-4 z-20 flex flex-wrap items-center justify-end gap-2 pointer-events-none">
        {/* Dynamic Physics Controls & Mobile Mode Switch */}
        <div className="canvas-tools pointer-events-auto flex items-center gap-1.5 bg-[#151515]/90 backdrop-blur-sm border border-[#27272a] p-1 text-xs font-mono">
          {dimensions.width < 640 && (
            <button
              onClick={() => setMobileViewStyle('mosaico')}
              className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-white text-black transition-colors cursor-pointer"
              title="Ver todas las palabras en un mosaico adaptado al móvil"
            >
              Mosaico
            </button>
          )}
          <button
            onClick={handleReorganize}
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] uppercase tracking-wider text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Reorganizar posición de palabras sin solapamiento"
          >
            <Shuffle className="w-3 h-3 text-zinc-400" />
            <span className="hidden sm:inline">Reorganizar</span>
          </button>
        </div>
      </div>

      {/* Physics Interactive Cloud Nodes */}
      {nodes.map((node) => {
        const isHovered = hoveredWordId === node.id;
        const isSelected = selectedWord?.id === node.id;
        const isPlaying = playingWordId === node.id;
        const validArt = getValidArticle(node.word.category, node.word.article);

        return (
          <div
            key={node.id}
            onMouseDown={(e) => handleMouseDown(e, node)}
            onClick={() => handleWordClick(node.word)}
            onTouchStart={(e) => handleTouchStart(e, node)}
            onTouchMove={handleTouchMove}
            onTouchEnd={(e) => handleTouchEnd(e, node)}
            onMouseEnter={() => setHoveredWordId(node.id)}
            onMouseLeave={() => setHoveredWordId(null)}
            style={{
              transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
              fontSize: `${node.fontSize}px`,
              width: node.width,
              height: node.height,
              color: isSelected ? '#000000' : node.color,
              touchAction: 'none',
            }}
            className={`absolute top-0 left-0 select-none leading-none group focus-within:z-30 will-change-transform transition-[border-color,background-color,box-shadow] duration-150 ${
              isSelected ? 'z-30 cursor-pointer' : isHovered ? 'z-20 cursor-grab' : 'z-10 cursor-pointer'
            }`}
          >
            <button
              type="button"
              aria-label={`Ver ficha: ${cleanDisplayWord(node.word.lemma || node.word.word)}`}
              className={`cloud-tag w-full h-full flex items-center justify-center gap-1.5 font-mono font-bold border cursor-pointer ${
                isSelected ? 'is-selected' : isPlaying ? 'is-playing' : ''
              }`}
            >
              {validArt && <span className="text-[0.62em] font-normal opacity-60">{validArt}</span>}
              <span className="uppercase whitespace-nowrap">{cleanDisplayWord(node.word.lemma || node.word.word)}</span>
            </button>
            <div className="tag-actions pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto hidden sm:flex absolute right-0 -bottom-8 z-30 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 bg-[#161616] border border-zinc-700">
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(node.word.id); }}
                className="w-8 h-8 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
                title={node.word.isFavorite ? 'Palabra guardada (clic para quitar)' : 'Guardar palabra (+)'}
              >
                {node.word.isFavorite ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              </button>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => handleQuickAudio(e, node.word)}
                className="w-8 h-8 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
                title="Pronunciación de estudio IA"
              >
                <Volume2 className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>
        );
      })}

      {/* Interactive Word Inspector Card - ALWAYS active */}
      {selectedWord && (
        <InteractiveWordCard
          word={selectedWord}
          totalWords={words.length}
          currentIndex={currentIndex >= 0 ? currentIndex : 0}
          onClose={onCloseSelectedWord}
          onPrev={onPrevWord}
          onNext={onNextWord}
          onOpenFullDetail={onOpenFullDetail}
          onToggleFavorite={onToggleFavorite}
        />
      )}

      {/* Floating Canvas Guide Note */}
      <div className="canvas-guide absolute bottom-2 sm:bottom-3 right-2 sm:right-4 pointer-events-none text-[10px] sm:text-[11px] text-zinc-400 font-mono uppercase tracking-wider flex items-center gap-1.5 sm:gap-2 bg-[#0c0c0c]/85 px-2 py-1 border border-[#242424]">
        <GripHorizontal className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        <span className="hidden sm:inline">Arrastrá para ordenar · Elegí una palabra para explorar</span>
        <span className="sm:hidden">Tocá para explorar · Arrastrá para ordenar</span>
      </div>
    </div>
  );
};
