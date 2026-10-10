import 'dotenv/config';
import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CURATED_REGIONAL_NOUNS,
  normalizeNounKey,
  createUniversalNounUsage,
} from './src/utils/regionalVariants';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json({ limit: '10mb' }));

const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Returns a GoogleGenAI client using either the user's custom API key (from header)
 * or falling back to the system's default GEMINI_API_KEY.
 */
function getGenAIClient(customKey?: string | null): GoogleGenAI | null {
  const effectiveKey = (customKey && typeof customKey === 'string' && customKey.trim().length > 0)
    ? customKey.trim()
    : apiKey;
  if (!effectiveKey) return null;
  return new GoogleGenAI({
    apiKey: effectiveKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Free-tier supported Gemini models cascade for high-availability resilience.
 * When primary models face high demand (503) or rate limits (429), the cascade falls back smoothly.
 */
const FREE_MODELS_CASCADE = [
  'gemini-2.5-flash',      // Primary reliable stable flash model
  'gemini-2.5-flash-lite', // Lightweight, fast with separate quota
  'gemini-3.1-flash-lite', // Next-gen flash-lite preview
  'gemini-3.8-flash',      // Flash model
  'gemini-flash-latest',   // Universal alias fallback
];

// Circuit breaker to avoid calling models with known quota exhaustion
const modelCooldownMap = new Map<string, number>();

// Pre-emptively cool down gemini-3.8-flash if its 20-request daily free limit was triggered
modelCooldownMap.set('gemini-3.8-flash', Date.now() + 4 * 60 * 60 * 1000);

function isModelInCooldown(model: string): boolean {
  const expiry = modelCooldownMap.get(model);
  if (!expiry) return false;
  if (Date.now() < expiry) {
    return true;
  }
  modelCooldownMap.delete(model);
  return false;
}

function markModelCooldown(model: string, durationMs: number = 60 * 60 * 1000) {
  modelCooldownMap.set(model, Date.now() + durationMs);
}

/**
 * Checks if an error is due to high demand, rate limits, or transient unavailability
 */
function isTransientOrDemandError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const status = String(err.status || err.code || err.statusCode || '');
  return (
    status === '503' ||
    status === '429' ||
    status === '500' ||
    status === 'UNAVAILABLE' ||
    status === 'RESOURCE_EXHAUSTED' ||
    msg.includes('high demand') ||
    msg.includes('spikes in demand') ||
    msg.includes('unavailable') ||
    msg.includes('temporarily') ||
    msg.includes('overloaded') ||
    msg.includes('resource exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('quota')
  );
}

/**
 * Execute Gemini generateContent with automatic multi-model waterfall fallback and circuit-breaker.
 * Accepts an optional custom client (e.g. instantiated with user's personal free API key).
 * Returns null if all models are in cooldown or unavailable (allowing zero-failure local fallback).
 */
async function generateContentWithCascade(
  configPayload: {
    contents: any;
    systemInstruction?: string;
    responseSchema?: any;
    responseMimeType?: string;
  },
  customClient?: GoogleGenAI | null
): Promise<{ text: string; modelUsed: string } | null> {
  const activeClient = customClient || ai;
  if (!activeClient) {
    return null;
  }

  for (const model of FREE_MODELS_CASCADE) {
    if (isModelInCooldown(model)) {
      console.log(`[Gemini Cascade] Omitiendo '${model}' por enfriamiento temporal de cuota.`);
      continue;
    }

    try {
      console.log(`[Gemini Cascade] Generando contenido con modelo: ${model}...`);
      const response = await activeClient.models.generateContent({
        model,
        contents: configPayload.contents,
        config: {
          systemInstruction: configPayload.systemInstruction,
          responseMimeType: configPayload.responseMimeType || 'application/json',
          responseSchema: configPayload.responseSchema,
        },
      });

      const text = response.text;
      if (text && text.trim().length > 0) {
        console.log(`[Gemini Cascade] ¡Generación exitosa con ${model}!`);
        return { text, modelUsed: model };
      }
    } catch (err: any) {
      const isQuota = isTransientOrDemandError(err);
      if (isQuota) {
        markModelCooldown(model, 60 * 60 * 1000); // 1 hour circuit breaker
        console.log(`[Gemini Cascade] Modelo '${model}' pausado por cuota o alta demanda. Conmutando al siguiente modelo...`);
        await new Promise((resolve) => setTimeout(resolve, 200));
      } else {
        console.log(`[Gemini Cascade] Modelo '${model}' no disponible. Conmutando...`);
      }
    }
  }

  console.log('[Gemini Cascade] Todos los modelos de IA en pausa. Activando motor léxico ELE de respaldo garantizado.');
  return null;
}

/**
 * Rich Pre-curated & Synthesized Pedagogical Dictionaries for ELE
 * Zero-failure guarantee when external AI infrastructure is completely down.
 */
const CURATED_SETS: Record<string, any> = {
  verduras: {
    title: 'El Mercado: Verduras y Hortalizas',
    summary: 'Vocabulario esencial y enriquecido sobre verduras frescas, hortalizas y tubérculos para hablar de comida y compras.',
    suggestedTopics: ['Verbos de cocción', 'Utensilios de cocina', 'Sabores y texturas', 'En el restaurante'],
    challenge: 'Elige tres verduras de la nube y describe una receta típica hispanohablante que las incluya.',
    oddOneOut: {
      word: 'el tornillo',
      meaning: 'Pieza cilíndrica metálica utilizada para fijar cosas.',
      reason: 'Es una herramienta de ferretería, no una verdura comestible.',
    },
    words: [
      { id: 'v1', word: 'el calabacín', lemma: 'calabacín', article: 'el', category: 'sustantivo', subcategory: 'hortalizas', level: 'A2', weight: 4, meaning: 'Hortaliza alargada de piel verde y pulpa blanca suave.', translationEn: 'zucchini / courgette', example: 'Sofreímos el calabacín en rodajas finas con aceite de oliva.', collocation: 'calabacín a la plancha', pronunciationHint: 'ca-la-ba-CÍN' },
      { id: 'v2', word: 'la zanahoria', lemma: 'zanahoria', article: 'la', category: 'sustantivo', subcategory: 'raíces', level: 'A1', weight: 5, meaning: 'Raíz comestible de color naranja, crujiente y dulce.', translationEn: 'carrot', example: 'Añade una zanahoria rallada a la ensalada fresca.', collocation: 'zanahoria cruda o cocida', pronunciationHint: 'za-na-HO-ria (hache muda)' },
      { id: 'v3', word: 'la berenjena', lemma: 'berenjena', article: 'la', category: 'sustantivo', subcategory: 'hortalizas', level: 'A2', weight: 4, meaning: 'Hortaliza ovalada de piel morada oscura y pulpa esponjosa.', translationEn: 'eggplant / aubergine', example: 'Preparamos berenjenas rellenas al horno con queso.', collocation: 'berenjena frita con miel', pronunciationHint: 'be-ren-JE-na' },
      { id: 'v4', word: 'las espinacas', lemma: 'espinaca', article: 'las', category: 'sustantivo', subcategory: 'hojas verdes', level: 'A2', weight: 3, meaning: 'Planta de hojas verdes ricas en hierro que se consume cocida o fresca.', translationEn: 'spinach', example: 'Salteamos las espinacas con ajo y piñones.', collocation: 'espinacas a la crema', pronunciationHint: 'es-pi-NA-cas' },
      { id: 'v5', word: 'el tomate', lemma: 'tomate', article: 'el', category: 'sustantivo', subcategory: 'frutos', level: 'A1', weight: 5, meaning: 'Fruto carnoso, rojo y jugoso indispensable en la dieta mediterránea.', translationEn: 'tomato', example: 'El gazpacho andaluz lleva tomates maduros y pepino.', collocation: 'tomate triturado natural', pronunciationHint: 'to-MA-te' },
      { id: 'v6', word: 'el pimiento', lemma: 'pimiento', article: 'el', category: 'sustantivo', subcategory: 'hortalizas', level: 'A1', weight: 4, meaning: 'Hortaliza hueca de color verde, rojo o amarillo con semillas internas.', translationEn: 'bell pepper', example: 'Cortamos el pimiento rojo en tiras para la fajita.', collocation: 'pimientos asados', pronunciationHint: 'pi-MIEN-to' },
      { id: 'v7', word: 'la alcachofa', lemma: 'alcachofa', article: 'la', category: 'sustantivo', subcategory: 'flores comestibles', level: 'B1', weight: 3, meaning: 'Planta con cabezuela comestible de hojas apretadas y corazón tierno.', translationEn: 'artichoke', example: 'Las alcachofas a la brasa son un manjar de temporada.', collocation: 'corazón de alcachofa', pronunciationHint: 'al-ca-CHO-fa' },
      { id: 'v8', word: 'el puerro', lemma: 'puerro', article: 'el', category: 'sustantivo', subcategory: 'bulbos', level: 'A2', weight: 3, meaning: 'Tallo cilíndrico blanco con hojas verdes y sabor suave similar a la cebolla.', translationEn: 'leek', example: 'La vichyssoise es una crema fría tradicional a base de puerros.', collocation: 'sofrito de puerro', pronunciationHint: 'PUER-ro' },
      { id: 'v9', word: 'el ajo', lemma: 'ajo', article: 'el', category: 'sustantivo', subcategory: 'bulbos', level: 'A1', weight: 5, meaning: 'Bulbo aromático compuesto por varios dientes, base del sofrito hispano.', translationEn: 'garlic', example: 'Doramos dos dientes de ajo laminados a fuego suave.', collocation: 'diente de ajo', pronunciationHint: 'A-jo' },
      { id: 'v10', word: 'la cebolla', lemma: 'cebolla', article: 'la', category: 'sustantivo', subcategory: 'bulbos', level: 'A1', weight: 5, meaning: 'Bulbo de capas concéntricas picante en crudo y dulce al caramelizarse.', translationEn: 'onion', example: 'Pica la cebolla muy finamente para la salsa.', collocation: 'cebolla pochada', pronunciationHint: 'ce-BO-lla' },
      { id: 'v11', word: 'la coliflor', lemma: 'coliflor', article: 'la', category: 'sustantivo', subcategory: 'crucíferas', level: 'A2', weight: 3, meaning: 'Variedad de col con inflorescencia redondeada y compacta de color blanco.', translationEn: 'cauliflower', example: 'Cocinamos la coliflor al vapor para conservar sus nutrientes.', collocation: 'coliflor gratinada', pronunciationHint: 'co-li-FLOR' },
      { id: 'v12', word: 'el brócoli', lemma: 'brócoli', article: 'el', category: 'sustantivo', subcategory: 'crucíferas', level: 'A2', weight: 4, meaning: 'Hortaliza verde oscuro con ramilletes densos en forma de árbol pequeño.', translationEn: 'broccoli', example: 'Salteamos el brócoli con salsa de soja y sésamo.', collocation: 'ramilletes de brócoli', pronunciationHint: 'BRÓ-co-li' },
      { id: 'v13', word: 'la lechuga', lemma: 'lechuga', article: 'la', category: 'sustantivo', subcategory: 'hojas verdes', level: 'A1', weight: 5, meaning: 'Planta de hojas verdes tiernas usada principalmente en ensaladas.', translationEn: 'lettuce', example: 'Lava bien la lechuga romana antes de servirla.', collocation: 'lechuga crujiente', pronunciationHint: 'le-CHU-ga' },
      { id: 'v14', word: 'el pepino', lemma: 'pepino', article: 'el', category: 'sustantivo', subcategory: 'frutos', level: 'A1', weight: 3, meaning: 'Hortaliza alargada muy refrescante y rica en agua.', translationEn: 'cucumber', example: 'El pepino aporta frescura y textura crujiente.', collocation: 'rodajas de pepino', pronunciationHint: 'pe-PI-no' },
      { id: 'v15', word: 'los espárragos', lemma: 'espárrago', article: 'los', category: 'sustantivo', subcategory: 'tallos', level: 'B1', weight: 3, meaning: 'Tallos tiernos, verdes o blancos, muy apreciados a la plancha.', translationEn: 'asparagus', example: 'Servimos espárragos trigueros a la plancha con sal gorda.', collocation: 'espárragos trigueros', pronunciationHint: 'es-PÁ-rra-gos' },
    ],
  },
  'verbos de coccion': {
    title: 'La Cocina: Verbos de Cocción y Técnicas',
    summary: 'Acciones clave en la cocina para describir recetas, procesos culinarios e instrucciones precisas en español.',
    suggestedTopics: ['Verduras y hortalizas', 'Utensilios de cocina', 'Expresiones con comida', 'La mesa y comensales'],
    challenge: 'Explica en imperativo (tú o usted) cómo preparar tu plato favorito usando al menos 4 verbos de la nube.',
    oddOneOut: {
      word: 'estudiar',
      meaning: 'Dedicar tiempo a aprender y comprender materias intelectuales.',
      reason: 'Es una actividad académica, no una técnica culinaria.',
    },
    words: [
      { id: 'c0', word: 'cocinar', lemma: 'cocinar', article: null, category: 'verbo', subcategory: 'acción general', level: 'A1', weight: 5, meaning: 'Preparar y transformar los alimentos mediante el calor para hacerlos sabrosos y aptos para el consumo.', translationEn: 'to cook', example: 'A mis abuelos les encanta cocinar platos tradicionales de la cocina mediterránea juntos los domingos.', collocation: 'cocinar a fuego lento', pronunciationHint: 'co-ci-NAR' },
      { id: 'c1', word: 'sofreír', lemma: 'sofreír', article: null, category: 'verbo', subcategory: 'técnica directa', level: 'A2', weight: 5, meaning: 'Freír ligeramente un alimento a fuego moderado sin que llegue a dorarse demasiado.', translationEn: 'to sauté / stir-fry', example: 'Primero sofreímos la cebolla y el ajo con una pizca de sal.', collocation: 'sofreír a fuego lento', pronunciationHint: 'so-fre-ÍR' },
      { id: 'c2', word: 'hervir', lemma: 'hervir', article: null, category: 'verbo', subcategory: 'líquidos', level: 'A1', weight: 5, meaning: 'Cocer un alimento en agua u otro líquido en punto de ebullición.', translationEn: 'to boil', example: 'Deja hervir la pasta durante ocho minutos al dente.', collocation: 'hervir a borbotones', pronunciationHint: 'her-VIR' },
      { id: 'c3', word: 'hornear', lemma: 'hornear', article: null, category: 'verbo', subcategory: 'horno', level: 'A2', weight: 4, meaning: 'Cocer o dorar alimentos en el horno mediante calor seco.', translationEn: 'to bake / roast', example: 'Hornea la empanada a 180 grados hasta que esté dorada.', collocation: 'hornear a fuego medio', pronunciationHint: 'hor-ne-AR' },
      { id: 'c4', word: 'pochar', lemma: 'pochar', article: null, category: 'verbo', subcategory: 'técnica suave', level: 'B1', weight: 4, meaning: 'Freír verdura lentamente en aceite hasta que quede tierna y translúcida.', translationEn: 'to sweat / slow-cook gently', example: 'Hay que pochar la cebolla despacio para que suelte sus azúcares.', collocation: 'pochar la verdura', pronunciationHint: 'po-CHAR' },
      { id: 'c5', word: 'dorar', lemma: 'dorar', article: null, category: 'verbo', subcategory: 'fuego directo', level: 'A2', weight: 4, meaning: 'Tostar ligeramente la superficie de un alimento hasta adquirir un tono oro.', translationEn: 'to brown / sear', example: 'Dora la carne por ambos lados para sellar sus jugos.', collocation: 'dorar a fuego vivo', pronunciationHint: 'do-RAR' },
      { id: 'c6', word: 'gratinar', lemma: 'gratinar', article: null, category: 'verbo', subcategory: 'horno', level: 'B1', weight: 3, meaning: 'Tostar la capa superior de un plato (queso o bechamel) con calor superior fuerte.', translationEn: 'to broil / gratine', example: 'Mete los macarrones al horno para gratinar el queso rallado.', collocation: 'gratinar al horno', pronunciationHint: 'gra-ti-NAR' },
      { id: 'c7', word: 'cocer al vapor', lemma: 'cocer al vapor', article: null, category: 'expresion', subcategory: 'técnica saludable', level: 'A2', weight: 3, meaning: 'Cocer los alimentos aprovechando únicamente el vapor del agua hirviendo.', translationEn: 'to steam', example: 'Es más sano cocer las verduras al vapor para no perder vitaminas.', collocation: 'cocer al vapor con tapa', pronunciationHint: 'co-CER al va-POR' },
      { id: 'c8', word: 'reducir', lemma: 'reducir', article: null, category: 'verbo', subcategory: 'salsas', level: 'B1', weight: 3, meaning: 'Hervir un caldo o salsa para concentrar su sabor mediante evaporación.', translationEn: 'to reduce', example: 'Deja reducir la salsa de vino tinto a la mitad.', collocation: 'reducir la salsa', pronunciationHint: 're-du-CIR' },
      { id: 'c9', word: 'escalfar', lemma: 'escalfar', article: null, category: 'verbo', subcategory: 'líquidos', level: 'B2', weight: 2, meaning: 'Cocer huevos u otros alimentos en agua caliente justo antes de hervir.', translationEn: 'to poach', example: 'Escalfamos dos huevos sobre una tostada de aguacate.', collocation: 'escalfar un huevo', pronunciationHint: 'es-cal-FAR' },
      { id: 'c10', word: 'marinar', lemma: 'marinar', article: null, category: 'verbo', subcategory: 'preparación', level: 'B1', weight: 3, meaning: 'Dejar un alimento sumergido en un líquido aromático para ablandarlo y darle sabor.', translationEn: 'to marinate', example: 'Marina el tofu con soja, jengibre y zumo de lima.', collocation: 'marinar en la nevera', pronunciationHint: 'ma-ri-NAR' },
      { id: 'c11', word: 'saltear', lemma: 'saltear', article: null, category: 'verbo', subcategory: 'fuego directo', level: 'A2', weight: 4, meaning: 'Cocinar alimentos rápidamente en sartén caliente con poco aceite moviéndolos con brío.', translationEn: 'to sauté / toss', example: 'Saltea las setas con ajo picado y perejil fresco.', collocation: 'saltear en wok', pronunciationHint: 'sal-te-AR' },
      { id: 'c12', word: 'guisar', lemma: 'guisar', article: null, category: 'verbo', subcategory: 'cocina tradicional', level: 'A2', weight: 4, meaning: 'Preparar alimentos cociéndolos en una salsa elaborada tras un sofrito.', translationEn: 'to stew', example: 'A mi abuela le encanta guisar lentejas los domingos.', collocation: 'guisar a fuego lento', pronunciationHint: 'gui-SAR' },
      { id: 'c13', word: 'rehogar', lemma: 'rehogar', article: null, category: 'verbo', subcategory: 'técnica directa', level: 'B1', weight: 3, meaning: 'Cocinar un alimento en grasa a fuego suave tapado para que sude sus jugos.', translationEn: 'to sweat / braise lightly', example: 'Rehoga el arroz con los granos de ajo antes de verter el caldo.', collocation: 'rehogar bien el arroz', pronunciationHint: 're-ho-GAR' },
    ],
  },
  emociones: {
    title: 'El Mundo Interior: Emociones y Sentimientos',
    summary: 'Léxico para expresar estados de ánimo, matices afectivos y psicología cotidiana en español.',
    suggestedTopics: ['Relaciones personales', 'En el trabajo', 'Conversación cotidiana', 'Expresiones coloquiales'],
    challenge: 'Describe cómo te sentiste en una situación reciente usando al menos tres adjetivos emocionales de la nube.',
    oddOneOut: {
      word: 'la calculadora',
      meaning: 'Dispositivo electrónico para realizar cálculos numéricos.',
      reason: 'Es un objeto material inerte, no un sentimiento humano.',
    },
    words: [
      { id: 'e1', word: 'entusiasmado', lemma: 'entusiasmado', article: null, category: 'adjetivo', subcategory: 'positivas', level: 'B1', weight: 5, meaning: 'Que siente gran admiración, fervor o alegría viva hacia algo.', translationEn: 'excited / enthusiastic', example: 'Los alumnos están entusiasmados con el nuevo proyecto escolar.', collocation: 'estar entusiasmado con algo', pronunciationHint: 'en-tu-sias-MA-do' },
      { id: 'e2', word: 'la serenidad', lemma: 'serenidad', article: 'la', category: 'sustantivo', subcategory: 'calma', level: 'B2', weight: 4, meaning: 'Estado de ánimo apacible y libre de turbación o ansiedad.', translationEn: 'serenity / peace of mind', example: 'Mantuvo la serenidad a pesar de los momentos difíciles.', collocation: 'mantener la serenidad', pronunciationHint: 'se-re-ni-DAD' },
      { id: 'e3', word: 'agradecido', lemma: 'agradecido', article: null, category: 'adjetivo', subcategory: 'afecto', level: 'A2', weight: 5, meaning: 'Que siente o muestra gratitud por un beneficio recibido.', translationEn: 'grateful / thankful', example: 'Estoy profundamente agradecido por tu apoyo constante.', collocation: 'estar muy agradecido', pronunciationHint: 'a-gra-de-CI-do' },
      { id: 'e4', word: 'la nostalgia', lemma: 'nostalgia', article: 'la', category: 'sustantivo', subcategory: 'melancolía', level: 'B1', weight: 4, meaning: 'Pena o añoranza de recordar momentos pasados o el lugar de origen.', translationEn: 'nostalgia / homesickness', example: 'Escuchar esa canción le produjo una dulce nostalgia de su infancia.', collocation: 'sentir nostalgia de', pronunciationHint: 'nos-TAL-gia' },
      { id: 'e5', word: 'agobiado', lemma: 'agobiado', article: null, category: 'adjetivo', subcategory: 'estrés', level: 'B1', weight: 4, meaning: 'Sentimiento de estar abrumado por exceso de trabajo o preocupaciones.', translationEn: 'overwhelmed / stressed', example: 'Me siento un poco agobiado antes de la semana de exámenes.', collocation: 'estar agobiado por el trabajo', pronunciationHint: 'a-go-BIA-do' },
      { id: 'e6', word: 'esperanzado', lemma: 'esperanzado', article: null, category: 'adjetivo', subcategory: 'optimismo', level: 'B1', weight: 3, meaning: 'Que tiene confianza o ilusión de que algo positivo va a suceder.', translationEn: 'hopeful', example: 'Estamos esperanzados con los resultados del nuevo tratamiento.', collocation: 'sentirse esperanzado', pronunciationHint: 'es-pe-ran-ZA-do' },
      { id: 'e7', word: 'el asombro', lemma: 'asombro', article: 'el', category: 'sustantivo', subcategory: 'sorpresa', level: 'B1', weight: 3, meaning: 'Gran admiración o sorpresa ante algo extraordinario o inesperado.', translationEn: 'astonishment / wonder', example: 'Miraba el paisaje montañoso con asombro y fascinación.', collocation: 'mirar con asombro', pronunciationHint: 'a-SOM-bro' },
      { id: 'e8', word: 'aliviado', lemma: 'aliviado', article: null, category: 'adjetivo', subcategory: 'alivio', level: 'A2', weight: 4, meaning: 'Que siente descanso o sosiego tras la desaparición de una preocupación.', translationEn: 'relieved', example: 'Quedó muy aliviada al saber que todo había salido bien.', collocation: 'respirar aliviado', pronunciationHint: 'a-li-VIA-do' },
    ],
  },
  ciudad: {
    title: 'La Ciudad: Lugares, Espacios y Vida Urbana',
    summary: 'Vocabulario urbano para orientarse, describir barrios y desenvolverse en una metrópoli hispanohablante.',
    suggestedTopics: ['En el transporte público', 'De compras', 'Alojamientos', 'La casa y el vecindario'],
    challenge: 'Indica a tu compañero cómo llegar desde la plaza mayor hasta el museo usando al menos 3 términos.',
    oddOneOut: {
      word: 'el tiburón',
      meaning: 'Pez carnívoro marino de gran tamaño.',
      reason: 'Pertenece al océano salvaje, no a la infraestructura urbana.',
    },
    words: [
      { id: 'ci1', word: 'el callejón', lemma: 'callejón', article: 'el', category: 'sustantivo', subcategory: 'vías', level: 'B1', weight: 4, meaning: 'Calle estrecha entre edificios o paredes altas con encanto histórico.', translationEn: 'alley / narrow street', example: 'El casco antiguo está lleno de callejones empedrados y flores.', collocation: 'callejón sin salida', pronunciationHint: 'ca-lle-JÓN' },
      { id: 'ci2', word: 'la plaza mayor', lemma: 'plaza mayor', article: 'la', category: 'sustantivo', subcategory: 'espacio público', level: 'A1', weight: 5, meaning: 'Centro neurálgico y social histórico en las ciudades hispanas.', translationEn: 'main square', example: 'Quedamos a las siete bajo los soportales de la Plaza Mayor.', collocation: 'en plena plaza mayor', pronunciationHint: 'PLA-za ma-YOR' },
      { id: 'ci3', word: 'el paso de cebra', lemma: 'paso de cebra', article: 'el', category: 'sustantivo', subcategory: 'tráfico', level: 'A2', weight: 3, meaning: 'Zona señalizada con rayas blancas para que crucen los peatones.', translationEn: 'pedestrian crossing', example: 'Espera en el semáforo y cruza por el paso de cebra.', collocation: 'cruzar por el paso de cebra', pronunciationHint: 'PA-so de CE-bra' },
      { id: 'ci4', word: 'la acera', lemma: 'acera', article: 'la', category: 'sustantivo', subcategory: 'urbanismo', level: 'A2', weight: 4, meaning: 'Orilla de la calle reservada para el tránsito de las personas a pie.', translationEn: 'sidewalk / pavement', example: 'Las terrazas de los cafés ocupan la acera soleada.', collocation: 'caminar por la acera', pronunciationHint: 'a-CE-ra' },
      { id: 'ci5', word: 'el mirador', lemma: 'mirador', article: 'el', category: 'sustantivo', subcategory: 'panorámica', level: 'B1', weight: 4, meaning: 'Lugar elevado desde donde se contempla una hermosa vista de la ciudad.', translationEn: 'viewpoint / scenic overlook', example: 'Subimos al mirador al atardecer para ver la puesta de sol.', collocation: 'vistas desde el mirador', pronunciationHint: 'mi-ra-DOR' },
      { id: 'ci6', word: 'el bullicio', lemma: 'bullicio', article: 'el', category: 'sustantivo', subcategory: 'ambiente', level: 'B2', weight: 3, meaning: 'Ruido y animación característicos de lugares concurridos y vivos.', translationEn: 'bustle / hustle and bustle', example: 'Me encanta el bullicio matutino del mercado central.', collocation: 'el bullicio de la ciudad', pronunciationHint: 'bu-lli-CIO' },
    ],
  },
  viajes: {
    title: 'Viajes, Transporte y Rutas por el Mundo',
    summary: 'Léxico para desenvolverse en estaciones, aeropuertos, hoteles y excursiones turísticas en español.',
    suggestedTopics: ['En el hotel', 'En la estación de tren', 'Direcciones y mapas', 'Gastronomía local'],
    challenge: 'Cuenta una anécdota de viaje utilizando al menos tres términos de la nube.',
    oddOneOut: {
      word: 'la batidora',
      meaning: 'Electrodoméstico para triturar o batir alimentos.',
      reason: 'Es un utensilio de cocina doméstica, no un elemento de viajes y transporte.',
    },
    words: [
      { id: 'tr1', word: 'el billete de ida y vuelta', lemma: 'billete de ida y vuelta', article: 'el', category: 'sustantivo', subcategory: 'reservas', level: 'A2', weight: 5, meaning: 'Boleto o pasaje que permite ir a un destino y regresar.', translationEn: 'round-trip ticket', example: 'Compré un billete de ida y vuelta en tren de alta velocidad a Sevilla.', collocation: 'billete de ida y vuelta', pronunciationHint: 'bi-LLE-te de I-da y VUEL-ta' },
      { id: 'tr2', word: 'el andén', lemma: 'andén', article: 'el', category: 'sustantivo', subcategory: 'estación', level: 'B1', weight: 4, meaning: 'Plataforma en estaciones de tren o metro donde esperan los viajeros.', translationEn: 'platform', example: 'El tren con destino a Valencia saldrá por el andén número cuatro.', collocation: 'esperar en el andén', pronunciationHint: 'an-DÉN' },
      { id: 'tr3', word: 'facturar', lemma: 'facturar', article: null, category: 'verbo', subcategory: 'aeropuerto', level: 'B1', weight: 4, meaning: 'Entregar y registrar el equipaje en el mostrador del aeropuerto.', translationEn: 'to check in (luggage)', example: 'Tenemos que facturar dos maletas antes de pasar el control de seguridad.', collocation: 'facturar el equipaje', pronunciationHint: 'fac-tu-RAR' },
      { id: 'tr4', word: 'el alojamiento', lemma: 'alojamiento', article: 'el', category: 'sustantivo', subcategory: 'estancia', level: 'A2', weight: 4, meaning: 'Lugar donde una persona se hospeda temporalmente durante un viaje.', translationEn: 'accommodation / lodging', example: 'Reservamos un alojamiento con encanto en el centro histórico.', collocation: 'buscar alojamiento', pronunciationHint: 'a-lo-ja-MIEN-to' },
      { id: 'tr5', word: 'embarcar', lemma: 'embarcar', article: null, category: 'verbo', subcategory: 'transporte', level: 'A2', weight: 4, meaning: 'Subir a bordo de un barco, tren o avión para iniciar el viaje.', translationEn: 'to board', example: 'Los pasajeros del vuelo con destino a Buenos Aires pueden empezar a embarcar.', collocation: 'puerta de embarque', pronunciationHint: 'em-bar-CAR' },
      { id: 'tr6', word: 'el retraso', lemma: 'retraso', article: 'el', category: 'sustantivo', subcategory: 'incidencias', level: 'A2', weight: 3, meaning: 'Demora o tardanza en la hora prevista de llegada o salida.', translationEn: 'delay', example: 'El vuelo sufrió un retraso de media hora por la tormenta.', collocation: 'sufrir un retraso', pronunciationHint: 're-TRA-so' },
      { id: 'tr7', word: 'recorrer', lemma: 'recorrer', article: null, category: 'verbo', subcategory: 'turismo', level: 'B1', weight: 4, meaning: 'Ir por un lugar o trayecto conociéndolo paso a paso.', translationEn: 'to travel across / explore', example: 'Nos encantaría recorrer los pueblos blancos de Andalucía en primavera.', collocation: 'recorrer la ciudad', pronunciationHint: 're-cor-RER' },
    ],
  },
};

// Aliases
CURATED_SETS['cocinar'] = CURATED_SETS['verbos de coccion'];
CURATED_SETS['cocina'] = CURATED_SETS['verbos de coccion'];
CURATED_SETS['sentimientos'] = CURATED_SETS['emociones'];
CURATED_SETS['la ciudad'] = CURATED_SETS['ciudad'];
CURATED_SETS['barrio'] = CURATED_SETS['ciudad'];
CURATED_SETS['viaje'] = CURATED_SETS['viajes'];
CURATED_SETS['transporte'] = CURATED_SETS['viajes'];
CURATED_SETS['trenes'] = CURATED_SETS['viajes'];
CURATED_SETS['aeropuertos'] = CURATED_SETS['viajes'];

/**
 * Universal dynamic fallback generator for any custom topic
 * Synthesizes a well-formed ELE cloud with authentic Spanish grammar
 */
function generateDynamicELEFallback(topic: string, level: string = 'Todos', focus: string = 'general') {
  const clean = topic.trim();
  const title = `Vocabulario Clave: ${clean.charAt(0).toUpperCase() + clean.slice(1)}`;
  const summary = `Nube léxica contextualizada sobre "${clean}" para práctica de conversación, gramática y comprensión en clase.`;

  // Pre-assembled educational core for when external AI APIs fail entirely
  const generatedWords = [
    {
      id: `dyn_${Date.now()}_1`,
      word: clean.toLowerCase().startsWith('el ') || clean.toLowerCase().startsWith('la ') ? clean : `el ámbito de ${clean}`,
      lemma: clean,
      article: 'el',
      category: 'sustantivo',
      level: 'A2',
      weight: 5,
      meaning: `Concepto central y campo temático vinculado a ${clean}.`,
      translationEn: `core theme of ${clean}`,
      example: `Hoy en la clase de español estamos practicando vocabulario sobre ${clean}.`,
      collocation: `relacionado con ${clean}`,
      pronunciationHint: clean.toUpperCase(),
    },
    {
      id: `dyn_${Date.now()}_2`,
      word: 'aprender',
      lemma: 'aprender',
      article: null,
      category: 'verbo',
      level: 'A1',
      weight: 4,
      meaning: 'Adquirir el conocimiento de algo por medio del estudio o de la experiencia.',
      translationEn: 'to learn',
      example: 'Es muy enriquecedor aprender nuevas expresiones en cada lección.',
      collocation: 'aprender a expresarse',
      pronunciationHint: 'a-pren-DER',
    },
    {
      id: `dyn_${Date.now()}_3`,
      word: 'describir',
      lemma: 'describir',
      article: null,
      category: 'verbo',
      level: 'A2',
      weight: 4,
      meaning: 'Explicar cómo es una persona, cosa o situación dando sus características.',
      translationEn: 'to describe',
      example: '¿Puedes describir con detalle cómo influye esto en tu día a día?',
      collocation: 'describir con precisión',
      pronunciationHint: 'des-cri-BIR',
    },
    {
      id: `dyn_${Date.now()}_4`,
      word: 'imprescindible',
      lemma: 'imprescindible',
      article: null,
      category: 'adjetivo',
      level: 'B1',
      weight: 4,
      meaning: 'Dicho de una cosa: de la que no se puede prescindir; totalmente necesaria.',
      translationEn: 'essential / indispensable',
      example: 'Tener una actitud curiosa es imprescindible para dominar el español.',
      collocation: 'un elemento imprescindible',
      pronunciationHint: 'im-pres-cin-DI-ble',
    },
    {
      id: `dyn_${Date.now()}_5`,
      word: 'la experiencia',
      lemma: 'experiencia',
      article: 'la',
      category: 'sustantivo',
      level: 'A2',
      weight: 4,
      meaning: 'Conocimiento de la vida adquirido por las circunstancias o situaciones vividas.',
      translationEn: 'experience',
      example: 'Compartir nuestras experiencias en clase nos ayuda a comunicarnos mejor.',
      collocation: 'vivir una experiencia única',
      pronunciationHint: 'ex-pe-RIEN-cia',
    },
    {
      id: `dyn_${Date.now()}_6`,
      word: 'cotidiano',
      lemma: 'cotidiano',
      article: null,
      category: 'adjetivo',
      level: 'B1',
      weight: 3,
      meaning: 'Que ocurre con frecuencia o pertenece a la rutina diaria de las personas.',
      translationEn: 'daily / everyday',
      example: 'Utilizamos estas palabras en situaciones cotidianas de conversación.',
      collocation: 'la vida cotidiana',
      pronunciationHint: 'co-ti-DIA-no',
    },
    {
      id: `dyn_${Date.now()}_7`,
      word: 'fomentar',
      lemma: 'fomentar',
      article: null,
      category: 'verbo',
      level: 'B2',
      weight: 3,
      meaning: 'Favorecer de algún modo que una acción o proceso se desarrolle con vigor.',
      translationEn: 'to foster / encourage',
      example: 'Buscamos fomentar el diálogo fluido y la participación activa entre alumnos.',
      collocation: 'fomentar la conversación',
      pronunciationHint: 'fo-men-TAR',
    },
    {
      id: `dyn_${Date.now()}_8`,
      word: 'adecuado',
      lemma: 'adecuado',
      article: null,
      category: 'adjetivo',
      level: 'A2',
      weight: 3,
      meaning: 'Apropiado a las condiciones, circunstancias o necesidades de una situación.',
      translationEn: 'suitable / appropriate',
      example: 'Es importante elegir el registro adecuado según el interlocutor.',
      collocation: 'en el momento adecuado',
      pronunciationHint: 'a-de-CUA-do',
    },
  ];

  return {
    title,
    summary,
    suggestedTopics: ['Verbos de acción', 'Conversación cotidiana', 'Expresiones coloquiales', 'Vocabulario descriptivo'],
    challenge: `Elige dos términos de la nube y explica por qué son importantes al hablar sobre "${clean}".`,
    oddOneOut: {
      word: 'el astronauta',
      meaning: 'Persona tripulante de una nave espacial en el cosmos.',
      reason: `No pertenece al campo léxico inmediato de "${clean}".`,
    },
    words: generatedWords,
  };
}

/**
 * Sanitizes word objects so that ONLY nouns ('sustantivos') have articles,
 * while verbs and adjectives NEVER have articles, preventing 'null fundir' or 'null suave'.
 */
function sanitizeWordObject(w: any, index: number) {
  const cat = String(w.category || 'sustantivo').toLowerCase().trim();

  let rawWord = String(w.word || '').trim();
  rawWord = rawWord.replace(/^null\s+/i, '').replace(/^undefined\s+/i, '').trim();

  let rawLemma = String(w.lemma || rawWord).trim();
  rawLemma = rawLemma.replace(/^null\s+/i, '').replace(/^undefined\s+/i, '').trim();

  let validArticle: string | null = null;

  if (cat === 'sustantivo') {
    let art = w.article ? String(w.article).trim().toLowerCase() : '';
    if (art === 'null' || art === 'undefined' || art === 'none' || art === 'ninguno') {
      art = '';
    }
    const match = rawWord.match(/^(el|la|los|las|un|una|unos|unas)\s+(.+)$/i);
    if (match) {
      validArticle = match[1].toLowerCase();
      rawLemma = match[2].trim();
      rawWord = `${validArticle} ${rawLemma}`;
    } else if (['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'].includes(art)) {
      validArticle = art;
      rawWord = `${validArticle} ${rawLemma}`;
    } else {
      validArticle = null;
    }
  } else {
    // Verbos, adjetivos, expresiones, adverbios: NUNCA llevan artículo
    validArticle = null;
    rawWord = rawWord.replace(/^(null|undefined|el|la|los|las|un|una)\s+/i, '').trim();
    rawLemma = rawLemma.replace(/^(null|undefined|el|la|los|las|un|una)\s+/i, '').trim();
  }

  let regionalUsage = w.regionalUsage;
  if (cat === 'sustantivo' && !regionalUsage) {
    const key = normalizeNounKey(rawWord, rawLemma);
    if (CURATED_REGIONAL_NOUNS[key]) {
      regionalUsage = CURATED_REGIONAL_NOUNS[key];
    }
  }

  return {
    ...w,
    id: w.id || `word_${Date.now()}_${index}`,
    word: rawWord,
    lemma: rawLemma,
    article: validArticle,
    category: cat,
    regionalUsage: regionalUsage || undefined,
  };
}

// Endpoint: Generate Word Cloud
app.post('/api/generate-cloud', async (req, res) => {
  try {
    const { prompt = '', level = 'Todos', focus = 'general' } = req.body;
    const userApiKey = (req.headers['x-gemini-api-key'] as string) || req.body?.apiKey;
    const client = getGenAIClient(userApiKey);
    const cleanPrompt = String(prompt).trim().toLowerCase();
    const normalizedKey = cleanPrompt.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Fast-path match in curated sets if applicable
    if (CURATED_SETS[normalizedKey] && (!client || cleanPrompt === 'verduras' || cleanPrompt === 'verbos de coccion' || cleanPrompt === 'cocinar')) {
      const sanitizedCurated = {
        ...CURATED_SETS[normalizedKey],
        words: (CURATED_SETS[normalizedKey].words || []).map(sanitizeWordObject),
      };
      return res.json({ success: true, data: sanitizedCurated, source: 'curated' });
    }

    // Try Gemini with multi-model cascade waterfall
    if (client) {
      try {
        const systemInstruction = `Eres un experto pedagogo y lingüista de Español como Lengua Extranjera (ELE / CEFR).
Tu misión es diseñar nubes de palabras léxicas, ricas, precisas y visualmente atractivas para clases de español en línea.
Las palabras deben ser representativas del tema solicitado por el profesor o estudiante.
Para cada palabra incluye:
- 'word': la palabra o locución en español con su artículo si es sustantivo (ej: 'el calabacín', 'la alcachofa', 'sofreír')
- 'lemma': la forma lematizada (ej: 'calabacín', 'sofreír')
- 'article': 'el' | 'la' | 'los' | 'las' | null (si es verbo o adjetivo)
- 'category': 'sustantivo' | 'verbo' | 'adjetivo' | 'expresion'
- 'subcategory': subcategoría temática (ej: 'técnica directa', 'tubérculos', 'emociones positivas', etc.)
- 'level': nivel MCER estimado ('A1' | 'A2' | 'B1' | 'B2' | 'C1')
- 'weight': número entero del 1 al 5 indicando relevancia/frecuencia en la nube (5 = palabra central y grande, 1 = más sutil/específica)
- 'meaning': definición concisa y pedagógica en español simple
- 'translationEn': traducción al inglés para apoyo rápido
- 'example': frase natural y viva en español que muestre el uso real en contexto
- 'collocation': colocación habitual o combinación frecuente en español (ej: 'sofreír a fuego lento')
- 'pronunciationHint': guía de acentuación fonética o apunte de pronunciación útil para estudiantes

Genera entre 14 y 22 palabras bien balanceadas.
Además, genera:
- 'title': Título pedagógico y elegante en español
- 'summary': Resumen de 1-2 oraciones del objetivo léxico de esta nube
- 'suggestedTopics': 4 temas relacionados para que la clase continúe explorando
- 'challenge': Un reto conversacional o ejercicio de producción oral/escrita para los alumnos
- 'oddOneOut': Una 'palabra intrusa' que NO pertenece al campo semántico (con su significado y la razón didáctica por la cual no encaja), ideal para el juego 'Encuentra el intruso'`;

        const userMessage = `Tema pedido: "${prompt}".
Nivel MCER deseado: ${level}.
Enfoque: ${focus}.
Genera una nube de palabras completa y enriquecida en formato JSON.`;

        const cascadeRes = await generateContentWithCascade(
          {
            contents: userMessage,
            systemInstruction,
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                summary: { type: Type.STRING },
                suggestedTopics: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                challenge: { type: Type.STRING },
                oddOneOut: {
                  type: Type.OBJECT,
                  properties: {
                    word: { type: Type.STRING },
                    meaning: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: ['word', 'meaning', 'reason'],
                },
                words: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      word: { type: Type.STRING },
                      lemma: { type: Type.STRING },
                      article: { type: Type.STRING },
                      category: { type: Type.STRING },
                      subcategory: { type: Type.STRING },
                      level: { type: Type.STRING },
                      weight: { type: Type.INTEGER },
                      meaning: { type: Type.STRING },
                      translationEn: { type: Type.STRING },
                      example: { type: Type.STRING },
                      collocation: { type: Type.STRING },
                      pronunciationHint: { type: Type.STRING },
                    },
                    required: ['word', 'category', 'level', 'weight', 'meaning', 'example'],
                  },
                },
              },
              required: ['title', 'summary', 'words', 'suggestedTopics', 'challenge'],
            },
          },
          client
        );

        if (cascadeRes && cascadeRes.text) {
          const parsed = JSON.parse(cascadeRes.text);
          parsed.words = (parsed.words || []).map(sanitizeWordObject);
          return res.json({ success: true, data: parsed, source: 'gemini', modelUsed: cascadeRes.modelUsed });
        }
      } catch (geminiError: any) {
        console.log('[Gemini Cascade] Activando motor léxico ELE por contingencia');
      }
    }

    // Resilient Fallback: Match curated or synthesize
    for (const [key, val] of Object.entries(CURATED_SETS)) {
      if (normalizedKey.includes(key) || key.includes(normalizedKey)) {
        return res.json({
          success: true,
          data: {
            ...val,
            words: (val.words || []).map(sanitizeWordObject),
          },
          source: 'resilient-curated',
          note: 'Servido desde el banco léxico ELE debido a alta demanda en servidores de IA.',
        });
      }
    }

    const fallbackResult = generateDynamicELEFallback(cleanPrompt, level, focus);
    fallbackResult.words = fallbackResult.words.map(sanitizeWordObject);
    return res.json({
      success: true,
      data: fallbackResult,
      source: 'resilient-synthesizer',
      note: 'Servido con el motor léxico didáctico ELE debido a alta demanda temporal en la IA.',
    });
  } catch (err: any) {
    console.error('Error in /api/generate-cloud:', err);
    // Even on ultimate unexpected exception, return reliable fallback
    const emergency = {
      ...CURATED_SETS.verduras,
      words: (CURATED_SETS.verduras.words || []).map(sanitizeWordObject),
    };
    res.json({
      success: true,
      data: emergency,
      source: 'emergency-fallback',
      note: 'Cargado contenido esencial debido a alta demanda temporal.',
    });
  }
});

