import { format, formatDistanceToNow } from 'date-fns';
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  Bug,
  CheckSquare,
  ChevronsDown,
  ChevronsUp,
  Equal,
  Layers,
  Lightbulb,
  GitBranch,
  type LucideIcon,
} from 'lucide-react';
import type { IssueType, Priority, StatusCategory } from '@tasku/types';

// ---------------------------------------------------------------------------
// Issue type icons + colors
// ---------------------------------------------------------------------------

export const ISSUE_TYPE_META: Record<
  IssueType,
  { icon: LucideIcon; color: string; label: string }
> = {
  IDEA: { icon: Lightbulb, color: '#F1A100', label: 'Idea' },
  EPIC: { icon: Layers, color: '#8270DB', label: 'Epic' },
  STORY: { icon: Bookmark, color: '#22A06B', label: 'Story' },
  TASK: { icon: CheckSquare, color: '#1868DB', label: 'Task' },
  BUG: { icon: Bug, color: '#E2483D', label: 'Bug' },
  SUBTASK: { icon: GitBranch, color: '#1D9BAD', label: 'Subtask' },
};

export function issueTypeIcon(type: IssueType): LucideIcon {
  return ISSUE_TYPE_META[type].icon;
}

// ---------------------------------------------------------------------------
// Priority icons + colors
// ---------------------------------------------------------------------------

export const PRIORITY_META: Record<
  Priority,
  { icon: LucideIcon; color: string; label: string }
> = {
  HIGHEST: { icon: ChevronsUp, color: '#CA3521', label: 'Highest' },
  HIGH: { icon: ArrowUp, color: '#E9730C', label: 'High' },
  MEDIUM: { icon: Equal, color: '#D68B00', label: 'Medium' },
  LOW: { icon: ArrowDown, color: '#0C66E4', label: 'Low' },
  LOWEST: { icon: ChevronsDown, color: '#0055CC', label: 'Lowest' },
};

export function priorityIcon(priority: Priority): LucideIcon {
  return PRIORITY_META[priority].icon;
}

// ---------------------------------------------------------------------------
// Status category styling (column headers / badges)
// ---------------------------------------------------------------------------

export const STATUS_CATEGORY_META: Record<
  StatusCategory,
  { color: string; bg: string; label: string }
> = {
  TODO: { color: '#626F86', bg: '#DFE1E6', label: 'To Do' },
  IN_PROGRESS: { color: '#0C66E4', bg: '#E9F2FF', label: 'In Progress' },
  DONE: { color: '#216E4E', bg: '#DCFFF1', label: 'Done' },
};

// ---------------------------------------------------------------------------
// Avatars: deterministic initials + background color
// ---------------------------------------------------------------------------

// Atlassian-style avatar palette
const AVATAR_COLORS = [
  '#0C66E4',
  '#6554C0',
  '#00857A',
  '#943D73',
  '#E9730C',
  '#5E4DB2',
  '#206A83',
  '#8270DB',
  '#216E4E',
  '#974F0C',
  '#1D9BAD',
  '#AE2E24',
];

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

export function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return '';
  }
}

/** Short, human date (e.g. "Jun 30, 2026"). Returns '' for null/invalid. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return format(new Date(iso), 'MMM d, yyyy');
  } catch {
    return '';
  }
}

/** For <input type="date"> values (yyyy-MM-dd). */
export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return format(new Date(iso), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Duration / time-tracking
// ---------------------------------------------------------------------------

/** Format minutes as a compact "2h 30m" string. 0 -> "0m". */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m === 0) return '0m';
  const h = Math.floor(m / 60);
  const rem = m % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (rem > 0) parts.push(`${rem}m`);
  return parts.join(' ');
}

/**
 * Parse a human duration into minutes. Accepts "2h 30m", "90m", "1.5h",
 * "2h", "45" (bare number = minutes). Returns null if nothing parseable.
 */
export function parseDuration(str: string): number | null {
  const s = str.trim().toLowerCase();
  if (!s) return null;

  // Bare number -> minutes.
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n) : null;
  }

  let total = 0;
  let matched = false;
  const re = /(\d+(?:\.\d+)?)\s*([hm])/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(s)) !== null) {
    matched = true;
    const value = Number(match[1]);
    if (!Number.isFinite(value)) continue;
    total += match[2] === 'h' ? value * 60 : value;
  }
  if (!matched) return null;
  return Math.round(total);
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

/** Pick readable text color (#000/#fff) for an arbitrary hex background. */
export function contrastText(hex: string): string {
  const c = hex.replace('#', '');
  if (c.length !== 6) return '#111827';
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111827' : '#ffffff';
}

export function humanizeField(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}
