// Lexorank helpers for board ordering.
// Wraps the `lexorank` package so issue/board/move logic stays readable.
import { LexoRank } from 'lexorank';

/** A fresh middle rank, used for the first card in an empty column. */
export function initialRank(): string {
  return LexoRank.middle().toString();
}

/** Rank that sorts strictly AFTER `prev` (append to bottom of a column). */
export function rankAfter(prev: string | null | undefined): string {
  if (!prev) return initialRank();
  return LexoRank.parse(prev).genNext().toString();
}

/** Rank that sorts strictly BEFORE `next` (prepend to top of a column). */
export function rankBefore(next: string | null | undefined): string {
  if (!next) return initialRank();
  return LexoRank.parse(next).genPrev().toString();
}

/**
 * Rank that sorts between `before` and `after`.
 * - both present  -> between them
 * - only before   -> after `before` (dropped at the bottom)
 * - only after    -> before `after` (dropped at the top)
 * - neither       -> middle (empty column)
 */
export function rankBetween(
  before: string | null | undefined,
  after: string | null | undefined,
): string {
  if (before && after) {
    return LexoRank.parse(before).between(LexoRank.parse(after)).toString();
  }
  if (before) return rankAfter(before);
  if (after) return rankBefore(after);
  return initialRank();
}