// Endpoint: Expand Cloud (add more words)
app.post('/api/expand-cloud', async (req, res) => {
  try {
    const { topic, existingWords = [], expansionType = 'more' } = req.body;
    const userApiKey = (req.headers['x-gemini-api-key'] as string) || req.body?.apiKey;
    const client = getGenAIClient(userApiKey);

    if (client) {
      try {
        const typeDescription =
          expansionType === 'advanced'
            ? 'vocabulario avanzado y matizado (niveles B2 y C1)'
            : expansionType === 'verbs'
            ? 'verbos y acciones asociadas al tema'
            : expansionType === 'expressions'
            ? 'expresiones idiomáticas y colocaciones habituales'
            : 'palabras complementarias y variadas para enriquecer la nube';

        const systemInstruction = `Eres un docente experto en ELE. Tu labor es ampliar una nube de palabras sobre el tema "${topic}".
Genera 8 a 12 NUEVAS palabras de tipo: ${typeDescription}.
IMPORTANTE: NO repitas ninguna de estas palabras ya existentes: ${existingWords.join(', ')}.
Reglas gramaticales estrictas:
- El artículo ('el', 'la', 'los', 'las') es OBLIGATORIO para sustantivos y ESTÁ PROHIBIDO (debe ser null) para verbos, adjetivos y expresiones.
- NUNCA pongas el texto literal "null" en la palabra ni en el artículo.
Cada palabra debe tener:
- 'word': término en español
- 'lemma': lema
- 'article': artículo ('el', 'la', 'los', 'las' o null)
- 'category': 'sustantivo' | 'verbo' | 'adjetivo' | 'expresion'
- 'subcategory': área específica
- 'level': 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
- 'weight': 1 a 5
- 'meaning': definición clara en español
- 'translationEn': traducción al inglés
- 'example': frase de ejemplo en español
- 'collocation': colocación común
- 'pronunciationHint': guía de acentuación`;

        const cascadeRes = await generateContentWithCascade(
          {
            contents: `Amplía el vocabulario para "${topic}". Genera nuevas palabras sin repetir.`,
            systemInstruction,
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                newWords: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      word: { type: Type.STRING },
                      lemma: { type: Type.STRING },
                      article: { type: Type.STRING },
                      category: { type: Type.STRING },
                      subcategory: { type: Type.STRING },
                      level: { type: Type.STRING },
                      weight: { type: Type.INTEGER },
                      meaning: { type: Type.STRING },
                      translationEn: { type: Type.STRING },
                      example: { type: Type.STRING },
                      collocation: { type: Type.STRING },
                      pronunciationHint: { type: Type.STRING },
                    },
                    required: ['word', 'category', 'level', 'weight', 'meaning', 'example'],
                  },
                },
              },
              required: ['newWords'],
            },
          },
          client
        );

        if (cascadeRes && cascadeRes.text) {
          const parsed = JSON.parse(cascadeRes.text || '{}');
          const newWords = (parsed.newWords || []).map(sanitizeWordObject);
          return res.json({ success: true, newWords, modelUsed: cascadeRes.modelUsed });
        }
      } catch (err: any) {
        console.log('[Expand Cloud] Usando palabras complementarias didácticas');
      }
    }

    // Resilient educational expansion fallback
    const resilientAdditions = [
      {
        id: `exp_res_${Date.now()}_1`,
        word: 'el matiz',
        lemma: 'matiz',
        article: 'el',
        category: 'sustantivo',
        subcategory: 'precisión',
        level: 'B2',
        weight: 4,
        meaning: 'Rasgo o aspecto sutil que distingue una cosa de otra.',
        translationEn: 'nuance / shade of meaning',
        example: 'Aprender este matiz léxico te permite sonar mucho más natural en español.',
        collocation: 'captar el matiz',
        pronunciationHint: 'ma-TIZ',
      },
      {
        id: `exp_res_${Date.now()}_2`,
        word: 'enriquecer',
        lemma: 'enriquecer',
        article: null,
        category: 'verbo',
        subcategory: 'expansión',
        level: 'B1',
        weight: 4,
        meaning: 'Hacer que algo aumente de valor, variedad o calidad.',
        translationEn: 'to enrich',
        example: 'Leer textos variados ayuda a enriquecer el vocabulario activo.',
        collocation: 'enriquecer el léxico',
        pronunciationHint: 'en-ri-que-CER',
      },
      {
        id: `exp_res_${Date.now()}_3`,
        word: 'a fondo',
        lemma: 'a fondo',
        article: null,
        category: 'expresion',
        subcategory: 'locución adverbial',
        level: 'B1',
        weight: 3,
        meaning: 'Con profundidad, de manera completa y exhaustiva.',
        translationEn: 'thoroughly / in depth',
        example: 'En la clase de hoy analizamos a fondo este campo semántico.',
        collocation: 'conocer a fondo',
        pronunciationHint: 'a FON-do',
      },
      {
        id: `exp_res_${Date.now()}_4`,
        word: 'versátil',
        lemma: 'versátil',
        article: null,
        category: 'adjetivo',
        subcategory: 'flexibilidad',
        level: 'B2',
        weight: 4,
        meaning: 'Capaz de adaptarse con facilidad y rapidez a diversas funciones o contextos.',
        translationEn: 'versatile',
        example: 'Es un verbo muy versátil que se utiliza tanto en cocina como en conversación general.',
        collocation: 'término versátil',
        pronunciationHint: 'ver-SÁ-til',
      },
    ];

    res.json({ success: true, newWords: resilientAdditions, source: 'resilient-fallback' });
  } catch (err: any) {
    console.error('Error in /api/expand-cloud:', err);
    res.json({
      success: true,
      newWords: [
        {
          id: `exp_err_${Date.now()}_1`,
          word: 'compartir',
          lemma: 'compartir',
          article: null,
          category: 'verbo',
          level: 'A1',
          weight: 4,
          meaning: 'Usar o disfrutar de algo en común con otros compañeros.',
          example: 'Me gusta compartir mis dudas y ejemplos con el grupo de clase.',
        },
      ],
    });
  }
});

