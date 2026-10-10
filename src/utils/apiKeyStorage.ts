/**
 * Local storage manager for user-provided Gemini API Key.
 * Keeps user's key strictly in browser localStorage and injects it into client API requests.
 */

const STORAGE_KEY = 'nube_ele_gemini_api_key';

export function getStoredApiKey(): string | null {
  try {
    const key = localStorage.getItem(STORAGE_KEY);
    return key && key.trim().length > 0 ? key.trim() : null;
  } catch {
    return null;
  }
}

export function setStoredApiKey(key: string): void {
  try {
    const trimmed = key.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    // Dispatch event so other components update their state reactively
    window.dispatchEvent(new Event('gemini-api-key-changed'));
  } catch {
    // Ignore storage errors in private mode
  }
}

export function removeStoredApiKey(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('gemini-api-key-changed'));
  } catch {
    // Ignore
  }
}

export function getMaskedApiKey(key: string | null): string {
  if (!key) return '';
  if (key.length <= 10) return '••••••••';
  return `${key.slice(0, 6)}••••••••${key.slice(-4)}`;
}

export function getApiHeaders(additionalHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...additionalHeaders,
  };
  const customKey = getStoredApiKey();
  if (customKey) {
    headers['x-gemini-api-key'] = customKey;
  }
  return headers;
}
