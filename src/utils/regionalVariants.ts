import { RegionalUsage } from '../types';
import { getApiHeaders } from './apiKeyStorage';

/**
 * Standard Hispanic countries with flags and regions
 */
export const HISPANIC_COUNTRIES: Record<string, { name: string; flag: string; region: string }> = {
  espana: { name: 'España', flag: '🇪🇸', region: 'Europa' },
  mexico: { name: 'México', flag: '🇲🇽', region: 'Norteamérica' },
  argentina: { name: 'Argentina', flag: '🇦🇷', region: 'Cono Sur' },
  colombia: { name: 'Colombia', flag: '🇨🇴', region: 'Andina / Caribe' },
  chile: { name: 'Chile', flag: '🇨🇱', region: 'Cono Sur' },
  peru: { name: 'Perú', flag: '🇵🇪', region: 'Andina' },
  uruguay: { name: 'Uruguay', flag: '🇺🇾', region: 'Cono Sur' },
  venezuela: { name: 'Venezuela', flag: '🇻🇪', region: 'Caribe / Andina' },
  cuba: { name: 'Cuba', flag: '🇨🇺', region: 'Caribe' },
  republica_dominicana: { name: 'Rep. Dominicana', flag: '🇩🇴', region: 'Caribe' },
  puerto_rico: { name: 'Puerto Rico', flag: '🇵🇷', region: 'Caribe' },
  ecuador: { name: 'Ecuador', flag: '🇪🇨', region: 'Andina' },
  bolivia: { name: 'Bolivia', flag: '🇧🇴', region: 'Andina' },
  paraguay: { name: 'Paraguay', flag: '🇵🇾', region: 'Cono Sur' },
  guatemala: { name: 'Guatemala', flag: '🇬🇹', region: 'Centroamérica' },
  costa_rica: { name: 'Costa Rica', flag: '🇨🇷', region: 'Centroamérica' },
  panama: { name: 'Panamá', flag: '🇵🇦', region: 'Centroamérica' },
  honduras: { name: 'Honduras', flag: '🇭🇳', region: 'Centroamérica' },
  el_salvador: { name: 'El Salvador', flag: '🇸🇻', region: 'Centroamérica' },
  nicaragua: { name: 'Nicaragua', flag: '🇳🇮', region: 'Centroamérica' },
  guinea_ecuatorial: { name: 'Guinea Ecuatorial', flag: '🇬🇶', region: 'África' },
};

/**
 * Normalizes a noun string removing leading articles and accents for dictionary lookup.
 */