// Endpoint: Validate user-provided Gemini API Key
app.post('/api/validate-key', async (req, res) => {
  try {
    const userApiKey = (req.headers['x-gemini-api-key'] as string) || req.body?.apiKey;
    const cleanKey = String(userApiKey || '').trim();

    if (!cleanKey) {
      return res.status(400).json({
        success: false,
        error: 'Por favor, introduce una clave de API antes de guardar.',
      });
    }

    if (!cleanKey.startsWith('AIzaSy')) {
      return res.status(400).json({
        success: false,
        error: 'El formato no parece coincidir. Las claves de Google AI Studio suelen empezar por "AIzaSy...".',
      });
    }

    const testClient = new GoogleGenAI({
      apiKey: cleanKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Minimal lightweight ping to verify credentials and quota
    const response = await testClient.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: 'Responde únicamente "OK".',
      config: {
        maxOutputTokens: 5,
      },
    });

    if (response && response.text) {
      return res.json({
        success: true,
        message: '¡Clave de Google Gemini verificada y lista para usar!',
      });
    }

    return res.json({
      success: true,
      message: 'Clave aceptada correctamente.',
    });
  } catch (err: any) {
    console.error('[ValidateKey] Error validando clave:', err);
    let userMsg = 'No se pudo verificar la clave con Google AI Studio.';
    const raw = (err.message || '').toLowerCase();
    const status = String(err.status || err.code || err.statusCode || '');

    if (raw.includes('api_key_invalid') || raw.includes('api key not valid') || raw.includes('invalid api key')) {
      userMsg = 'La clave no es válida. Comprueba haberla copiado completa desde Google AI Studio (empieza con "AIzaSy...").';
    } else if (raw.includes('permission_denied') || status === '403') {
      userMsg = 'Permiso denegado. Asegúrate de tener la API de Gemini habilitada en tu proyecto de Google Cloud.';
    } else if (raw.includes('resource_exhausted') || status === '429') {
      // 429 means the key is authentic, just rate-limited
      return res.json({
        success: true,
        message: 'Clave válida autenticada (límite temporal de peticiones por minuto de la cuenta gratuita).',
      });
    } else if (raw.includes('503') || raw.includes('unavailable') || raw.includes('high demand')) {
      return res.json({
        success: true,
        message: 'Clave guardada localmente (alta demanda momentánea en servidores de Google).',
      });
    }

    return res.status(400).json({
      success: false,
      error: userMsg,
    });
  }
});

