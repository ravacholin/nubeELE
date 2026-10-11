import type { DetailState } from './WordDetailsStatus';
import { packCloudBoxes } from '../utils/cloudLayout';
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { WordItem, LayoutMode, ColorPalette } from '../types';
import { playSpanishSpeech, prefetchSpanishAudio } from '../utils/audio';
import { getValidArticle, cleanDisplayWord } from '../utils/grammar';
import { Volume2, Plus, Check, RotateCcw, Shuffle, List } from 'lucide-react';
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

  // Prefetch audio in background whenever words update
  useEffect(() => {
    if (words.length > 0) {
      prefetchSpanishAudio(words.map((w) => w.word));
    }
  }, [words]);

  // Type scales with the room available per word, so a short list fills the stage.
  const typeScale = useMemo(() => {
    const isMobile = dimensions.width < 640;
    const room = (dimensions.width * dimensions.height) / (Math.max(words.length, 8) * (isMobile ? 12000 : 30000));
    return Math.min(isMobile ? 1.35 : 1.7, Math.max(isMobile ? .9 : 1, Math.sqrt(room)));
  }, [dimensions.width, dimensions.height, words.length]);

  const getFontSize = useCallback(
    (weight: number, isMobile: boolean) => {
      const steps = isMobile ? [15, 17, 20, 24, 29] : [16, 20, 26, 34, 44];
      const index = Math.max(1, Math.min(5, weight)) - 1;
      return Math.round(steps[index] * typeScale);
    },
    [typeScale]
  );

  // Estimate node dimensions accurately for non-overlapping bounding boxes
  const estimateDimensions = useCallback(
    (word: WordItem, fontSize: number) => {
      const displayWord = cleanDisplayWord(word.lemma || word.word);
      const article = getValidArticle(word.category, word.article);
      const isMobile = dimensions.width < 640;
      // Measure the same font used by the tags so larger mobile type still fits.
      const context = document.createElement('canvas').getContext('2d');
      const family = getComputedStyle(document.body).fontFamily;
      if (context) context.font = `600 ${fontSize}px ${family}`;
      const wordWidth = context?.measureText(displayWord).width ?? displayWord.length * fontSize * 0.61;
      if (context) context.font = `400 ${fontSize * 0.62}px ${family}`;
      const articleWidth = article ? (context?.measureText(article).width ?? article.length * fontSize * 0.62) + 6 : 0;
      const estimatedWidth = Math.ceil(wordWidth + articleWidth + 22);
      const estimatedHeight = Math.max(44, Math.ceil(fontSize + 20));

      return { estimatedWidth, estimatedHeight };
    },
    [dimensions.width]
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
      const packed = packCloudBoxes(boxes, width, height, forceMode === 'spiral' ? 0 : layoutSeed.current);
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
    // Suppress the synthetic click: the tap is handled here exactly once.
    e.preventDefault();
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
  const [isArranging, setIsArranging] = useState(false);
  const arrangeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(arrangeTimer.current), []);
  const handleReorganize = () => {
    layoutSeed.current += 1.7;
    const reordered = layoutNodesCollisionFree(words);
    // Glide tags to their new places instead of jumping.
    setIsArranging(true);
    setNodes(reordered);
    clearTimeout(arrangeTimer.current);
    arrangeTimer.current = setTimeout(() => setIsArranging(false), 720);
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
    return (
      <div ref={containerRef} className="mosaic">
        <div className="mosaic-bar">
          <span className="eyebrow"><span>Lista</span><span>Tocá una palabra</span></span>
          <button onClick={() => setMobileViewStyle('canvas')} className="text-button">
            Ver nube
          </button>
        </div>

        <ol className="mosaic-list">
          {words.map((w, index) => {
            const isSelected = selectedWord?.id === w.id;
            const isPlaying = playingWordId === w.id;
            const validArt = getValidArticle(w.category, w.article);
            const displayWord = cleanDisplayWord(w.lemma || w.word);

            return (
              <li key={w.id} className="mosaic-item" style={{ '--i': Math.min(index, 24) } as React.CSSProperties}>
                <button
                  onClick={() => handleWordClick(w)}
                  className={`mosaic-word ${isSelected ? 'is-selected' : ''} ${isPlaying ? 'is-playing' : ''}`}
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
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
      className={`tag-canvas ${isArranging ? 'is-arranging' : ''} ${selectedWord ? 'has-selection' : ''}`}
      style={{
        minHeight: Math.max(layoutHeight, dimensions.height),
        cursor: draggingNodeRef.current ? 'grabbing' : 'default',
      }}
    >
      <div className="canvas-tools">
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
        <button onClick={handleReorganize} title="Reorganizar las palabras" aria-label="Reorganizar">
          <Shuffle aria-hidden="true" />
          <span>Reorganizar</span>
        </button>
      </div>

      {nodes.map((node, index) => {
        const isHovered = hoveredWordId === node.id;
        const isSelected = selectedWord?.id === node.id;
        const isPlaying = playingWordId === node.id;
        const validArt = getValidArticle(node.word.category, node.word.article);
        const displayWord = cleanDisplayWord(node.word.lemma || node.word.word);

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
            data-weight={node.word.weight}
            data-dragging={node.isDragging || undefined}
            style={{
              transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
              fontSize: `${node.fontSize}px`,
              width: node.width,
              height: node.height,
              touchAction: 'none',
              '--i': Math.min(index, 30),
            } as React.CSSProperties}
            className={`cloud-node group ${isSelected ? 'is-selected' : ''} ${isHovered ? 'is-hovered' : ''}`}
          >
            <button
              type="button"
              aria-label={`Ver ficha: ${displayWord}`}
              className={`cloud-tag ${isSelected ? 'is-selected' : ''} ${isPlaying ? 'is-playing' : ''}`}
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
