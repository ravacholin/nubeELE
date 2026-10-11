import type { CloudData } from '../types';
import { MAX_CLOUD_WORDS, type CloudFocus } from './cloudWords';

export interface CloudSnapshot {
  version: 1;
  topic: string;
  focus: CloudFocus;
  cloud: CloudData;
}
type SnapshotStorage = Pick<Storage, 'getItem' | 'setItem'>;
const STORAGE_KEY = 'nube_ele_last_cloud_v1';

export function readCloudSnapshot(storage?: SnapshotStorage): CloudSnapshot | null {
  try {
    const raw = (storage ?? window.localStorage).getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (value?.version !== 1 || typeof value.topic !== 'string'
      || !['more', 'verbs', 'expressions', 'advanced'].includes(value.focus)
      || typeof value.cloud?.title !== 'string' || typeof value.cloud.summary !== 'string'
      || typeof value.cloud.challenge !== 'string' || !Array.isArray(value.cloud.suggestedTopics)
      || !value.cloud.suggestedTopics.every((topic: unknown) => typeof topic === 'string')
      || !Array.isArray(value.cloud.words) || value.cloud.words.length > MAX_CLOUD_WORDS
      || !value.cloud.words.every((word: any) => word && typeof word.id === 'string'
        && typeof word.word === 'string' && !!word.word.trim() && typeof word.lemma === 'string'
        && (word.article === null || typeof word.article === 'string')
        && typeof word.meaning === 'string' && typeof word.example === 'string'
        && ['sustantivo', 'verbo', 'adjetivo', 'expresion', 'adverbio'].includes(word.category)
        && ['A1', 'A2', 'B1', 'B2', 'C1'].includes(word.level)
        && Number.isInteger(word.weight) && word.weight >= 1 && word.weight <= 5)) return null;
    return value as CloudSnapshot;
  } catch { return null; }
}

export function saveCloudSnapshot(snapshot: CloudSnapshot, storage?: SnapshotStorage): void {
  try {
    (storage ?? window.localStorage).setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch { /* Private browsing and full storage must not interrupt a class. */ }
}
