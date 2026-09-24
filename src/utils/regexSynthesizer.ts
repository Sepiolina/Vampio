/**
 * Robust Client-Side RegEx Data Synthesizer
 * Generates realistic synthetic mock data matching arbitrary Regular Expression patterns.
 */

// Generate valid Thai Citizen ID (13 digits with official Modulo 11 check digit)
export function generateThaiNationalId(): string {
  const firstDigitOptions = [1, 2, 3, 4, 5, 8];
  const digits: number[] = [firstDigitOptions[Math.floor(Math.random() * firstDigitOptions.length)]];

  for (let i = 1; i < 12; i++) {
    digits.push(Math.floor(Math.random() * 10));
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (13 - i);
  }
  const checkDigit = (11 - (sum % 11)) % 10;
  digits.push(checkDigit);

  return digits.join('');
}

/**
 * Expands a character set string (like "1-9A-HJ-NPR-Z", "a-f0-9", "0-9X") into a concrete pool of allowed characters.
 */
export function expandCharacterSet(setStr: string, isNegated: boolean = false): string {
  let pool = '';
  let i = 0;

  while (i < setStr.length) {
    // Check for escape sequences inside bracket e.g. \d, \w, \s
    if (setStr[i] === '\\' && i + 1 < setStr.length) {
      const esc = setStr[i + 1];
      if (esc === 'd') pool += '0123456789';
      else if (esc === 'w') pool += 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';
      else if (esc === 's') pool += ' ';
      else pool += esc;
      i += 2;
      continue;
    }

    // Check for character range like X-Y (e.g. A-Z, 0-9, A-H, J-N)
    if (i + 2 < setStr.length && setStr[i + 1] === '-' && setStr[i] !== '\\') {
      const startCharCode = setStr.charCodeAt(i);
      const endCharCode = setStr.charCodeAt(i + 2);

      if (startCharCode <= endCharCode) {
        for (let code = startCharCode; code <= endCharCode; code++) {
          pool += String.fromCharCode(code);
        }
      } else {
        pool += setStr[i] + '-' + setStr[i + 2];
      }
      i += 3;
      continue;
    }

    // Single literal character
    pool += setStr[i];
    i++;
  }

  // If pool is empty for any reason, fallback to alphanumeric
  if (!pool) {
    pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  }

  // Deduplicate pool
  const uniquePool = Array.from(new Set(pool.split(''))).join('');

  if (isNegated) {
    const allAscii = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()-_=+[]{}|;:,.<>?';
    const negated = allAscii.split('').filter((c) => !uniquePool.includes(c)).join('');
    return negated.length > 0 ? negated : 'X';
  }

  return uniquePool;
}

/**
 * Parses quantifier syntax like {3}, {2,5}, {2,}, +, *, ?
 */
function parseQuantifier(
  pattern: string,
  startIndex: number
): { repeatCount: number; nextIndex: number } {
  if (startIndex >= pattern.length) {
    return { repeatCount: 1, nextIndex: startIndex };
  }

  const char = pattern[startIndex];

  if (char === '{') {
    const closeIdx = pattern.indexOf('}', startIndex);
    if (closeIdx !== -1) {
      const quantContent = pattern.slice(startIndex + 1, closeIdx).trim();
      let count = 1;

      if (quantContent.includes(',')) {
        const parts = quantContent.split(',').map((s) => s.trim());
        const min = parseInt(parts[0], 10) || 0;
        const max = parts[1] ? parseInt(parts[1], 10) : min + 3;
        const lo = Math.max(0, min);
        const hi = Math.max(lo, isNaN(max) ? lo + 3 : max);
        count = Math.floor(Math.random() * (hi - lo + 1)) + lo;
      } else {
        count = parseInt(quantContent, 10) || 1;
      }

      return { repeatCount: count, nextIndex: closeIdx + 1 };
    }
  }

  if (char === '+') {
    // 1 to 3 times
    return { repeatCount: Math.floor(Math.random() * 3) + 1, nextIndex: startIndex + 1 };
  }

  if (char === '*') {
    // 0 to 3 times
    return { repeatCount: Math.floor(Math.random() * 4), nextIndex: startIndex + 1 };
  }

  if (char === '?') {
    // 0 or 1 time
    return { repeatCount: Math.random() < 0.5 ? 0 : 1, nextIndex: startIndex + 1 };
  }

  return { repeatCount: 1, nextIndex: startIndex };
}

