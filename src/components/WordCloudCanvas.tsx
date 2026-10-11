import type { DetailState } from './WordDetailsStatus';
import { flowCloudBoxes, packCloudBoxes } from '../utils/cloudLayout';
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { WordItem, LayoutMode, ColorPalette } from '../types';
import { playSpanishSpeech, prefetchSpanishAudio } from '../utils/audio';
import { getValidArticle, cleanDisplayWord } from '../utils/grammar';
import { createWordPress } from '../utils/wordPress';
import { Volume2, Plus, Check, RotateCcw, Shuffle, List, Eraser, Cloud } from 'lucide-react';
import { usePresence } from '../hooks/usePresence';
import { InteractiveWordCard } from './InteractiveWordCard';

interface WordCloudCanvasProps {
  words: WordItem[];
  palette: ColorPalette;
  layoutMode: LayoutMode;
  onSelectWord: (word: WordItem) => void;
  selectedWord: WordItem | null;
  detailState?: DetailState;
  onCloseSelectedWord: () => void;
  onPrevWord: () => void;
  onNextWord: () => void;
  onOpenFullDetail: () => void;
  isPresentationMode?: boolean;
  onRestoreWords?: () => void;
  hasRestorableWords?: boolean;
  onQuickTopic?: (topic: string) => void;
  onToggleFavorite?: (id: string) => void;
  retainedIds: Set<string>;
  selectionDisabled: boolean;
  onToggleSelection: (id: string) => void;
  onClearBoard: () => void;
  /** Where the board tools render (the stage strip). */
  toolsSlot?: HTMLElement | null;
  isGenerating?: boolean;
  generatingTopic?: string;
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
  detailState,
  onCloseSelectedWord,
  onPrevWord,
  onNextWord,
  onOpenFullDetail,
  isPresentationMode = false,
  onRestoreWords,
  hasRestorableWords = false,
  onQuickTopic,
  onToggleFavorite,
  retainedIds,
  selectionDisabled,
  onToggleSelection,
  onClearBoard,
  toolsSlot,
  isGenerating = false,
  generatingTopic = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 960, height: 600 });
  const [layoutHeight, setLayoutHeight] = useState(480);
  const [hoveredWordId, setHoveredWordId] = useState<string | null>(null);
  const layoutSeed = useRef(0);
  const lastGeometry = useRef('');
  const [nodes, setNodes] = useState<PhysicsNode[]>([]);
  const [playingWordId, setPlayingWordId] = useState<string | null>(null);

  const animationFrameRef = useRef<number | null>(null);
  const draggingNodeRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const nodesRef = useRef<PhysicsNode[]>([]);
  nodesRef.current = nodes;

  // Mobile visual display mode: 'canvas' (floating/spiral physics) or 'mosaico' (flow tag cloud cluster)
  const [mobileViewStyle, setMobileViewStyle] = useState<'canvas' | 'mosaico'>('canvas');
  const selectionHandler = useRef(onToggleSelection);
  selectionHandler.current = onToggleSelection;
  const [wordPress] = useState(() => createWordPress(id => selectionHandler.current(id)));
  const pointerRef = useRef<{ id: number; node?: PhysicsNode; x: number; y: number } | null>(null);
  useEffect(() => {
    wordPress.cancel();
    pointerRef.current = null;
    draggingNodeRef.current = null;
    return () => wordPress.cancel();
  }, [wordPress, selectionDisabled, mobileViewStyle, words]);

  // The cloud fills its stage: measure the stage, not the content.
  useEffect(() => {
    const updateSize = () => {
      const container = containerRef.current;
      if (!container) return;
      const stage = container.parentElement;
      const width = Math.max(container.clientWidth || 360, 280);
      const stageHeight = stage?.clientHeight || 0;
      setDimensions({ width, height: Math.max(stageHeight, width < 640 ? 420 : 480) });
    };

    updateSize();
    let active = true;
    document.fonts.ready.then(() => { if (active) updateSize(); });
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current?.parentElement) observer.observe(containerRef.current.parentElement);
    return () => { active = false; observer.disconnect(); };
  }, [isPresentationMode, words.length === 0, mobileViewStyle]);

  // While arranging, tags glide to new positions (CSS transition on transform).
  const [isArranging, setIsArranging] = useState(false);
  const arrangeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(arrangeTimer.current), []);
  const startArranging = useCallback(() => {
    setIsArranging(true);
    clearTimeout(arrangeTimer.current);
    arrangeTimer.current = setTimeout(() => setIsArranging(false), 760);
  }, []);

  // Prefetch audio in background whenever words update
  useEffect(() => {
    if (words.length > 0) {
      prefetchSpanishAudio(words.map((w) => w.word));
    }
  }, [words]);

  // Starting type scale from the room per word; the layout then shrinks it until everything fits.
  const typeScale = useMemo(() => {
    // Phones use the cheap flow layout, so start large and let the fit loop shrink it.
    if (dimensions.width < 640 || dimensions.height > dimensions.width * 1.1) return 1.8;
    const room = (dimensions.width * dimensions.height) / (Math.max(words.length, 8) * 30000);
    return Math.min(1.7, Math.max(.6, Math.sqrt(room)));
  }, [dimensions.width, dimensions.height, words.length]);

  const getFontSize = useCallback(
    (weight: number, isMobile: boolean) => {
      const steps = isMobile ? [15, 17, 20, 24, 29] : [16, 20, 26, 34, 44];
      const index = Math.max(1, Math.min(5, weight)) - 1;
      return steps[index] * typeScale;
    },
    [typeScale]
  );

  // Measure the same font the tags use, with one shared canvas context.
  const measureRef = useRef<{ context: CanvasRenderingContext2D | null; family: string } | null>(null);
  const estimateDimensions = useCallback(
    (word: WordItem, fontSize: number, minHeight = 44, padY = 12) => {
      if (!measureRef.current) {
        measureRef.current = {
          context: document.createElement('canvas').getContext('2d'),
          family: getComputedStyle(document.body).fontFamily,
        };
      }
      const { context, family } = measureRef.current;
      const displayWord = cleanDisplayWord(word.lemma || word.word);
      const article = getValidArticle(word.category, word.article);
      if (context) context.font = `600 ${fontSize}px ${family}`;
      const wordWidth = context?.measureText(displayWord).width ?? displayWord.length * fontSize * 0.61;
      if (context) context.font = `400 ${fontSize * 0.62}px ${family}`;
      const articleWidth = article ? (context?.measureText(article).width ?? article.length * fontSize * 0.62) + 6 : 0;
      const estimatedWidth = Math.ceil(wordWidth + articleWidth + 22);
      const estimatedHeight = Math.max(minHeight, Math.ceil(fontSize * 1.2 + padY));

      return { estimatedWidth, estimatedHeight };
    },
    []
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedWord || (e.target instanceof Element && e.target.closest('input, textarea, select, button:not(.cloud-tag), [contenteditable=true], [role=dialog]'))) return;
      if (e.key === ' ' && e.target instanceof Element && e.target.closest('.cloud-tag')) return;
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

  // Pack every word inside the visible stage: if the cloud does not fit,
  // shrink the type and pack again, so the stage never needs to scroll.
  const layoutNodesCollisionFree = useCallback(
    (currentWords: WordItem[], forceMode?: LayoutMode): PhysicsNode[] => {
      const { width, height } = dimensions;
      const isMobile = width < 640;
      const sortedWords = [...currentWords].sort((a, b) => b.weight - a.weight);
      const seed = forceMode === 'spiral' ? 0 : layoutSeed.current;
      const measure = (fit: number) => sortedWords.map(word => {
        let fontSize = Math.max(10, getFontSize(word.weight, isMobile) * fit);
        // Phones lay words out as text lines, so the row height follows the type.
        const minHeight = isMobile ? 0 : Math.max(28, Math.round(44 * Math.min(1, fit * 1.1)));
        const padY = isMobile ? 8 : 12;
        while (estimateDimensions(word, fontSize, minHeight, padY).estimatedWidth > width - 40 && fontSize > 10) fontSize *= 0.95;
        const { estimatedWidth, estimatedHeight } = estimateDimensions(word, fontSize, minHeight, padY);
        return { width: estimatedWidth, height: estimatedHeight, fontSize };
      });
      // Portrait stages (phones, upright tablets) read best as centered text lines.
      const pack = isMobile || height > width * 1.1 ? flowCloudBoxes : packCloudBoxes;
      let fit = 1;
      let boxes = measure(fit);
      let packed = pack(boxes, width, height, seed);
      for (let attempt = 0; packed.height > height && attempt < 24; attempt++) {
        fit *= Math.max(.8, Math.min(.95, Math.sqrt(height / packed.height)));
        boxes = measure(fit);
        packed = pack(boxes, width, height, seed);
      }
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
    const geometry = JSON.stringify([dimensions, layoutMode, isPresentationMode,
      words.map(word => [word.id, word.lemma, word.word, word.article, word.category, word.weight]),
      words.map(word => estimateDimensions(word, getFontSize(word.weight, dimensions.width < 640))),
    ]);
    if (lastGeometry.current === geometry) {
      const byId = new Map(words.map(word => [word.id, word]));
      setNodes(previous => previous.map(node => ({ ...node, word: byId.get(node.id) || node.word })));
      return;
    }
    lastGeometry.current = geometry;
    // Reflow existing words with a glide; new words still ink in.
    if (nodesRef.current.length && words.length) startArranging();
    setNodes(layoutNodesCollisionFree(words));
  }, [words, layoutMode, dimensions.width, dimensions.height, layoutNodesCollisionFree]);

  // Keep resting tags still and separate their bounding boxes during dragging.
  useEffect(() => {
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.035);
      lastTime = now;

      setNodes((prevNodes) => {
        if (!prevNodes.length || (!draggingNodeRef.current && prevNodes.every(node => Math.abs(node.vx) < .01 && Math.abs(node.vy) < .01 && Math.abs(node.targetX - node.x) < .1 && Math.abs(node.targetY - node.y) < .1))) return prevNodes;

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
            const padX = dimensions.width < 640 ? 12 : 16;
            const padY = dimensions.width < 640 ? 8 : 12;
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

  const finishDragging = () => {
    if (draggingNodeRef.current) {
      // Update equilibrium target coordinate to the drop location so it settles naturally
      const draggedId = draggingNodeRef.current.id;
      setNodes((prev) =>
        prev.map((n) => (n.id === draggedId ? { ...n, targetX: n.x, targetY: n.y } : n))
      );
    }
    draggingNodeRef.current = null;
  };

  // Pointer events share one hold/tap behavior for fingers, pens and mice.
  const wordPressHandlers = (word: WordItem, node?: PhysicsNode) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!event.isPrimary || event.button !== 0) {
        wordPress.cancel();
        return;
      }
      pointerRef.current = { id: event.pointerId, node, x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
      wordPress.start(word.id, event.clientX, event.clientY);
    },
    onPointerMove: (event: React.PointerEvent<HTMLButtonElement>) => {
      const pointer = pointerRef.current;
      if (!pointer || pointer.id !== event.pointerId) return;
      if (!wordPress.move(event.clientX, event.clientY) || !pointer.node || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (!draggingNodeRef.current) {
        draggingNodeRef.current = {
          id: pointer.node.id,
          offsetX: pointer.x - rect.left - pointer.node.x,
          offsetY: pointer.y - rect.top - pointer.node.y,
        };
      }
      mousePosRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (pointerRef.current?.id !== event.pointerId) return;
      wordPress.end();
      pointerRef.current = null;
      finishDragging();
    },
    onPointerCancel: () => {
      wordPress.cancel();
      pointerRef.current = null;
      finishDragging();
    },
    onLostPointerCapture: () => {
      wordPress.cancel();
      pointerRef.current = null;
      finishDragging();
    },
    onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault(),
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      if (event.detail === 0 || wordPress.allowClick()) handleWordClick(word);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.shiftKey && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat && !selectionDisabled) onToggleSelection(word.id);
      }
    },
  });

  const clearButton = <button onClick={onClearBoard} className="board-clear" title="Borrar la pizarra" aria-label="Borrar la pizarra">
    <Eraser aria-hidden="true" />
    <span>Borrar</span>
  </button>;

  // Board tools live in the stage strip, beside the cloud title.
  const tools = (extra: React.ReactNode) => {
    const content = <div className="canvas-tools">{clearButton}{extra}</div>;
    return toolsSlot ? createPortal(content, toolsSlot) : content;
  };

  const pressHint = 'Toca para abrir la ficha. Mantén pulsado para seleccionar. Con teclado: Mayús + Enter.';

  // Re-scramble / Reorganize physics impulse
  const handleReorganize = () => {
    layoutSeed.current += 1.7;
    startArranging();
    setNodes(layoutNodesCollisionFree(words));
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

  const currentIndex = selectedWord ? words.findIndex((w) => w.id === selectedWord.id) : 0;
  const { rendered: inspectedWord, closing: inspectorClosing } = usePresence(selectedWord, 260);

  const inspector = inspectedWord && (
    <InteractiveWordCard
      word={inspectedWord}
      closing={inspectorClosing}
      detailState={detailState}
      totalWords={words.length}
      currentIndex={currentIndex >= 0 ? currentIndex : 0}
      onClose={onCloseSelectedWord}
      onPrev={onPrevWord}
      onNext={onNextWord}
      onOpenFullDetail={onOpenFullDetail}
      onToggleFavorite={onToggleFavorite}
    />
  );

  // Empty board: a quiet sheet with a single invitation to start again.
  if (words.length === 0 && isGenerating) {
    return (
      <div ref={containerRef} className="empty-board is-generating" style={{ minHeight: dimensions.height }} role="status" aria-live="polite">
        <div className="empty-board-inner">
          <p className="eyebrow"><span>Generando</span><span>Campo léxico</span></p>
          <h3 className="empty-title generating-title"><em>{generatingTopic || 'vocabulario'}</em></h3>
          <span className="progress-track" aria-hidden="true"><span /></span>
        </div>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div ref={containerRef} className="empty-board" style={{ minHeight: dimensions.height }}>
        <div className="empty-board-inner">
          <p className="eyebrow"><span>Pizarra</span><span>Vacía</span></p>
          <h3 className="empty-title">Una página <em>en blanco.</em></h3>
          <p className="empty-text">
            Generá un campo léxico nuevo desde el buscador o empezá por uno de estos temas.
          </p>
          {onQuickTopic && (
            <div className="chip-row is-centered">
              {['verduras', 'cocinar', 'emociones', 'ciudad'].map((topic) => (
                <button key={topic} onClick={() => onQuickTopic(topic)} className="chip">
                  {topic}
                </button>
              ))}
            </div>
          )}
          {hasRestorableWords && onRestoreWords && (
            <button onClick={onRestoreWords} className="text-button">
              <RotateCcw aria-hidden="true" />
              <span>Restaurar palabras</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Mobile mosaic: an indexed list so every word stays legible on small screens.
  if (mobileViewStyle === 'mosaico') {
    // Fit the whole list on screen: one column, or two when it is long.
    const columns = words.length > 12 ? 2 : 1;
    const rows = Math.ceil(words.length / columns);
    return (
      <div
        ref={containerRef}
        className="mosaic"
        data-columns={columns}
        style={{ height: dimensions.height, '--rows': rows, '--row-h': `${Math.min(64, (dimensions.height - 24) / rows)}px` } as React.CSSProperties}
      >
        {tools(
          <button onClick={() => setMobileViewStyle('canvas')} title="Ver las palabras como nube" aria-label="Ver como nube">
            <Cloud aria-hidden="true" />
            <span>Nube</span>
          </button>
        )}

        <ol className="mosaic-list">
          {words.map((w, index) => {
            const isSelected = selectedWord?.id === w.id;
            const isPlaying = playingWordId === w.id;
            const validArt = getValidArticle(w.category, w.article);
            const displayWord = cleanDisplayWord(w.lemma || w.word);

            return (
              <li key={w.id} className="mosaic-item" style={{ '--i': Math.min(index, 24) } as React.CSSProperties}>
                <button
                  {...wordPressHandlers(w)}
                  className={`mosaic-word ${isSelected ? 'is-selected' : ''} ${retainedIds.has(w.id) ? 'is-kept' : ''} ${isPlaying ? 'is-playing' : ''}`}
                  aria-label={`Ver ficha: ${displayWord}`}
                  aria-pressed={retainedIds.has(w.id)}
                  title={pressHint}
                  data-weight={w.weight}
                >
                  <span className="mosaic-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="mosaic-text">
                    {validArt && <span className="tag-article">{validArt}</span>}
                    <span>{displayWord}</span>
                  </span>
                  <span className="mosaic-level">{w.level}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(w.id); }}
                  className="icon-button"
                  aria-label={w.isFavorite ? `Quitar ${displayWord} de guardadas` : `Guardar ${displayWord}`}
                  aria-pressed={!!w.isFavorite}
                >
                  {w.isFavorite ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                </button>
                <button
                  onClick={(e) => handleQuickAudio(e, w)}
                  className={`icon-button ${isPlaying ? 'is-playing' : ''}`}
                  aria-label={`Escuchar ${displayWord}`}
                >
                  <Volume2 aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ol>

        {inspector}
      </div>
    );
  }

  // Floating cloud: packed tags that can be dragged and rearranged.
  return (
    <div
      ref={containerRef}
      className={`tag-canvas ${isArranging ? 'is-arranging' : ''} ${selectedWord ? 'has-selection' : ''} ${isGenerating ? 'is-generating' : ''}`}
      style={{
        minHeight: Math.max(layoutHeight, dimensions.height),
        cursor: draggingNodeRef.current ? 'grabbing' : 'default',
      }}
    >
      {tools(<>
        {dimensions.width < 640 && (
          <button
            onClick={() => setMobileViewStyle('mosaico')}
            title="Ver todas las palabras en una lista"
            aria-label="Ver como lista"
          >
            <List aria-hidden="true" />
            <span>Lista</span>
          </button>
        )}
        <button onClick={handleReorganize} className="tool-shuffle" title="Reorganizar las palabras" aria-label="Reorganizar">
          <Shuffle aria-hidden="true" />
          <span>Reorganizar</span>
        </button>
      </>)}

      {nodes.map((node, index) => {
        const isHovered = hoveredWordId === node.id;
        const isSelected = selectedWord?.id === node.id;
        const isPlaying = playingWordId === node.id;
        const validArt = getValidArticle(node.word.category, node.word.article);
        const displayWord = cleanDisplayWord(node.word.lemma || node.word.word);

        return (
          <div
            key={node.id}
            onMouseEnter={() => setHoveredWordId(node.id)}
            onMouseLeave={() => setHoveredWordId(null)}
            data-weight={node.word.weight}
            data-dragging={node.isDragging || undefined}
            data-playing={isPlaying || undefined}
            style={{
              transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
              fontSize: `${node.fontSize}px`,
              width: node.width,
              height: node.height,
              touchAction: 'none',
              '--i': Math.min(index, 30),
            } as React.CSSProperties}
            className={`cloud-node group ${isSelected ? 'is-selected' : ''} ${retainedIds.has(node.id) ? 'is-kept' : ''} ${isHovered ? 'is-hovered' : ''}`}
          >
            <button
              type="button"
              {...wordPressHandlers(node.word, node)}
              aria-label={`Ver ficha: ${displayWord}`}
              aria-pressed={retainedIds.has(node.id)}
              title={pressHint}
              className={`cloud-tag ${isSelected ? 'is-selected' : ''} ${retainedIds.has(node.id) ? 'is-kept' : ''} ${isPlaying ? 'is-playing' : ''}`}
            >
              {validArt && <span className="tag-article">{validArt}</span>}
              <span className="tag-word">{displayWord}</span>
            </button>
            <div onTouchStart={event => event.stopPropagation()} onTouchEnd={event => event.stopPropagation()} className="tag-actions">
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(node.word.id); }}
                title={node.word.isFavorite ? 'Quitar de guardadas' : 'Guardar palabra'}
                aria-label={node.word.isFavorite ? `Quitar ${displayWord} de guardadas` : `Guardar ${displayWord}`}
              >
                {node.word.isFavorite ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
              </button>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => handleQuickAudio(e, node.word)}
                title="Escuchar pronunciación"
                aria-label={`Escuchar ${displayWord}`}
              >
                <Volume2 aria-hidden="true" />
              </button>
            </div>
          </div>
        );
      })}

      {inspector}

    </div>
  );
};
