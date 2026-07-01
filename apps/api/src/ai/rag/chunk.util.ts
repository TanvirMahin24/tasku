/**
 * Split plain text into overlapping chunks for embedding. Defaults ~800 chars
 * with 120 chars of overlap so retrieval keeps sentence context across borders.
 */
export function chunkText(
  text: string,
  size = 800,
  overlap = 120,
): string[] {
  const clean = (text || '').replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const step = Math.max(1, size - overlap);
  const chunks: string[] = [];
  for (let start = 0; start < clean.length; start += step) {
    const slice = clean.slice(start, start + size).trim();
    if (slice) chunks.push(slice);
    if (start + size >= clean.length) break;
  }
  return chunks;
}

/**
 * Best-effort plain-text extraction from a possibly-BlockNote/ProseMirror JSON
 * document (issue descriptions are stored as JSON). Falls back to the raw
 * string when it isn't JSON.
 */
export function docToText(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return trimmed;
  let doc: unknown;
  try {
    doc = JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
  const parts: string[] = [];
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node.text === 'string') parts.push(node.text);
    if (node.content) visit(node.content);
    if (node.children) visit(node.children);
  };
  visit(doc);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** Format a numeric vector as a pgvector literal: `[0.1,0.2,...]`. */
export function toVectorLiteral(nums: number[]): string {
  return `[${nums.join(',')}]`;
}
