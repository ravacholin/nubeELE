export type GrammaticalCategory = 'sustantivo' | 'verbo' | 'adjetivo' | 'expresion' | 'adverbio';
export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export interface RegionalVariantItem {
  countries: string[];
  flags?: string[];
  variant: string;
  note?: string;
}

export interface RegionalUsage {
  primaryCountries: string[];
  primaryFlags?: string[];
  primaryTerm: string;
  variants: RegionalVariantItem[];
  explanation?: string;
  isPanhispanicUniversal?: boolean;
}

export interface WordItem {
  id: string;
  word: string;
  lemma: string;
  article: string | null;
  category: GrammaticalCategory;
  subcategory?: string;
  level: CEFRLevel;
  weight: number; // 1 to 5
  detailsPending?: boolean;
  topicContext?: string;
  synonyms?: string[];
  meaning: string;
  translationEn?: string;
  example: string;
  collocation?: string;
  pronunciationHint?: string;
  regionalUsage?: RegionalUsage;
  // Dynamic cloud positioning
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  color?: string;
  fontSize?: number;
  isCustom?: boolean;
  isFavorite?: boolean;
}

export interface OddOneOut {
  word: string;
  meaning: string;
  reason: string;
}

export interface CloudData {
  title: string;
  summary: string;
  suggestedTopics: string[];
  challenge: string;
  oddOneOut?: OddOneOut;
  words: WordItem[];
}

export type ColorPaletteId = 'mediterraneo' | 'bosque' | 'crema' | 'fiesta' | 'noche';

export interface ColorPalette {
  id: ColorPaletteId;
  name: string;
  bgClass: string;
  cloudBg: string;
  textColors: string[];
  accentColor: string;
}

export type LayoutMode = 'floating' | 'spiral' | 'categories' | 'cards';