// Endpoint: Generate quick classroom activity based on cloud
app.post('/api/generate-activity', async (req, res) => {
  try {
    const { topic, words = [] } = req.body;
    const userApiKey = (req.headers['x-gemini-api-key'] as string) || req.body?.apiKey;
    const client = getGenAIClient(userApiKey);

    if (client) {
      try {
        const systemInstruction = `Eres un docente de español como lengua extranjera creando una actividad interactiva de clase en línea.
Usa las palabras proporcionadas: ${words.slice(0, 15).join(', ')}.
Crea:
- 3 preguntas o desafíos dinámicos de práctica oral o escrita para el aula.
- 1 minijuego de adivinanza / "Adivina la palabra" con pistas en español.`;

        const cascadeRes = await generateContentWithCascade({
          contents: `Genera actividades dinámicas para la clase sobre el tema "${topic}".`,
          systemInstruction,
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              challenges: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    prompt: { type: Type.STRING },
                    requiredWords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    instruction: { type: Type.STRING },
                  },
                  required: ['prompt', 'instruction'],
                },
              },
              riddle: {
                type: Type.OBJECT,
                properties: {
                  clue1: { type: Type.STRING },
                  clue2: { type: Type.STRING },
                  secretWord: { type: Type.STRING },
                },
                required: ['clue1', 'clue2', 'secretWord'],
              },
            },
            required: ['challenges', 'riddle'],
          },
        },
        client
      );

      if (cascadeRes && cascadeRes.text) {
          const parsed = JSON.parse(cascadeRes.text || '{}');
          return res.json({ success: true, activity: parsed });
        }
      } catch (err: any) {
        console.log('[Activity] Usando actividad pedagógica de reserva');
      }
    }

    // Resilient educational activity fallback
    const fallbackActivity = {
      challenges: [
        {
          prompt: 'Reto de conversación en parejas',
          instruction: `Imagina una situación real relacionada con "${topic}" y utiliza al menos 2 palabras de la nube para resolverla.`,
        },
        {
          prompt: 'Práctica de pretérito o subjuntivo',
          instruction: 'Construye una frase en pasado que cuente una anécdota divertida usando una palabra de la nube.',
        },
        {
          prompt: 'Definición para tu compañero',
          instruction: 'Elige una palabra secreta de la nube, descríbela sin nombrarla y deja que tu compañero la adivine.',
        },
      ],
      riddle: {
        clue1: 'Aparece en nuestra nube de palabras y es muy frecuente en el día a día.',
        clue2: 'Tiene una pronunciación clara y se usa tanto en España como en América Latina.',
        secretWord: words[0] || topic,
      },
    };

    res.json({ success: true, activity: fallbackActivity, source: 'resilient-fallback' });
  } catch (err: any) {
    console.error('Error in /api/generate-activity:', err);
    res.json({
      success: true,
      activity: {
        challenges: [
          {
            prompt: 'Práctica de oratoria',
            instruction: 'Crea una frase oral utilizando el vocabulario recién aprendido.',
          },
        ],
      },
    });
  }
});

