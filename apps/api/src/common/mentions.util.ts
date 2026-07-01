// Unified @-mention token, embeddable in plain text (comments / replies):
//   @[LABEL](mention:TYPE:ID)   e.g. @[Alice](mention:user:ckxyz…)
// TYPE is user | issue | knowledge | board. The BlockNote description stores
// mentions as inline content nodes instead — see userMentionIdsFromDoc.

const TOKEN_RE = /@\[[^\]]*\]\(mention:(user|issue|knowledge|board):([^)]+)\)/g;

export interface ParsedMention {
  type: 'user' | 'issue' | 'knowledge' | 'board';
  id: string;
}

/** All typed mentions found in a plain-text body (comment/reply). */
export function parseMentions(body: string): ParsedMention[] {
  const out: ParsedMention[] = [];
  const re = new RegExp(TOKEN_RE); // fresh instance — RegExp is stateful
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    out.push({ type: m[1] as ParsedMention['type'], id: m[2] });
  }
  return out;
}

/** De-duplicated user ids mentioned in a plain-text body. */
export function userMentionIdsFromText(body: string): string[] {
  return [
    ...new Set(
      parseMentions(body)
        .filter((x) => x.type === 'user')
        .map((x) => x.id),
    ),
  ];
}

/**
 * De-duplicated user ids mentioned in a BlockNote description doc (JSON string).
 * Walks the document for inline "mention" content whose props.type === 'user'.
 * Tolerant of malformed input (returns []).
 */
export function userMentionIdsFromDoc(json: string | null | undefined): string[] {
  if (!json) return [];
  let doc: unknown;
  try {
    doc = JSON.parse(json);
  } catch {
    return [];
  }
  const ids = new Set<string>();
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (
      node.type === 'mention' &&
      node.props &&
      node.props.type === 'user' &&
      typeof node.props.id === 'string'
    ) {
      ids.add(node.props.id);
    }
    if (Array.isArray(node.content)) node.content.forEach(visit);
    if (Array.isArray(node.children)) node.children.forEach(visit);
  };
  visit(doc);
  return [...ids];
}
