/**
 * Audio and Pronunciation Engine for ELE
 * Integrates Studio-grade Gemini Neural TTS with resilient client-side caching
 * and enhanced natural Web Speech API fallback.
 */

import { getApiHeaders } from './apiKeyStorage';

export interface SpeechOptions {
  rate?: number;
  voice?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

// Global active audio instance to prevent multiple overlapping sounds
let currentAudio: HTMLAudioElement | null = null;
const audioCache = new Map<string, string>();
const prefetchQueue = new Set<string>();

// Single unified high-quality voice
let currentVoiceName: 'Kore' = 'Kore';

export function setPreferredVoice(_voice: string) {
  currentVoiceName = 'Kore';
}

export function getPreferredVoice(): 'Kore' {
  return 'Kore';
}

/**
 * Clean text for pedagogical pronunciation (removes parentheses, brackets, extra symbols)
 */
function cleanSpeechText(text: string): string {
  return text
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/[\/\\#@!¡?¿]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Plays Spanish speech with high fidelity
 * Primary: Studio Neural Gemini TTS (24kHz WAV, natural human intonation)
 * Fallback: Enhanced native browser speech synthesis with robotic voices filtered out
 */
export async function playSpanishSpeech(
  text: string,
  optionsOrRate: number | SpeechOptions = 0.9
): Promise<void> {
  const options: SpeechOptions =
    typeof optionsOrRate === 'number'
      ? { rate: optionsOrRate, voice: currentVoiceName }
      : {
          rate: optionsOrRate.rate ?? 0.9,
          voice: optionsOrRate.voice ?? currentVoiceName,
          onStart: optionsOrRate.onStart,
          onEnd: optionsOrRate.onEnd,
        };

  const cleanText = cleanSpeechText(text);
  if (!cleanText) return;

  // Stop any currently playing audio
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {
      // ignore
    }
    currentAudio = null;
  }

  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }

  options.onStart?.();

  const cacheKey = `${cleanText.toLowerCase()}_${options.voice || currentVoiceName}`;

  // 1. Try playing from client-side audio cache if available
  if (audioCache.has(cacheKey)) {
    const audioUrl = audioCache.get(cacheKey)!;
    return playHtmlAudio(audioUrl, options);
  }

  if (!navigator.onLine) return playEnhancedWebSpeech(cleanText, options);

  // 2. Fetch high-fidelity neural audio from server /api/tts
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2200); // Fast 2.2s ceiling

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({
        text: cleanText,
        voice: options.voice || currentVoiceName,
        rate: options.rate,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.audioData) {
        audioCache.set(cacheKey, data.audioData);
        return playHtmlAudio(data.audioData, options);
      }
    }
  } catch (err) {
    // Network timeout or error -> fall through to enhanced Web Speech API immediately
    console.info('[Audio] Gemini TTS en espera, usando sintetizador nativo de alta calidad');
  }

  // 3. Fallback to Enhanced Browser Speech Synthesis (Filtered for natural tone)
  return playEnhancedWebSpeech(cleanText, options);
}

/**
 * Plays an HTML5 Audio data URI or URL
 */
function playHtmlAudio(src: string, options: SpeechOptions): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(src);
    currentAudio = audio;
    audio.playbackRate = options.rate ? Math.max(0.75, Math.min(1.2, options.rate)) : 1.0;

    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null;
      options.onEnd?.();
      resolve();
    };

    audio.onerror = () => {
      if (currentAudio === audio) currentAudio = null;
      // Fallback to Web Speech on play error
      playEnhancedWebSpeech(src, options).then(resolve);
    };

    audio.play().catch(() => {
      // Autoplay or decode blocked -> fallback
      playEnhancedWebSpeech(src, options).then(resolve);
    });
  });
}

/**
 * Enhanced Web Speech API with strict filtering against robotic voices
 */
function playEnhancedWebSpeech(text: string, options: SpeechOptions): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      options.onEnd?.();
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = options.rate ? Math.max(0.8, Math.min(1.05, options.rate)) : 0.88;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();

    // Filter out known low-quality / robotic voices (espeak, mbrola, speech-dispatcher, etc.)
    const spanishVoices = voices.filter((v) => {
      const lang = v.lang.toLowerCase();
      const name = v.name.toLowerCase();
      const isSpanish = lang.startsWith('es-') || lang.startsWith('es_') || lang === 'es';
      const isRobotic =
        name.includes('espeak') ||
        name.includes('robotic') ||
        name.includes('synth') ||
        name.includes('mbrola');
      return isSpanish && !isRobotic;
    });

    // Rank voices: prioritize Neural, Natural, Google, Microsoft, Apple
    const bestVoice = spanishVoices.sort((a, b) => {
      const getScore = (voice: SpeechSynthesisVoice) => {
        const n = voice.name.toLowerCase();
        if (n.includes('natural') || n.includes('neural') || n.includes('premium')) return 10;
        if (n.includes('google')) return 8;
        if (n.includes('sabina') || n.includes('monica') || n.includes('paulina')) return 7;
        if (n.includes('microsoft') || n.includes('apple')) return 6;
        if (voice.lang.includes('ES') || voice.lang.includes('es-ES')) return 5;
        return 1;
      };
      return getScore(b) - getScore(a);
    })[0] || voices.find((v) => v.lang.startsWith('es'));

    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    utterance.onend = () => {
      options.onEnd?.();
      resolve();
    };

    utterance.onerror = () => {
      options.onEnd?.();
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Pre-cache audio in background for words safely without causing 429 quota errors.
 * Preserves quota so that user clicks have available API headroom.
 */
export function prefetchSpanishAudio(_words: string[]) {
  // Deliberately no-op mass background requests to avoid hitting Gemini free-tier rate limits (3 req/min).
  // Audio will be generated on-demand when user clicks a word or speaker icon and cached in memory.
}
