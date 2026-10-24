/** Byte-based decoding; legacy encodings are estimates and never override valid UTF-8. */
export type SampleEncoding = 'UTF-8' | 'UTF-8 with BOM' | 'UTF-16 LE' | 'UTF-16 BE' | 'TIS-620 / Windows-874' | 'Windows-1252 / ISO-8859-1' | 'ASCII';
export interface DecodedSample {
  text: string;
  encoding: SampleEncoding;
  confidence: number;
  evidence: string[];
  binary: boolean;
}

export function decodeTextSample(bytes: Uint8Array, truncated = false): DecodedSample {
  let encoding: SampleEncoding = 'UTF-8';
  let label = 'utf-8';
  let confidence = 98;
  const evidence: string[] = [];
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    encoding = 'UTF-8 with BOM'; evidence.push('UTF-8 byte order mark'); confidence = 100;
  } else if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = 'UTF-16 LE'; label = 'utf-16le'; evidence.push('UTF-16 little endian byte order mark'); confidence = 100;
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = 'UTF-16 BE'; label = 'utf-16be'; evidence.push('UTF-16 big endian byte order mark'); confidence = 100;
  } else {
    // BOM-less UTF-16 requires a strong alternating NUL pattern across several code units.
    const pairs = Math.floor(bytes.length / 2);
    let evenNulls = 0; let oddNulls = 0;
    for (let i = 0; i < pairs * 2; i += 2) {
      if (bytes[i] === 0) evenNulls++;
      if (bytes[i + 1] === 0) oddNulls++;
    }
    if (pairs >= 4 && oddNulls / pairs > 0.6 && evenNulls / pairs < 0.1) {
      encoding = 'UTF-16 LE'; label = 'utf-16le'; confidence = 85; evidence.push('Alternating NUL bytes suggest UTF-16 LE');
    } else if (pairs >= 4 && evenNulls / pairs > 0.6 && oddNulls / pairs < 0.1) {
      encoding = 'UTF-16 BE'; label = 'utf-16be'; confidence = 85; evidence.push('Alternating NUL bytes suggest UTF-16 BE');
    } else {
      let validUtf8 = true;
      try { new TextDecoder('utf-8', { fatal: true }).decode(bytes, { stream: truncated }); } catch { validUtf8 = false; }
      if (validUtf8) {
        encoding = bytes.every(b => b < 128) ? 'ASCII' : 'UTF-8';
        evidence.push(encoding === 'ASCII' ? 'All sampled bytes are ASCII' : 'Sample validates as UTF-8');
      } else {
        const high = Array.from(bytes).filter(b => b >= 128);
        const thai = high.filter(b => b >= 0xa1 && b <= 0xda || b >= 0xdf && b <= 0xfb);
        // Byte ranges overlap Western encodings, so this remains an explicitly uncertain guess.
        if (thai.length >= 3 && thai.length / high.length > 0.8) {
          encoding = 'TIS-620 / Windows-874'; label = 'windows-874'; confidence = 65;
          evidence.push('Invalid UTF-8; Thai legacy byte range predominates (ambiguous without encoding metadata)');
        } else {
          encoding = 'Windows-1252 / ISO-8859-1'; label = 'windows-1252'; confidence = 45;
          evidence.push('Invalid UTF-8; Western single-byte fallback (encoding unconfirmed)');
        }
      }
    }
  }
  const text = new TextDecoder(label).decode(bytes, { stream: truncated });
  const controls = Array.from(text).filter(c => /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(c)).length;
  const signature = (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4)
    || (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    || (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    || (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)
    || (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0);
  const binary = signature || controls > Math.max(0, text.length * 0.02);
  if (binary) evidence.push('Binary signature or control-byte density; excluded from text inference');
  return { text: binary ? '' : text, encoding, confidence: binary ? 0 : confidence, evidence, binary };
}

export function detectNewlines(text: string): 'CRLF (Windows)' | 'LF (Unix)' | 'CR (Legacy)' | 'Mixed' | 'None' {
  const crlf = text.includes('\r\n');
  const remaining = text.replace(/\r\n/g, '');
  const lf = remaining.includes('\n'); const cr = remaining.includes('\r');
  if (Number(crlf) + Number(lf) + Number(cr) > 1) return 'Mixed';
  return crlf ? 'CRLF (Windows)' : lf ? 'LF (Unix)' : cr ? 'CR (Legacy)' : 'None';
}
