import type { MentionType } from '@tasku/types';

// Unified @-mention token embedded in comment/reply bodies:
//   @[LABEL](mention:TYPE:ID)
// The BlockNote description stores mentions as inline nodes instead.
export const MENTION_RE =
  /@\[([^\]]*)\]\(mention:(user|issue|knowledge|board):([^)]+)\)/g;

export interface Mention {
  type: MentionType;
  id: string;
  label: string;
}

export function buildMentionToken(m: Mention): string {
  return `@[${m.label}](mention:${m.type}:${m.id})`;
}

export type MentionSegment =
  | { kind: 'text'; value: string }
  | { kind: 'mention'; mention: Mention };

/** Split a body into plain-text and mention segments for rendering. */
export function parseMentionSegments(body: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  const re = new RegExp(MENTION_RE); // fresh instance — RegExp is stateful
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) {
      segments.push({ kind: 'text', value: body.slice(last, m.index) });
    }
    segments.push({
      kind: 'mention',
      mention: { label: m[1], type: m[2] as MentionType, id: m[3] },
    });
    last = m.index + m[0].length;
  }
  if (last < body.length) {
    segments.push({ kind: 'text', value: body.slice(last) });
  }
  return segments;
}