/**
 * Main function: generate realistic synthetic string from any RegEx pattern
 */
export function generateRegexString(pattern: string): string {
  if (!pattern) return '';

  const trimmed = pattern.trim();

  // 1. Built-in special generators
  if (trimmed === 'thai_id_checksum') {
    return generateThaiNationalId();
  }

  let cleanPattern = trimmed;
  // Strip leading ^ and trailing $ if present
  if (cleanPattern.startsWith('^')) cleanPattern = cleanPattern.slice(1);
  if (cleanPattern.endsWith('$')) cleanPattern = cleanPattern.slice(0, -1);

  let result = '';
  let i = 0;

  while (i < cleanPattern.length) {
    const char = cleanPattern[i];

    // 1. Parentheses Group: (opt1|opt2|opt3) or (abc)
    if (char === '(') {
      let depth = 1;
      let closeIdx = -1;

      for (let j = i + 1; j < cleanPattern.length; j++) {
        if (cleanPattern[j] === '\\') {
          j++; // skip escaped
          continue;
        }
        if (cleanPattern[j] === '(') depth++;
        else if (cleanPattern[j] === ')') {
          depth--;
          if (depth === 0) {
            closeIdx = j;
            break;
          }
        }
      }

      if (closeIdx !== -1) {
        let groupInner = cleanPattern.slice(i + 1, closeIdx);
        // Strip non-capturing group prefix (?:...)
        if (groupInner.startsWith('?:')) {
          groupInner = groupInner.slice(2);
        }

        const options = groupInner.split('|');
        const chosenOption = options[Math.floor(Math.random() * options.length)] || '';

        const quant = parseQuantifier(cleanPattern, closeIdx + 1);
        for (let r = 0; r < quant.repeatCount; r++) {
          result += generateRegexString(chosenOption);
        }

        i = quant.nextIndex;
        continue;
      }
    }

    // 2. Character Class Bracket: [...] or [^...]
    if (char === '[') {
      let closeIdx = -1;
      for (let j = i + 1; j < cleanPattern.length; j++) {
        if (cleanPattern[j] === '\\') {
          j++;
          continue;
        }
        if (cleanPattern[j] === ']') {
          closeIdx = j;
          break;
        }
      }

      if (closeIdx !== -1) {
        let bracketContent = cleanPattern.slice(i + 1, closeIdx);
        let isNegated = false;
        if (bracketContent.startsWith('^')) {
          isNegated = true;
          bracketContent = bracketContent.slice(1);
        }

        const pool = expandCharacterSet(bracketContent, isNegated);
        const quant = parseQuantifier(cleanPattern, closeIdx + 1);

        for (let r = 0; r < quant.repeatCount; r++) {
          result += pool[Math.floor(Math.random() * pool.length)];
        }

        i = quant.nextIndex;
        continue;
      }
    }

    // 3. Escape sequences: \d, \w, \s, \t, etc.
    if (char === '\\' && i + 1 < cleanPattern.length) {
      const esc = cleanPattern[i + 1];
      const quant = parseQuantifier(cleanPattern, i + 2);

      let pool = '';
      if (esc === 'd') pool = '0123456789';
      else if (esc === 'w') pool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';
      else if (esc === 's') pool = ' ';
      else if (esc === 't') pool = '\t';
      else pool = esc; // Literal escaped character (e.g. \., \-, \/, \+, \*)

      for (let r = 0; r < quant.repeatCount; r++) {
        result += pool[Math.floor(Math.random() * pool.length)];
      }

      i = quant.nextIndex;
      continue;
    }

    // 4. Dot wildcard '.'
    if (char === '.') {
      const quant = parseQuantifier(cleanPattern, i + 1);
      const pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      for (let r = 0; r < quant.repeatCount; r++) {
        result += pool[Math.floor(Math.random() * pool.length)];
      }
      i = quant.nextIndex;
      continue;
    }

    // 5. Standard Literal character
    const quant = parseQuantifier(cleanPattern, i + 1);
    for (let r = 0; r < quant.repeatCount; r++) {
      result += char;
    }
    i = quant.nextIndex;
  }

  return result;
}
