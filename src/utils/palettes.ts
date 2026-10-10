import { ColorPalette, ColorPaletteId } from '../types';

export const PALETTES: Record<ColorPaletteId, ColorPalette> = {
  noche: {
    id: 'noche',
    name: 'Obsidiana & Cal',
    bgClass: 'bg-[#090a0f]',
    cloudBg: '#090a0f',
    textColors: [
      '#ffffff', // High-contrast crisp white
      '#e4e4e7', // Platinum zinc
      '#a1a1aa', // Cool silver
      '#38bdf8', // Cyber sky
      '#4ade80', // Electric mint
      '#facc15', // Acid signal yellow
    ],
    accentColor: '#ffffff',
  },
  mediterraneo: {
    id: 'mediterraneo',
    name: 'Titanio & Neón',
    bgClass: 'bg-[#0b0c10]',
    cloudBg: '#0b0c10',
    textColors: [
      '#f4f4f5', // Zinc 100
      '#38bdf8', // Cyan
      '#818cf8', // Indigo light
      '#2dd4bf', // Teal light
      '#d4d4d8', // Zinc 300
      '#67e8f9', // Sky neon
    ],
    accentColor: '#38bdf8',
  },
  crema: {
    id: 'crema',
    name: 'Brutal Monocromo',
    bgClass: 'bg-[#09090b]',
    cloudBg: '#09090b',
    textColors: [
      '#fafafa', // Pure white
      '#d4d4d8', // Light zinc
      '#a1a1aa', // Mid zinc
      '#71717a', // Muted zinc
      '#ffffff', // Highlight white
      '#e4e4e7', // Zinc 200
    ],
    accentColor: '#fafafa',
  },
  bosque: {
    id: 'bosque',
    name: 'Esmeralda & Carbón',
    bgClass: 'bg-[#050d0a]',
    cloudBg: '#050d0a',
    textColors: [
      '#4ade80', // Neon emerald
      '#2dd4bf', // Electric mint
      '#86efac', // Soft green
      '#f4f4f5', // Contrast white
      '#a7f3d0', // Pale sage
      '#34d399', // Bright seafoam
    ],
    accentColor: '#4ade80',
  },
  fiesta: {
    id: 'fiesta',
    name: 'Ámbar Vulcano',
    bgClass: 'bg-[#0e0907]',
    cloudBg: '#0e0907',
    textColors: [
      '#fb923c', // Bright orange
      '#facc15', // Signal yellow
      '#f87171', // Coral flame
      '#ffffff', // Crisp white
      '#fdba74', // Peach glow
      '#e4e4e7', // Light neutral
    ],
    accentColor: '#fb923c',
  },
};