export function normalizeNounKey(word?: string, lemma?: string): string {
  const target = (lemma || word || '').trim().toLowerCase();
  const withoutArticle = target
    .replace(/^(el|la|los|las|un|una|unos|unas)\s+/i, '')
    .trim();
  return withoutArticle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Curated dialectal and geosinonym dictionary for Spanish nouns.
 * Zero-latency pedagogical precision for ELE classrooms.
 */
export const CURATED_REGIONAL_NOUNS: Record<string, RegionalUsage> = {
  alcachofa: {
    primaryTerm: 'la alcachofa',
    primaryCountries: ['España', 'México', 'Colombia', 'Perú', 'Chile', 'Venezuela', 'Ecuador', 'Centroamérica'],
    primaryFlags: ['🇪🇸', '🇲🇽', '🇨🇴', '🇵🇪', '🇨🇱', '🇻🇪'],
    variants: [
      {
        countries: ['Argentina', 'Uruguay', 'Paraguay'],
        flags: ['🇦🇷', '🇺🇾', '🇵🇾'],
        variant: 'el alcaucil',
        note: 'Término estándar cotidiano y de mercado en el Río de la Plata (del árabe hispánico al-qabsíl). Ambas formas designan exactamente la misma hortaliza.',
      },
    ],
    explanation: 'En la gran mayoría de países hispanohablantes y en España se utiliza "alcachofa", pero en Argentina y Uruguay la forma estándar exclusiva es "alcaucil".',
  },
  alcaucil: {
    primaryTerm: 'el alcaucil',
    primaryCountries: ['Argentina', 'Uruguay', 'Paraguay'],
    primaryFlags: ['🇦🇷', '🇺🇾', '🇵🇾'],
    variants: [
      {
        countries: ['España', 'México', 'Colombia', 'Chile', 'Perú', 'y resto de Hispanoamérica'],
        flags: ['🇪🇸', '🇲🇽', '🇨🇴', '🇨🇱', '🇵🇪'],
        variant: 'la alcachofa',
        note: 'Forma general mayoritaria en el mundo hispanohablante.',
      },
    ],
    explanation: 'Voz rioplatense tradicional para designar la alcachofa.',
  },
  aguacate: {
    primaryTerm: 'el aguacate',
    primaryCountries: ['México', 'España', 'Colombia', 'Venezuela', 'Guatemala', 'Costa Rica', 'Cuba', 'Rep. Dominicana'],
    primaryFlags: ['🇲🇽', '🇪🇸', '🇨🇴', '🇻🇪', '🇬🇹', '🇨🇷'],
    variants: [
      {
        countries: ['Argentina', 'Chile', 'Perú', 'Uruguay', 'Bolivia'],
        flags: ['🇦🇷', '🇨🇱', '🇵🇪', '🇺🇾', '🇧🇴'],
        variant: 'la palta',
        note: 'Proviene del quechua "pallta". Es el nombre estándar absoluto en la región andina y el Cono Sur.',
      },
    ],
    explanation: '"Aguacate" (del náhuatl ahuácatl) predomina en el norte, Caribe y España; en el Cono Sur y la zona andina se usa exclusivamente "palta".',
  },
  palta: {
    primaryTerm: 'la palta',
    primaryCountries: ['Argentina', 'Chile', 'Perú', 'Uruguay', 'Bolivia'],
    primaryFlags: ['🇦🇷', '🇨🇱', '🇵🇪', '🇺🇾', '🇧🇴'],
    variants: [
      {
        countries: ['México', 'España', 'Colombia', 'Venezuela', 'Centroamérica'],
        flags: ['🇲🇽', '🇪🇸', '🇨🇴', '🇻🇪'],
        variant: 'el aguacate',
        note: 'Voz de origen náhuatl mayoritaria en el resto de Hispanoamérica y España.',
      },
    ],
    explanation: 'Término de origen quechua para el fruto del aguacate en el Cono Sur y región andina.',
  },
  fresa: {
    primaryTerm: 'la fresa',
    primaryCountries: ['España', 'México', 'Colombia', 'Venezuela', 'Perú', 'Ecuador', 'Centroamérica'],
    primaryFlags: ['🇪🇸', '🇲🇽', '🇨🇴', '🇻🇪', '🇵🇪'],
    variants: [
      {
        countries: ['Argentina', 'Chile', 'Uruguay', 'Paraguay'],
        flags: ['🇦🇷', '🇨🇱', '🇺🇾', '🇵🇾'],
        variant: 'la frutilla',
        note: 'Diminutivo tradicional adoptado de forma estándar en el Cono Sur para las fresas comerciales y silvestres.',
      },
    ],
    explanation: 'En España y la mayor parte de América se dice "fresa", mientras que en Argentina, Chile, Uruguay y Paraguay se denomina siempre "frutilla".',
  },
  frutilla: {
    primaryTerm: 'la frutilla',
    primaryCountries: ['Argentina', 'Chile', 'Uruguay', 'Paraguay'],
    primaryFlags: ['🇦🇷', '🇨🇱', '🇺🇾', '🇵🇾'],
    variants: [
      {
        countries: ['España', 'México', 'Colombia', 'Venezuela', 'Perú', 'Centroamérica'],
        flags: ['🇪🇸', '🇲🇽', '🇨🇴', '🇻🇪', '🇵🇪'],
        variant: 'la fresa',
        note: 'Término estándar internacional en el resto del ámbito hispanohablante.',
      },
    ],
    explanation: 'Forma propia del Cono Sur para la fresa.',
  },
  patata: {
    primaryTerm: 'la patata',
    primaryCountries: ['España'],
    primaryFlags: ['🇪🇸'],
    variants: [
      {
        countries: ['Toda Hispanoamérica (México, Argentina, Colombia, Chile, Perú, etc.)', 'Canarias y Andalucía'],
        flags: ['🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱', '🇵🇪'],
        variant: 'la papa',
        note: 'Proviene directamente del quechua "papa". En toda América Latina se utiliza "papa" sin excepción.',
      },
    ],
    explanation: 'En España se consolidó históricamente "patata" (cruce entre papa y batata), mientras que en toda América se conserva la voz quechua original "papa".',
  },
  papa: {
    primaryTerm: 'la papa',
    primaryCountries: ['México', 'Argentina', 'Colombia', 'Chile', 'Perú', 'Venezuela', 'Ecuador', 'Uruguay', 'Canarias (España)'],
    primaryFlags: ['🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱', '🇵🇪', '🇺🇾'],
    variants: [
      {
        countries: ['España peninsular'],
        flags: ['🇪🇸'],
        variant: 'la patata',
        note: 'Término estándar generalizado en España peninsular.',
      },
    ],
    explanation: '"Papa" es la palabra originaria quechua adoptada en toda América Latina.',
  },
  calabacin: {
    primaryTerm: 'el calabacín',
    primaryCountries: ['España', 'Colombia', 'Venezuela', 'Ecuador'],
    primaryFlags: ['🇪🇸', '🇨🇴', '🇻🇪', '🇪🇨'],
    variants: [
      {
        countries: ['México'],
        flags: ['🇲🇽'],
        variant: 'la calabacita',
        note: 'En México se utiliza comúnmente en diminutivo.',
      },
      {
        countries: ['Argentina', 'Uruguay'],
        flags: ['🇦🇷', '🇺🇾'],
        variant: 'el zapallito / zucchini',
        note: 'Zapallito de tronco o zuchini en verdulerías.',
      },
      {
        countries: ['Chile', 'Perú'],
        flags: ['🇨🇱', '🇵🇪'],
        variant: 'el zapallito italiano',
        note: 'Distingue esta variedad alargada del zapallo tradicional.',
      },
    ],
    explanation: 'Gran variedad de nombres en la cocina hispana según la influencia indígena (zapallo) o europea (calabacín/zucchini).',
  },
  pimiento: {
    primaryTerm: 'el pimiento',
    primaryCountries: ['España', 'Colombia', 'Ecuador'],
    primaryFlags: ['🇪🇸', '🇨🇴', '🇪🇨'],
    variants: [
      {
        countries: ['Argentina', 'Uruguay', 'Paraguay'],
        flags: ['🇦🇷', '🇺🇾', '🇵🇾'],
        variant: 'el morrón',
        note: 'Se llama morrón rojo, verde o amarillo; "pimiento" casi no se emplea para la hortaliza fresca.',
      },
      {
        countries: ['México'],
        flags: ['🇲🇽'],
        variant: 'el pimiento morrón / chile dulce',
        note: 'Para diferenciarlo de los chiles picantes de la cocina mexicana.',
      },
      {
        countries: ['Costa Rica', 'Nicaragua'],
        flags: ['🇨🇷', '🇳🇮'],
        variant: 'el chile dulce',
        note: 'Variedad no picante de pimiento dulce.',
      },
    ],
    explanation: 'En el Cono Sur se le conoce unánimemente como "morrón", en España como "pimiento" y en México y Centroamérica como "pimiento morrón" o "chile dulce".',
  },
  morron: {
    primaryTerm: 'el morrón',
    primaryCountries: ['Argentina', 'Uruguay', 'Paraguay', 'Chile'],
    primaryFlags: ['🇦🇷', '🇺🇾', '🇵🇾', '🇨🇱'],
    variants: [
      {
        countries: ['España', 'Colombia'],
        flags: ['🇪🇸', '🇨🇴'],
        variant: 'el pimiento',
        note: 'Término estándar común.',
      },
      {
        countries: ['México'],
        flags: ['🇲🇽'],
        variant: 'el chile morrón',
        note: 'Para distinguirlo de chiles picantes.',
      },
    ],
    explanation: 'Denominación rioplatense y del sur para el pimiento común.',
  },
  judias: {
    primaryTerm: 'las judías / alubias',
    primaryCountries: ['España'],
    primaryFlags: ['🇪🇸'],
    variants: [
      {
        countries: ['México', 'Colombia', 'Centroamérica', 'Perú'],
        flags: ['🇲🇽', '🇨🇴', '🇬🇹', '🇵🇪'],
        variant: 'los frijoles (o fríjoles)',
        note: 'Voz de uso masivo e indiscutible en México y buena parte de Latinoamérica.',
      },
      {
        countries: ['Argentina', 'Chile', 'Uruguay'],
        flags: ['🇦🇷', '🇨🇱', '🇺🇾'],
        variant: 'los porotos',
        note: 'Del quechua "purutu". Uso estándar y universal en el Cono Sur.',
      },
      {
        countries: ['Venezuela', 'Caribe'],
        flags: ['🇻🇪', '🇨🇺'],
        variant: 'las caraotas',
        note: 'Especialmente las caraotas negras, base del plato nacional pabellón criollo.',
      },
    ],
    explanation: 'Uno de los ejemplos clásicos de variación léxica panhispánica: judías en España, frijoles en México/Colombia, porotos en Cono Sur y caraotas en Venezuela.',
  },
  frijoles: {
    primaryTerm: 'los frijoles',
    primaryCountries: ['México', 'Colombia', 'Guatemala', 'Costa Rica', 'Honduras', 'Cuba', 'Perú'],
    primaryFlags: ['🇲🇽', '🇨🇴', '🇬🇹', '🇨🇷', '🇨🇺', '🇵🇪'],
    variants: [
      {
        countries: ['España'],
        flags: ['🇪🇸'],
        variant: 'las judías / alubias',
        note: 'En España se suele reservar "frijol" solo para variedades específicas.',
      },
      {
        countries: ['Argentina', 'Chile', 'Uruguay'],
        flags: ['🇦🇷', '🇨🇱', '🇺🇾'],
        variant: 'los porotos',
        note: 'Del quechua "purutu".',
      },
      {
        countries: ['Venezuela'],
        flags: ['🇻🇪'],
        variant: 'las caraotas',
        note: 'Granos negros o rojos en guisos tradicionales.',
      },
    ],
    explanation: 'Término central en México y el Caribe para las legumbres secas.',
  },
  porotos: {
    primaryTerm: 'los porotos',
    primaryCountries: ['Argentina', 'Chile', 'Uruguay', 'Paraguay', 'Bolivia'],
    primaryFlags: ['🇦🇷', '🇨🇱', '🇺🇾', '🇵🇾', '🇧🇴'],
    variants: [
      {
        countries: ['México', 'Colombia', 'Centroamérica'],
        flags: ['🇲🇽', '🇨🇴', '🇬🇹'],
        variant: 'los frijoles',
        note: 'Término general en Norteamérica y Centroamérica.',
      },
      {
        countries: ['España'],
        flags: ['🇪🇸'],
        variant: 'las judías / alubias',
        note: 'En España "judías blancas" o "alubias".',
      },
    ],
    explanation: 'Voz quechua "purutu" plenamente asimilada en el Cono Sur.',
  },
  guisantes: {
    primaryTerm: 'los guisantes',
    primaryCountries: ['España'],
    primaryFlags: ['🇪🇸'],
    variants: [
      {
        countries: ['Argentina', 'Chile', 'Uruguay', 'Colombia', 'Perú', 'Venezuela'],
        flags: ['🇦🇷', '🇨🇱', '🇺🇾', '🇨🇴', '🇵🇪', '🇻🇪'],
        variant: 'las arvejas',
        note: 'Término general en casi toda Sudamérica.',
      },
      {
        countries: ['México'],
        flags: ['🇲🇽'],
        variant: 'los chícharos',
        note: 'Voz estándar en la cocina mexicana.',
      },
    ],
    explanation: 'En España se llaman guisantes, en México chícharos y en el resto de América Latina arvejas.',
  },
  chicharos: {
    primaryTerm: 'los chícharos',
    primaryCountries: ['México'],
    primaryFlags: ['🇲🇽'],
    variants: [
      {
        countries: ['España'],
        flags: ['🇪🇸'],
        variant: 'los guisantes',
        note: 'Término común en España.',
      },
      {
        countries: ['Argentina', 'Chile', 'Colombia', 'Perú', 'Uruguay'],
        flags: ['🇦🇷', '🇨🇱', '🇨🇴', '🇵🇪'],
        variant: 'las arvejas',
        note: 'Forma estándar sudamericana.',
      },
    ],
    explanation: 'Forma mexicana para los guisantes o arvejas.',
  },
  platano: {
    primaryTerm: 'el plátano',
    primaryCountries: ['España', 'México', 'Colombia', 'Perú', 'Ecuador'],
    primaryFlags: ['🇪🇸', '🇲🇽', '🇨🇴', '🇵🇪', '🇪🇨'],
    variants: [
      {
        countries: ['Argentina', 'Uruguay', 'Chile', 'Paraguay'],
        flags: ['🇦🇷', '🇺🇾', '🇨🇱', '🇵🇾'],
        variant: 'la banana',
        note: 'Para la fruta dulce de consumo directo.',
      },
      {
        countries: ['Venezuela'],
        flags: ['🇻🇪'],
        variant: 'el cambur / plátano',
        note: '"Cambur" para la fruta dulce y "plátano" para el plátano verde o maduro de cocción.',
      },
      {
        countries: ['Rep. Dominicana', 'Puerto Rico', 'Centroamérica'],
        flags: ['🇩🇴', '🇵🇷', '🇬🇹'],
        variant: 'el guineo / plátano macho',
        note: '"Guineo" es la fruta amarilla dulce.',
      },
    ],
    explanation: 'Diferenciación crucial: en España y México "plátano" es la fruta dulce; en el Cono Sur "banana"; en Venezuela "cambur"; y en el Caribe "guineo".',
  },
  banana: {
    primaryTerm: 'la banana',
    primaryCountries: ['Argentina', 'Uruguay', 'Chile', 'Paraguay'],
    primaryFlags: ['🇦🇷', '🇺🇾', '🇨🇱', '🇵🇾'],
    variants: [
      {
        countries: ['España', 'México', 'Colombia', 'Perú'],
        flags: ['🇪🇸', '🇲🇽', '🇨🇴', '🇵🇪'],
        variant: 'el plátano',
        note: 'Término estándar común.',
      },
      {
        countries: ['Venezuela'],
        flags: ['🇻🇪'],
        variant: 'el cambur',
        note: 'Voz típica venezolana.',
      },
    ],
    explanation: 'Forma estándar rioplatense y del sur para el plátano dulce.',
  },
  cacahuete: {
    primaryTerm: 'el cacahuete',
    primaryCountries: ['España'],
    primaryFlags: ['🇪🇸'],
    variants: [
      {
        countries: ['México', 'Centroamérica'],
        flags: ['🇲🇽', '🇬🇹', '🇸🇻'],
        variant: 'el cacahuate',
        note: 'Directo del náhuatl "tlalcacahuatl" (cacao de tierra).',
      },
      {
        countries: ['Argentina', 'Chile', 'Uruguay', 'Colombia', 'Perú', 'Venezuela', 'Cuba'],
        flags: ['🇦🇷', '🇨🇱', '🇺🇾', '🇨🇴', '🇵🇪', '🇻🇪', '🇨🇺'],
        variant: 'el maní',
        note: 'Del taíno "maní". Forma de uso generalizado en toda Sudamérica y el Caribe.',
      },
    ],
    explanation: 'En España se dice "cacahuete", en México "cacahuate" y en Sudamérica y las Antillas "maní".',
  },
  mani: {
    primaryTerm: 'el maní',
    primaryCountries: ['Argentina', 'Chile', 'Uruguay', 'Colombia', 'Perú', 'Venezuela', 'Cuba', 'Ecuador', 'Bolivia'],
    primaryFlags: ['🇦🇷', '🇨🇱', '🇺🇾', '🇨🇴', '🇵🇪', '🇻🇪', '🇨🇺'],
    variants: [
      {
        countries: ['España'],
        flags: ['🇪🇸'],
        variant: 'el cacahuete',
        note: 'Forma común en España.',
      },
      {
        countries: ['México'],
        flags: ['🇲🇽'],
        variant: 'el cacahuate',
        note: 'Del náhuatl.',
      },
    ],
    explanation: 'Palabra de raíz taína adoptada en casi toda Sudamérica.',
  },
  melocoton: {
    primaryTerm: 'el melocotón',
    primaryCountries: ['España'],
    primaryFlags: ['🇪🇸'],
    variants: [
      {
        countries: ['Toda Hispanoamérica (México, Argentina, Colombia, Chile, Perú, etc.)'],
        flags: ['🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱', '🇵🇪'],
        variant: 'el durazno',
        note: 'Forma indiscutible en toda América Latina para la fruta y el árbol.',
      },
    ],
    explanation: 'En España se llama "melocotón" mientras que en toda Hispanoamérica se le conoce únicamente como "durazno".',
  },
  durazno: {
    primaryTerm: 'el durazno',
    primaryCountries: ['México', 'Argentina', 'Colombia', 'Chile', 'Perú', 'Venezuela', 'Ecuador', 'Uruguay'],
    primaryFlags: ['🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱', '🇵🇪', '🇻🇪'],
    variants: [
      {
        countries: ['España'],
        flags: ['🇪🇸'],
        variant: 'el melocotón',
        note: 'Forma estándar en España.',
      },
    ],
    explanation: 'Término americano para el melocotón.',
  },
  maiz: {
    primaryTerm: 'el maíz / la mazorca',
    primaryCountries: ['España', 'Colombia', 'Cuba'],
    primaryFlags: ['🇪🇸', '🇨🇴', '🇨🇺'],
    variants: [
      {
        countries: ['México', 'Centroamérica'],
        flags: ['🇲🇽', '🇬🇹', '🇸🇻'],
        variant: 'el elote',
        note: 'Del náhuatl "élotl", la mazorca tierna cocida o asada.',
      },
      {
        countries: ['Argentina', 'Chile', 'Perú', 'Bolivia', 'Uruguay'],
        flags: ['🇦🇷', '🇨🇱', '🇵🇪', '🇧🇴', '🇺🇾'],
        variant: 'el choclo',
        note: 'Del quechua "choqllo", la mazorca tierna comestible.',
      },
      {
        countries: ['Venezuela'],
        flags: ['🇻🇪'],
        variant: 'el jojoto',
        note: 'Voz autóctona venezolana para la mazorca tierna.',
      },
    ],
    explanation: 'Uno de los vegetales con mayor identidad lingüística originaria: elote en México (náhuatl), choclo en la zona andina/sur (quechua) y jojoto en Venezuela.',
  },
  elote: {
    primaryTerm: 'el elote',
    primaryCountries: ['México', 'Guatemala', 'Honduras', 'El Salvador'],
    primaryFlags: ['🇲🇽', '🇬🇹', '🇭🇳', '🇸🇻'],
    variants: [
      {
        countries: ['Argentina', 'Chile', 'Perú', 'Bolivia', 'Uruguay'],
        flags: ['🇦🇷', '🇨🇱', '🇵🇪', '🇧🇴', '🇺🇾'],
        variant: 'el choclo',
        note: 'Voz quechua en el sur.',
      },
      {
        countries: ['España', 'Colombia'],
        flags: ['🇪🇸', '🇨🇴'],
        variant: 'la mazorca de maíz',
        note: 'Término estándar.',
      },
    ],
    explanation: 'Mazorca tierna en México y Centroamérica.',
  },
  choclo: {
    primaryTerm: 'el choclo',
    primaryCountries: ['Argentina', 'Chile', 'Perú', 'Bolivia', 'Uruguay', 'Ecuador'],
    primaryFlags: ['🇦🇷', '🇨🇱', '🇵🇪', '🇧🇴', '🇺🇾', '🇪🇨'],
    variants: [
      {
        countries: ['México', 'Centroamérica'],
        flags: ['🇲🇽', '🇬🇹'],
        variant: 'el elote',
        note: 'Voz de raíz náhuatl.',
      },
      {
        countries: ['España', 'Colombia'],
        flags: ['🇪🇸', '🇨🇴'],
        variant: 'la mazorca de maíz',
        note: 'Término común en España.',
      },
    ],
    explanation: 'Mazorca de maíz en el Cono Sur y región andina.',
  },
  autobus: {
    primaryTerm: 'el autobús',
    primaryCountries: ['España', 'México (formal)', 'Colombia (formal)'],
    primaryFlags: ['🇪🇸', '🇲🇽', '🇨🇴'],
    variants: [
      {
        countries: ['Argentina'],
        flags: ['🇦🇷'],
        variant: 'el colectivo / bondi',
        note: 'Símbolo urbano cultural de Buenos Aires y toda Argentina.',
      },
      {
        countries: ['México'],
        flags: ['🇲🇽'],
        variant: 'el camión / microbús',
        note: 'En la calle se dice normalmente "tomar el camión".',
      },
      {
        countries: ['Cuba', 'Rep. Dominicana', 'Puerto Rico', 'Canarias (España)'],
        flags: ['🇨🇺', '🇩🇴', '🇵🇷'],
        variant: 'la guagua',
        note: 'Famosa voz caribeña y canaria de transporte público.',
      },
      {
        countries: ['Chile'],
        flags: ['🇨🇱'],
        variant: 'la micro',
        note: 'Vehículo del transporte urbano santiaguino y regional.',
      },
      {
        countries: ['Colombia'],
        flags: ['🇨🇴'],
        variant: 'el bus / la buseta',
        note: 'Transporte público urbano.',
      },
      {
        countries: ['Uruguay'],
        flags: ['🇺🇾'],
        variant: 'el ómnibus',
        note: 'Término tradicional y formal extendido.',
      },
    ],
    explanation: 'El transporte urbano colectivo tiene una de las variedades de apodos y términos más ricas de todo el léxico hispano.',
  },
  coche: {
    primaryTerm: 'el coche',
    primaryCountries: ['España'],
    primaryFlags: ['🇪🇸'],
    variants: [
      {
        countries: ['México', 'Colombia', 'Venezuela', 'Centroamérica'],
        flags: ['🇲🇽', '🇨🇴', '🇻🇪', '🇬🇹'],
        variant: 'el carro',
        note: 'Voz cotidiana común para automóvil.',
      },
      {
        countries: ['Argentina', 'Chile', 'Uruguay', 'Perú'],
        flags: ['🇦🇷', '🇨🇱', '🇺🇾', '🇵🇪'],
        variant: 'el auto',
        note: 'Abreviatura de automóvil universal en el Cono Sur.',
      },
    ],
    explanation: 'En España se dice "coche"; en México, Colombia y el norte "carro"; y en Argentina, Chile y Uruguay "auto".',
  },
  boligrafo: {
    primaryTerm: 'el bolígrafo',
    primaryCountries: ['España'],
    primaryFlags: ['🇪🇸'],
    variants: [
      {
        countries: ['Argentina', 'Uruguay', 'Paraguay'],
        flags: ['🇦🇷', '🇺🇾', '🇵🇾'],
        variant: 'la birome',
        note: 'Homenaje a su coinventor László Bíró, radicado en Argentina.',
      },
      {
        countries: ['México'],
        flags: ['🇲🇽'],
        variant: 'la pluma',
        note: 'Uso general en oficinas y escuelas mexicanas.',
      },
      {
        countries: ['Colombia'],
        flags: ['🇨🇴'],
        variant: 'el esfero',
        note: 'Por la esfera giratoria de la punta.',
      },
      {
        countries: ['Chile'],
        flags: ['🇨🇱'],
        variant: 'el lápiz pasta',
        note: 'Término estándar chileno.',
      },
    ],
    explanation: 'Bolígrafo en España, birome en Argentina, pluma en México, esfero en Colombia y lápiz pasta en Chile.',
  },
  gafas: {
    primaryTerm: 'las gafas',
    primaryCountries: ['España', 'Colombia'],
    primaryFlags: ['🇪🇸', '🇨🇴'],
    variants: [
      {
        countries: ['México', 'Chile', 'Perú', 'Venezuela'],
        flags: ['🇲🇽', '🇨🇱', '🇵🇪', '🇻🇪'],
        variant: 'los lentes',
        note: 'Término común para lentes de aumento o lentes de sol.',
      },
      {
        countries: ['Argentina', 'Uruguay'],
        flags: ['🇦🇷', '🇺🇾'],
        variant: 'los anteojos (o lentes)',
        note: 'Uso muy extendido de "anteojos".',
      },
    ],
    explanation: 'Gafas en España y Colombia, anteojos en el Río de la Plata y lentes en México y gran parte de Sudamérica.',
  },
  nevera: {
    primaryTerm: 'la nevera / el frigorífico',
    primaryCountries: ['España', 'Colombia', 'Venezuela'],
    primaryFlags: ['🇪🇸', '🇨🇴', '🇻🇪'],
    variants: [
      {
        countries: ['Argentina', 'Uruguay', 'Paraguay'],
        flags: ['🇦🇷', '🇺🇾', '🇵🇾'],
        variant: 'la heladera',
        note: 'Electrodoméstico indispensable en todos los hogares rioplatenses.',
      },
      {
        countries: ['México', 'Chile', 'Perú'],
        flags: ['🇲🇽', '🇨🇱', '🇵🇪'],
        variant: 'el refrigerador (el refri)',
        note: 'Término cotidiano y comercial estándar.',
      },
    ],
    explanation: 'Nevera o frigorífico en España, heladera en Argentina y Uruguay, y refrigerador en México y Chile.',
  },
  piso: {
    primaryTerm: 'el piso',
    primaryCountries: ['España'],
    primaryFlags: ['🇪🇸'],
    variants: [
      {
        countries: ['Argentina', 'Chile', 'Perú', 'México'],
        flags: ['🇦🇷', '🇨🇱', '🇵🇪', '🇲🇽'],
        variant: 'el departamento (depto)',
        note: 'Vivienda individual en un edificio.',
      },
      {
        countries: ['Colombia', 'Venezuela', 'Centroamérica'],
        flags: ['🇨🇴', '🇻🇪', '🇬🇹'],
        variant: 'el apartamento',
        note: 'Forma general caribeña y andina.',
      },
    ],
    explanation: 'En España una vivienda dentro de un bloque es un "piso"; en el Cono Sur y México es un "departamento" y en Colombia un "apartamento".',
  },
  piscina: {
    primaryTerm: 'la piscina',
    primaryCountries: ['España', 'Colombia', 'Chile', 'Perú', 'Venezuela', 'Ecuador'],
    primaryFlags: ['🇪🇸', '🇨🇴', '🇨🇱', '🇵🇪', '🇻🇪'],
    variants: [
      {
        countries: ['México'],
        flags: ['🇲🇽'],
        variant: 'la alberca',
        note: 'Del árabe al-birkah. Término universal en todo México.',
      },
      {
        countries: ['Argentina', 'Uruguay', 'Bolivia'],
        flags: ['🇦🇷', '🇺🇾', '🇧🇴'],
        variant: 'la pileta',
        note: 'Pileta de natación o recreativa.',
      },
    ],
    explanation: 'Piscina en la mayoría de países, alberca en México y pileta en Argentina y Uruguay.',
  },
  tarta: {
    primaryTerm: 'la tarta',
    primaryCountries: ['España'],
    primaryFlags: ['🇪🇸'],
    variants: [
      {
        countries: ['México'],
        flags: ['🇲🇽'],
        variant: 'el pastel',
        note: 'Dulce horneado con velas para cumpleaños (en México "torta" es un bocadillo/sándwich en pan telera).',
      },
      {
        countries: ['Argentina', 'Uruguay', 'Venezuela', 'Chile'],
        flags: ['🇦🇷', '🇺🇾', '🇻🇪', '🇨🇱'],
        variant: 'la torta',
        note: 'Torta dulce de cumpleaños o celebración.',
      },
      {
        countries: ['Colombia'],
        flags: ['🇨🇴'],
        variant: 'la torta / el ponqué',
        note: 'Del inglés "pound cake".',
      },
    ],
    explanation: 'Cuidado didáctico: En España se dice "tarta"; en Argentina "torta"; en México "pastel" (¡ya que en México una torta es un emparedado!).',
  },
  chaqueta: {
    primaryTerm: 'la chaqueta',
    primaryCountries: ['España', 'Colombia'],
    primaryFlags: ['🇪🇸', '🇨🇴'],
    variants: [
      {
        countries: ['México'],
        flags: ['🇲🇽'],
        variant: 'la chamarra',
        note: 'Prenda de abrigo exterior.',
      },
      {
        countries: ['Argentina', 'Uruguay'],
        flags: ['🇦🇷', '🇺🇾'],
        variant: 'la campera',
        note: 'Abrigo casual de invierno o media estación.',
      },
      {
        countries: ['Chile'],
        flags: ['🇨🇱'],
        variant: 'la chaqueta / parca',
        note: 'Uso de parca para abrigos impermeables o gruesos.',
      },
    ],
    explanation: 'Chaqueta en España, chamarra en México y campera en Argentina.',
  },
  acera: {
    primaryTerm: 'la acera',
    primaryCountries: ['España', 'Colombia (también andén)', 'Venezuela'],
    primaryFlags: ['🇪🇸', '🇨🇴', '🇻🇪'],
    variants: [
      {
        countries: ['Argentina', 'Uruguay', 'Chile', 'Perú', 'Paraguay'],
        flags: ['🇦🇷', '🇺🇾', '🇨🇱', '🇵🇪', '🇵🇾'],
        variant: 'la vereda',
        note: 'Orilla peatonal de la calle por donde camina la gente.',
      },
      {
        countries: ['México', 'Guatemala'],
        flags: ['🇲🇽', '🇬🇹'],
        variant: 'la banqueta',
        note: 'Franja peatonal de la vía pública.',
      },
    ],
    explanation: 'Acera en España, banqueta en México y vereda en Argentina, Chile, Uruguay y Perú.',
  },
  palomitas: {
    primaryTerm: 'las palomitas de maíz',
    primaryCountries: ['España', 'México'],
    primaryFlags: ['🇪🇸', '🇲🇽'],
    variants: [
      {
        countries: ['Argentina'],
        flags: ['🇦🇷'],
        variant: 'el pochoclo',
        note: 'Acortamiento popular de pop y choclo.',
      },
      {
        countries: ['Chile'],
        flags: ['🇨🇱'],
        variant: 'las cabritas',
        note: 'Snack indispensable en los cines chilenos.',
      },
      {
        countries: ['Colombia'],
        flags: ['🇨🇴'],
        variant: 'las crispetas',
        note: 'Maíz pira inflado con sal o caramelo.',
      },
      {
        countries: ['Venezuela'],
        flags: ['🇻🇪'],
        variant: 'las cotufas',
        note: 'Del inglés comercial "corn to fry".',
      },
      {
        countries: ['Perú'],
        flags: ['🇵🇪'],
        variant: 'la canchita',
        note: 'Maíz inflado tostado tradicional.',
      },
      {
        countries: ['Uruguay'],
        flags: ['🇺🇾'],
        variant: 'el pop',
        note: 'Término estándar en cines uruguayos.',
      },
    ],
    explanation: 'Es la palabra con mayor número de variantes lúdicas en el mundo hispano: palomitas, pochoclo, cabritas, crispetas, cotufas, canchita y pop.',
  },
  calcetines: {
    primaryTerm: 'los calcetines',
    primaryCountries: ['España', 'México', 'Centroamérica'],
    primaryFlags: ['🇪🇸', '🇲🇽', '🇬🇹'],
    variants: [
      {
        countries: ['Argentina', 'Colombia', 'Chile', 'Uruguay', 'Venezuela', 'Perú'],
        flags: ['🇦🇷', '🇨🇴', '🇨🇱', '🇺🇾', '🇻🇪', '🇵🇪'],
        variant: 'las medias',
        note: 'Término cotidiano unisex para la prenda que cubre el pie.',
      },
    ],
    explanation: 'En España "calcetines" (reservando medias para las finas de mujer); en casi toda Sudamérica se dice "medias" para ambos.',
  },
  pajita: {
    primaryTerm: 'la pajita',
    primaryCountries: ['España', 'Argentina (también sorbete)'],
    primaryFlags: ['🇪🇸', '🇦🇷'],
    variants: [
      {
        countries: ['México'],
        flags: ['🇲🇽'],
        variant: 'el popote',
        note: 'Del náhuatl "popotli" (tallo de gramínea).',
      },
      {
        countries: ['Colombia', 'Venezuela'],
        flags: ['🇨🇴', '🇻🇪'],
        variant: 'el pitillo',
        note: 'Tubo para sorber bebidas.',
      },
      {
        countries: ['Chile', 'Perú', 'Ecuador'],
        flags: ['🇨🇱', '🇵🇪', '🇪🇨'],
        variant: 'la bombilla / el sorbete',
        note: 'En Chile bombilla; en Perú y Ecuador sorbete.',
      },
      {
        countries: ['Centroamérica (Guatemala, Costa Rica, El Salvador)'],
        flags: ['🇬🇹', '🇨🇷', '🇸🇻'],
        variant: 'la pajilla',
        note: 'Diminutivo común.',
      },
    ],
    explanation: 'Pajita en España, popote en México, pitillo en Colombia y sorbete/bombilla en el resto de América del Sur.',
  },
  aparcamiento: {
    primaryTerm: 'el aparcamiento / parking',
    primaryCountries: ['España'],
    primaryFlags: ['🇪🇸'],
    variants: [
      {
        countries: ['México', 'Argentina', 'Chile', 'Uruguay'],
        flags: ['🇲🇽', '🇦🇷', '🇨🇱', '🇺🇾'],
        variant: 'el estacionamiento',
        note: 'Lugar destinado para estacionar vehículos.',
      },
      {
        countries: ['Colombia', 'Venezuela', 'Ecuador'],
        flags: ['🇨🇴', '🇻🇪', '🇪🇨'],
        variant: 'el parqueadero',
        note: 'Espacio o edificio para parquear carros.',
      },
    ],
    explanation: 'Aparcamiento en España, estacionamiento en el Cono Sur y México, y parqueadero en Colombia y Venezuela.',
  },
  fontanero: {
    primaryTerm: 'el fontanero',
    primaryCountries: ['España'],
    primaryFlags: ['🇪🇸'],
    variants: [
      {
        countries: ['Toda Hispanoamérica (México, Argentina, Colombia, Chile, Perú, etc.)'],
        flags: ['🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱', '🇵🇪'],
        variant: 'el plomero',
        note: 'Profesional que instala y repara cañerías y tuberías de agua y gas.',
      },
    ],
    explanation: 'En España se le denomina fontanero mientras que en toda América Latina se utiliza plomero.',
  },
  ordenador: {
    primaryTerm: 'el ordenador',
    primaryCountries: ['España'],
    primaryFlags: ['🇪🇸'],
    variants: [
      {
        countries: ['México', 'Argentina', 'Perú', 'Centroamérica'],
        flags: ['🇲🇽', '🇦🇷', '🇵🇪', '🇬🇹'],
        variant: 'la computadora',
        note: 'Voz femenina más extendida en Latinoamérica.',
      },
      {
        countries: ['Colombia', 'Chile'],
        flags: ['🇨🇴', '🇨🇱'],
        variant: 'el computador',
        note: 'Voz masculina habitual en Colombia y Chile.',
      },
    ],
    explanation: 'En España se adoptó del francés "ordinateur" dando "ordenador", mientras que en América se caló del inglés "computer" dando "computadora" o "computador".',
  },
  cerillas: {
    primaryTerm: 'las cerillas',
    primaryCountries: ['España'],
    primaryFlags: ['🇪🇸'],
    variants: [
      {
        countries: ['Toda Hispanoamérica (México, Argentina, Colombia, Chile, etc.)'],
        flags: ['🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱', '🇵🇪'],
        variant: 'los fósforos',
        note: 'Palitos con cabeza inflamable para encender fuego.',
      },
    ],
    explanation: 'Cerillas en España y fósforos en toda América Latina.',
  },
  // Nouns with Panhispanic Universal Usage (Tomate, Cebolla, Ajo, etc.)
  tomate: {
    primaryTerm: 'el tomate',
    primaryCountries: ['Los 21 países hispanohablantes (España, México, Argentina, Colombia, Chile, Perú, etc.)'],
    primaryFlags: ['🇪🇸', '🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱', '🇵🇪'],
    variants: [
      {
        countries: ['México'],
        flags: ['🇲🇽'],
        variant: 'el jitomate (tomate rojo)',
        note: 'En México se distingue "jitomate" (rojo común) de "tomate" (el tomatillo verde con cáscara).',
      },
    ],
    explanation: 'Término de origen náhuatl (tomatl) universalmente comprendido en todo el mundo hispano.',
    isPanhispanicUniversal: true,
  },
  cebolla: {
    primaryTerm: 'la cebolla',
    primaryCountries: ['Los 21 países hispanohablantes (España, México, Argentina, Colombia, Chile, Perú, etc.)'],
    primaryFlags: ['🇪🇸', '🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱', '🇵🇪'],
    variants: [
      {
        countries: ['Argentina', 'Uruguay'],
        flags: ['🇦🇷', '🇺🇾'],
        variant: 'la cebolla de verdeo (para la cebolleta / cebollino)',
        note: 'Variedad verde tierna muy usada en empanadas criollas.',
      },
      {
        countries: ['México'],
        flags: ['🇲🇽'],
        variant: 'la cebolla cambray',
        note: 'Cebolletas asadas típicas en taquerías.',
      },
    ],
    explanation: 'Sustantivo panhispánico estándar sin variaciones en su acepción principal.',
    isPanhispanicUniversal: true,
  },
  zanahoria: {
    primaryTerm: 'la zanahoria',
    primaryCountries: ['Los 21 países hispanohablantes (España, México, Argentina, Colombia, Chile, Perú, etc.)'],
    primaryFlags: ['🇪🇸', '🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱', '🇵🇪'],
    variants: [],
    explanation: 'Sustantivo panhispánico universal con el mismo significado y forma en todo el mundo de habla hispana.',
    isPanhispanicUniversal: true,
  },
  berenjena: {
    primaryTerm: 'la berenjena',
    primaryCountries: ['Los 21 países hispanohablantes (España, México, Argentina, Colombia, Chile, Perú, etc.)'],
    primaryFlags: ['🇪🇸', '🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱', '🇵🇪'],
    variants: [],
    explanation: 'Sustantivo panhispánico estándar en todos los países de habla hispana.',
    isPanhispanicUniversal: true,
  },
  espinacas: {
    primaryTerm: 'las espinacas / la espinaca',
    primaryCountries: ['Los 21 países hispanohablantes (España, México, Argentina, Colombia, Chile, Perú, etc.)'],
    primaryFlags: ['🇪🇸', '🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱', '🇵🇪'],
    variants: [],
    explanation: 'Término de uso panhispánico (se usa en plural "espinacas" en España y frecuentemente en singular "espinaca" en América Latina).',
    isPanhispanicUniversal: true,
  },
  espinaca: {
    primaryTerm: 'la espinaca / las espinacas',
    primaryCountries: ['Los 21 países hispanohablantes (España, México, Argentina, Colombia, Chile, Perú, etc.)'],
    primaryFlags: ['🇪🇸', '🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱', '🇵🇪'],
    variants: [],
    explanation: 'Término de uso panhispánico común.',
    isPanhispanicUniversal: true,
  },
  ajo: {
    primaryTerm: 'el ajo',
    primaryCountries: ['Los 21 países hispanohablantes (España, México, Argentina, Colombia, Chile, Perú, etc.)'],
    primaryFlags: ['🇪🇸', '🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱', '🇵🇪'],
    variants: [],
    explanation: 'Ingrediente y sustantivo universal en toda la gastronomía del mundo hispanohablante.',
    isPanhispanicUniversal: true,
  },
  lechuga: {
    primaryTerm: 'la lechuga',
    primaryCountries: ['Los 21 países hispanohablantes (España, México, Argentina, Colombia, Chile, Perú, etc.)'],
    primaryFlags: ['🇪🇸', '🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱', '🇵🇪'],
    variants: [],
    explanation: 'Sustantivo panhispánico universal en los 21 países.',
    isPanhispanicUniversal: true,
  },
  pepino: {
    primaryTerm: 'el pepino',
    primaryCountries: ['Los 21 países hispanohablantes (España, México, Argentina, Colombia, Chile, Perú, etc.)'],
    primaryFlags: ['🇪🇸', '🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱', '🇵🇪'],
    variants: [],
    explanation: 'Sustantivo panhispánico sin variaciones regionales significativas.',
    isPanhispanicUniversal: true,
  },
  puerro: {
    primaryTerm: 'el puerro',
    primaryCountries: ['España', 'Argentina', 'Uruguay', 'Colombia', 'México'],
    primaryFlags: ['🇪🇸', '🇦🇷', '🇺🇾', '🇨🇴', '🇲🇽'],
    variants: [
      {
        countries: ['Chile', 'Perú'],
        flags: ['🇨🇱', '🇵🇪'],
        variant: 'el poro',
        note: 'Variante fonética tradicional en la zona andina pacífica.',
      },
    ],
    explanation: 'Puerro en la mayor parte de Hispanoamérica y España; poro en Chile y Perú.',
  },
  coliflor: {
    primaryTerm: 'la coliflor',
    primaryCountries: ['Los 21 países hispanohablantes'],
    primaryFlags: ['🇪🇸', '🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱'],
    variants: [],
    explanation: 'Sustantivo panhispánico estándar en todo el mundo hispanohablante.',
    isPanhispanicUniversal: true,
  },
  brocoli: {
    primaryTerm: 'el brócoli',
    primaryCountries: ['Los 21 países hispanohablantes'],
    primaryFlags: ['🇪🇸', '🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱'],
    variants: [
      {
        countries: ['España (regional)'],
        flags: ['🇪🇸'],
        variant: 'el brécol',
        note: 'Forma alternativa tradicional en España.',
      },
    ],
    explanation: 'Sustantivo estándar generalizado en todos los países de habla hispana.',
    isPanhispanicUniversal: true,
  },
  esparragos: {
    primaryTerm: 'los espárragos',
    primaryCountries: ['Los 21 países hispanohablantes'],
    primaryFlags: ['🇪🇸', '🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱', '🇵🇪'],
    variants: [],
    explanation: 'Sustantivo panhispánico universal.',
    isPanhispanicUniversal: true,
  },
  esparrago: {
    primaryTerm: 'el espárrago',
    primaryCountries: ['Los 21 países hispanohablantes'],
    primaryFlags: ['🇪🇸', '🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱', '🇵🇪'],
    variants: [],
    explanation: 'Sustantivo panhispánico universal.',
    isPanhispanicUniversal: true,
  },
};

// Aliases
CURATED_REGIONAL_NOUNS['alubias'] = CURATED_REGIONAL_NOUNS['judias'];
CURATED_REGIONAL_NOUNS['judia'] = CURATED_REGIONAL_NOUNS['judias'];
CURATED_REGIONAL_NOUNS['frijol'] = CURATED_REGIONAL_NOUNS['frijoles'];
CURATED_REGIONAL_NOUNS['poroto'] = CURATED_REGIONAL_NOUNS['porotos'];
CURATED_REGIONAL_NOUNS['guisante'] = CURATED_REGIONAL_NOUNS['guisantes'];
CURATED_REGIONAL_NOUNS['arveja'] = CURATED_REGIONAL_NOUNS['guisantes'];
CURATED_REGIONAL_NOUNS['arvejas'] = CURATED_REGIONAL_NOUNS['guisantes'];
CURATED_REGIONAL_NOUNS['chicharo'] = CURATED_REGIONAL_NOUNS['chicharos'];
CURATED_REGIONAL_NOUNS['cacahuates'] = CURATED_REGIONAL_NOUNS['cacahuete'];
CURATED_REGIONAL_NOUNS['cacahuetes'] = CURATED_REGIONAL_NOUNS['cacahuete'];
CURATED_REGIONAL_NOUNS['pimientos'] = CURATED_REGIONAL_NOUNS['pimiento'];
CURATED_REGIONAL_NOUNS['calabacines'] = CURATED_REGIONAL_NOUNS['calabacin'];
CURATED_REGIONAL_NOUNS['patatas'] = CURATED_REGIONAL_NOUNS['patata'];
CURATED_REGIONAL_NOUNS['papas'] = CURATED_REGIONAL_NOUNS['papa'];
CURATED_REGIONAL_NOUNS['fresas'] = CURATED_REGIONAL_NOUNS['fresa'];
CURATED_REGIONAL_NOUNS['frutillas'] = CURATED_REGIONAL_NOUNS['frutilla'];
CURATED_REGIONAL_NOUNS['alcachofas'] = CURATED_REGIONAL_NOUNS['alcachofa'];
CURATED_REGIONAL_NOUNS['alcauciles'] = CURATED_REGIONAL_NOUNS['alcaucil'];
CURATED_REGIONAL_NOUNS['aguacates'] = CURATED_REGIONAL_NOUNS['aguacate'];
CURATED_REGIONAL_NOUNS['paltas'] = CURATED_REGIONAL_NOUNS['palta'];
CURATED_REGIONAL_NOUNS['platanos'] = CURATED_REGIONAL_NOUNS['platano'];
CURATED_REGIONAL_NOUNS['bananas'] = CURATED_REGIONAL_NOUNS['banana'];
CURATED_REGIONAL_NOUNS['melocotones'] = CURATED_REGIONAL_NOUNS['melocoton'];
CURATED_REGIONAL_NOUNS['duraznos'] = CURATED_REGIONAL_NOUNS['durazno'];
CURATED_REGIONAL_NOUNS['autobuses'] = CURATED_REGIONAL_NOUNS['autobus'];
CURATED_REGIONAL_NOUNS['coches'] = CURATED_REGIONAL_NOUNS['coche'];
CURATED_REGIONAL_NOUNS['boligrafos'] = CURATED_REGIONAL_NOUNS['boligrafo'];
CURATED_REGIONAL_NOUNS['gafa'] = CURATED_REGIONAL_NOUNS['gafas'];
CURATED_REGIONAL_NOUNS['neveras'] = CURATED_REGIONAL_NOUNS['nevera'];
CURATED_REGIONAL_NOUNS['frigorifico'] = CURATED_REGIONAL_NOUNS['nevera'];
CURATED_REGIONAL_NOUNS['heladera'] = CURATED_REGIONAL_NOUNS['nevera'];
CURATED_REGIONAL_NOUNS['refrigerador'] = CURATED_REGIONAL_NOUNS['nevera'];
CURATED_REGIONAL_NOUNS['pisos'] = CURATED_REGIONAL_NOUNS['piso'];
CURATED_REGIONAL_NOUNS['departamento'] = CURATED_REGIONAL_NOUNS['piso'];
CURATED_REGIONAL_NOUNS['apartamento'] = CURATED_REGIONAL_NOUNS['piso'];
CURATED_REGIONAL_NOUNS['piscinas'] = CURATED_REGIONAL_NOUNS['piscina'];
CURATED_REGIONAL_NOUNS['alberca'] = CURATED_REGIONAL_NOUNS['piscina'];
CURATED_REGIONAL_NOUNS['pileta'] = CURATED_REGIONAL_NOUNS['piscina'];
CURATED_REGIONAL_NOUNS['tartas'] = CURATED_REGIONAL_NOUNS['tarta'];
CURATED_REGIONAL_NOUNS['pastel'] = CURATED_REGIONAL_NOUNS['tarta'];
CURATED_REGIONAL_NOUNS['torta'] = CURATED_REGIONAL_NOUNS['tarta'];
CURATED_REGIONAL_NOUNS['chaquetas'] = CURATED_REGIONAL_NOUNS['chaqueta'];
CURATED_REGIONAL_NOUNS['campera'] = CURATED_REGIONAL_NOUNS['chaqueta'];
CURATED_REGIONAL_NOUNS['chamarra'] = CURATED_REGIONAL_NOUNS['chaqueta'];
CURATED_REGIONAL_NOUNS['aceras'] = CURATED_REGIONAL_NOUNS['acera'];
CURATED_REGIONAL_NOUNS['vereda'] = CURATED_REGIONAL_NOUNS['acera'];
CURATED_REGIONAL_NOUNS['banqueta'] = CURATED_REGIONAL_NOUNS['acera'];
CURATED_REGIONAL_NOUNS['calcetin'] = CURATED_REGIONAL_NOUNS['calcetines'];
CURATED_REGIONAL_NOUNS['pajitas'] = CURATED_REGIONAL_NOUNS['pajita'];
CURATED_REGIONAL_NOUNS['popote'] = CURATED_REGIONAL_NOUNS['pajita'];
CURATED_REGIONAL_NOUNS['pitillo'] = CURATED_REGIONAL_NOUNS['pajita'];
CURATED_REGIONAL_NOUNS['estacionamiento'] = CURATED_REGIONAL_NOUNS['aparcamiento'];
CURATED_REGIONAL_NOUNS['parqueadero'] = CURATED_REGIONAL_NOUNS['aparcamiento'];
CURATED_REGIONAL_NOUNS['plomero'] = CURATED_REGIONAL_NOUNS['fontanero'];
CURATED_REGIONAL_NOUNS['computadora'] = CURATED_REGIONAL_NOUNS['ordenador'];
CURATED_REGIONAL_NOUNS['computador'] = CURATED_REGIONAL_NOUNS['ordenador'];
CURATED_REGIONAL_NOUNS['cerilla'] = CURATED_REGIONAL_NOUNS['cerillas'];
CURATED_REGIONAL_NOUNS['fosforos'] = CURATED_REGIONAL_NOUNS['cerillas'];
CURATED_REGIONAL_NOUNS['fosforo'] = CURATED_REGIONAL_NOUNS['cerillas'];
CURATED_REGIONAL_NOUNS['tomates'] = CURATED_REGIONAL_NOUNS['tomate'];
CURATED_REGIONAL_NOUNS['cebollas'] = CURATED_REGIONAL_NOUNS['cebolla'];
CURATED_REGIONAL_NOUNS['zanahorias'] = CURATED_REGIONAL_NOUNS['zanahoria'];
CURATED_REGIONAL_NOUNS['berenjenas'] = CURATED_REGIONAL_NOUNS['berenjena'];
CURATED_REGIONAL_NOUNS['ajos'] = CURATED_REGIONAL_NOUNS['ajo'];
CURATED_REGIONAL_NOUNS['lechugas'] = CURATED_REGIONAL_NOUNS['lechuga'];
CURATED_REGIONAL_NOUNS['pepinos'] = CURATED_REGIONAL_NOUNS['pepino'];
CURATED_REGIONAL_NOUNS['puerros'] = CURATED_REGIONAL_NOUNS['puerro'];

/**
 * Local memory cache to prevent re-fetching regional data
 */
const clientRegionalCache = new Map<string, RegionalUsage>();

/**
 * Returns curated regional usage if pre-configured
 */
export function getCuratedRegionalUsage(word?: string, lemma?: string): RegionalUsage | null {
  const key = normalizeNounKey(word, lemma);
  if (!key) return null;
  if (clientRegionalCache.has(key)) {
    return clientRegionalCache.get(key)!;
  }
  if (CURATED_REGIONAL_NOUNS[key]) {
    return CURATED_REGIONAL_NOUNS[key];
  }
  return null;
}

/**
 * Generates an educational panhispanic standard fallback for any noun
 */
export function createUniversalNounUsage(cleanNoun: string): RegionalUsage {
  return {
    primaryTerm: cleanNoun,
    primaryCountries: ['España', 'México', 'Argentina', 'Colombia', 'Chile', 'Perú', 'y resto de Hispanoamérica'],
    primaryFlags: ['🇪🇸', '🇲🇽', '🇦🇷', '🇨🇴', '🇨🇱', '🇵🇪'],
    variants: [],
    explanation: `"${cleanNoun}" es un término panhispánico de uso común y extendido en los 21 países de habla hispana sin variantes regionales excluyentes.`,
    isPanhispanicUniversal: true,
  };
}

/**
 * Fetches regional usage from cache, curated library, or backend endpoint.
 */
export async function fetchRegionalUsage(
  word: string,
  lemma?: string,
  category?: string
): Promise<RegionalUsage | null> {
  if (category && category.toLowerCase() !== 'sustantivo') {
    return null;
  }

  const key = normalizeNounKey(word, lemma);
  if (!key) return null;

  // 1. Check local cache
  if (clientRegionalCache.has(key)) {
    return clientRegionalCache.get(key)!;
  }

  // 2. Check curated instant dictionary
  if (CURATED_REGIONAL_NOUNS[key]) {
    clientRegionalCache.set(key, CURATED_REGIONAL_NOUNS[key]);
    return CURATED_REGIONAL_NOUNS[key];
  }

  // 3. Request from backend API endpoint
  try {
    const res = await fetch('/api/regional-variants', {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({
        word,
        lemma: lemma || word,
        category: 'sustantivo',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.regionalUsage) {
        clientRegionalCache.set(key, data.regionalUsage);
        return data.regionalUsage;
      }
    }
  } catch (err) {
    console.warn('[RegionalVariants] Error en consulta remota, utilizando respaldo panhispánico.', err);
  }

  // 4. Fallback: Generate universal panhispanic entry
  const fallback = createUniversalNounUsage(lemma || word);
  clientRegionalCache.set(key, fallback);
  return fallback;
}
