/** Read only complete word objects from a JSON response still arriving from Gemini. */
export function completeWords(text: string): any[] {
  // The response schema orders words first, so strings in later metadata cannot match.
  const start = /^\s*\{\s*"words"\s*:\s*\[/.exec(text);
  if (!start) return [];
  const words: any[] = [];
  let depth = 0, quoted = false, escaped = false, objectStart = -1;
  for (let i = start[0].length; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '{') { if (depth++ === 0) objectStart = i; }
    else if (char === '}' && depth > 0 && --depth === 0) {
      try {
        const word = JSON.parse(text.slice(objectStart, i + 1));
        if (typeof word.word !== 'string' || !word.word.trim()) return words;
        words.push(word);
      } catch { return words; }
    } else if (char === ']' && depth === 0) break;
  }
  return words;
}
