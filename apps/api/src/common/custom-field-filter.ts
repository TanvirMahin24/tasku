import { type Prisma } from '@prisma/client';
import type { CustomFieldCondition, CustomFieldOp } from '@tasku/types';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Build the AND clauses that filter issues by custom-field values.
 *
 * Custom field values live in `CustomFieldValue` rows as a Json column whose
 * shape depends on the field type (string / number / boolean / ISO date
 * string / string[]). Because Json matching semantics vary by op and type we
 * evaluate each condition in JS and reduce it to an issue-id set that is
 * AND-ed into the issue `where`.
 *
 * Each returned clause narrows the result set; multiple conditions therefore
 * intersect (all must match). A condition that matches nothing yields
 * `{ id: { in: [] } }`, which makes the whole query empty — the intended
 * "no rows satisfy this filter" behaviour.
 */
export async function buildCustomFieldWhere(
  prisma: PrismaService,
  conditions?: CustomFieldCondition[],
): Promise<Prisma.IssueWhereInput[]> {
  if (!conditions?.length) return [];

  const clauses: Prisma.IssueWhereInput[] = [];
  for (const cond of conditions) {
    if (!cond?.fieldId) continue;

    const rows = await prisma.customFieldValue.findMany({
      where: { fieldId: cond.fieldId },
      select: { issueId: true, value: true },
    });

    if (cond.op === 'notset') {
      // "not set" = no value row, or an empty value row.
      const idsWithValue = rows
        .filter((r) => !isEmpty(r.value))
        .map((r) => r.issueId);
      // NOTE: idsWithValue is an unbounded IN list; fine for now, but if a
      // field is populated on >5k issues this should move to a raw query.
      clauses.push({ id: { notIn: idsWithValue } });
      continue;
    }

    const matched = rows
      .filter((r) => matchesCondition(cond.op, cond.value, r.value))
      .map((r) => r.issueId);
    // NOTE: guard against a huge IN — acceptable for now (< ~5k issues/field).
    clauses.push({ id: { in: matched } });
  }
  return clauses;
}

type CondValue = CustomFieldCondition['value'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

function isEmpty(v: unknown): boolean {
  return (
    v === null ||
    v === undefined ||
    v === '' ||
    (Array.isArray(v) && v.length === 0)
  );
}

function isDateStr(v: unknown): v is string {
  return typeof v === 'string' && DATE_RE.test(v);
}

function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return Boolean(v);
}

/** Evaluate one op against a single stored value. */
function matchesCondition(
  op: CustomFieldOp,
  condValue: CondValue,
  stored: unknown,
): boolean {
  switch (op) {
    case 'set':
      return !isEmpty(stored);
    case 'notset':
      return isEmpty(stored);
    case 'eq':
      return eqMatch(condValue, stored);
    case 'contains':
      return containsMatch(condValue, stored);
    case 'gt': {
      const c = compare(stored, condValue);
      return c !== null && c > 0;
    }
    case 'lt': {
      const c = compare(stored, condValue);
      return c !== null && c < 0;
    }
    default:
      return false;
  }
}

/** Strict-ish equality, per field type inferred from the stored value. */
function eqMatch(condValue: CondValue, stored: unknown): boolean {
  if (isEmpty(stored)) return false;
  if (Array.isArray(stored)) {
    // multi-select: value is present when the array includes it.
    return stored.some((s) => String(s) === String(condValue));
  }
  if (typeof stored === 'number') {
    return Number(condValue) === stored;
  }
  if (typeof stored === 'boolean') {
    return toBool(condValue) === stored;
  }
  if (isDateStr(stored) && isDateStr(String(condValue))) {
    // dates compared by calendar day (timezone-safe date-part slice).
    return String(stored).slice(0, 10) === String(condValue).slice(0, 10);
  }
  return String(stored) === String(condValue);
}

/** Substring for text, or membership for multi-select. */
function containsMatch(condValue: CondValue, stored: unknown): boolean {
  if (isEmpty(stored)) return false;
  if (Array.isArray(stored)) {
    return stored.some((s) => String(s) === String(condValue));
  }
  const needle = String(condValue).toLowerCase();
  return String(stored).toLowerCase().includes(needle);
}

/**
 * Ordered comparison of `stored` vs `condValue`: returns >0 when stored is
 * greater, <0 when smaller, 0 when equal, or null when not comparable.
 */
function compare(stored: unknown, condValue: CondValue): number | null {
  if (isEmpty(stored)) return null;
  if (typeof stored === 'number') {
    const b = Number(condValue);
    return Number.isNaN(b) ? null : stored - b;
  }
  if (isDateStr(stored)) {
    const a = new Date(stored).getTime();
    const b = new Date(String(condValue)).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    return a - b;
  }
  // Fall back to numeric compare when both look numeric, else lexicographic.
  const a = Number(stored);
  const b = Number(condValue);
  if (!Number.isNaN(a) && !Number.isNaN(b)) return a - b;
  const s = String(stored);
  const c = String(condValue);
  return s < c ? -1 : s > c ? 1 : 0;
}