// Endpoint: Regional Variants and Pan-Hispanic dialectal usage for nouns
app.post('/api/regional-variants', async (req, res) => {
  try {
    const { word = '', lemma = '', category = 'sustantivo' } = req.body;
    const userApiKey = (req.headers['x-gemini-api-key'] as string) || req.body?.apiKey;
    const client = getGenAIClient(userApiKey);
    const cleanWord = String(word).trim();
    const cleanLemma = String(lemma || word).trim();

    if (category.toLowerCase() !== 'sustantivo') {
      return res.json({
        success: false,
        message: 'Las variantes geográficas léxicas solo aplican a sustantivos.',
      });
    }

    const key = normalizeNounKey(cleanWord, cleanLemma);
    if (CURATED_REGIONAL_NOUNS[key]) {
      return res.json({
        success: true,
        regionalUsage: CURATED_REGIONAL_NOUNS[key],
        source: 'curated',
      });
    }

    if (client) {
      try {
        const systemInstruction = `Eres un lingüista y dialectólogo experto en español como lengua extranjera (ELE).
Tu misión es explicar con rigor pedagógico el uso geográfico y las variantes regionales de un sustantivo en los países hispanohablantes.
Debes proporcionar:
- 'primaryTerm': El término analizado con su artículo determinado si procede (ej: 'la alcachofa').
- 'primaryCountries': Lista de países hispanohablantes donde es natural y común este término específico (ej: ['España', 'México', 'Colombia', 'Perú', 'Chile']).
- 'primaryFlags': Lista de emojis de banderas correspondientes (ej: ['🇪🇸', '🇲🇽', '🇨🇴', '🇵🇪', '🇨🇱']).
- 'variants': Array de variantes regionales en otros países hispanohablantes (por ejemplo, si el término es 'alcachofa', en Argentina y Uruguay la variante es 'el alcaucil'; si es 'fresa', en Argentina/Chile es 'la frutilla'; si es 'aguacate', en Cono Sur/Andina es 'la palta'; si es 'autobús', 'el colectivo' en Argentina, 'el camión' en México, 'la guagua' en Cuba/Canarias, etc.).
  Cada elemento contiene:
    - 'countries': array con los países donde se usa esta variante específica
    - 'flags': array de emojis de banderas
    - 'variant': término regional con artículo (ej: 'el alcaucil', 'la palta')
    - 'note': breve apunte didáctico o cultural sobre su origen o matiz
- 'explanation': Resumen pedagógico claro de 1 o 2 oraciones para el estudiante.
- 'isPanhispanicUniversal': booleano (true si es un sustantivo común de uso uniforme en los 21 países como 'el tomate', 'la sal', 'el agua', 'la mesa').`;

        const cascadeRes = await generateContentWithCascade(
          {
            contents: `Analiza el sustantivo "${cleanLemma}". ¿En qué países hispanohablantes se usa principalmente y qué variantes regionales o geosinónimos tienen otros países hispanohablantes?`,
            systemInstruction,
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                primaryTerm: { type: Type.STRING },
                primaryCountries: { type: Type.ARRAY, items: { type: Type.STRING } },
                primaryFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
                variants: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      countries: { type: Type.ARRAY, items: { type: Type.STRING } },
                      flags: { type: Type.ARRAY, items: { type: Type.STRING } },
                      variant: { type: Type.STRING },
                      note: { type: Type.STRING },
                    },
                    required: ['countries', 'variant'],
                  },
                },
                explanation: { type: Type.STRING },
                isPanhispanicUniversal: { type: Type.BOOLEAN },
              },
              required: ['primaryTerm', 'primaryCountries', 'variants', 'explanation'],
            },
          },
          client
        );

        if (cascadeRes && cascadeRes.text) {
          const parsed = JSON.parse(cascadeRes.text);
          return res.json({
            success: true,
            regionalUsage: parsed,
            source: 'gemini',
            modelUsed: cascadeRes.modelUsed,
          });
        }
      } catch (geminiErr) {
        console.log('[RegionalVariants] Error en IA, aplicando sintetizador léxico panhispánico');
      }
    }

    const fallbackUsage = createUniversalNounUsage(cleanLemma);
    return res.json({
      success: true,
      regionalUsage: fallbackUsage,
      source: 'fallback',
    });
  } catch (err: any) {
    console.error('Error in /api/regional-variants:', err);
    res.json({
      success: false,
      message: err.message,
    });
  }
});

// Cache for generated TTS audio to ensure instant replay
const ttsAudioCache = new Map<string, string>();

// Endpoint: High-fidelity Studio Text-to-Speech using Gemini TTS
app.post('/api/tts', async (req, res) => {
  try {
    const { text = '', voice = 'Kore', rate = 0.9 } = req.body;
    const userApiKey = (req.headers['x-gemini-api-key'] as string) || req.body?.apiKey;
    const client = getGenAIClient(userApiKey);
    const cleanText = String(text).trim();
    if (!cleanText) {
      return res.status(400).json({ success: false, error: 'Texto requerido para pronunciar' });
    }

    // Always use one standard high quality voice ("Kore")
    const enforcedVoice = 'Kore';
    const cacheKey = `${cleanText.toLowerCase()}_${enforcedVoice}_${rate}`;
    if (ttsAudioCache.has(cacheKey)) {
      return res.json({
        success: true,
        audioData: ttsAudioCache.get(cacheKey),
        cached: true,
        voice: enforcedVoice,
      });
    }

    if (!client) {
      return res.json({
        success: false,
        error: 'API no configurada',
      });
    }

    // TTS models available
    const ttsModels = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];
    let audioBase64: string | null = null;
    let modelUsed = '';

    for (const model of ttsModels) {
      if (isModelInCooldown(model)) continue;
      try {
        const response = await client.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  // CRITICAL: Give only the raw text to speak. Do NOT prefix with instructions like "Pronuncia..."
                  // Gemini TTS reads the literal text in the user part.
                  text: cleanText,
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: enforcedVoice },
              },
            },
          },
        });

        const part = response.candidates?.[0]?.content?.parts?.[0];
        if (part?.inlineData?.data) {
          audioBase64 = part.inlineData.data;
          modelUsed = model;
          break;
        }
      } catch (ttsErr: any) {
        // Handle 429 quota rate limits gracefully: cool down for 65 seconds
        if (isTransientOrDemandError(ttsErr)) {
          markModelCooldown(model, 65 * 1000);
        }
      }
    }

    if (audioBase64) {
      const dataUri = `data:audio/wav;base64,${audioBase64}`;
      ttsAudioCache.set(cacheKey, dataUri);
      return res.json({
        success: true,
        audioData: dataUri,
        cached: false,
        modelUsed,
        voice: enforcedVoice,
      });
    }

    return res.json({
      success: false,
      error: 'TTS neural temporalmente ocupado, usando síntesis nativa de alta fidelidad',
    });
  } catch (err: any) {
    console.error('Error in /api/tts:', err);
    res.json({
      success: false,
      error: err.message,
    });
  }
});

// Vite Middleware for development & Static Files for production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, port },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[NubeELE Server] Corriendo en http://localhost:${port} con sistema de fallbacks multimodelo activo.`);
  });
}

startServer();
