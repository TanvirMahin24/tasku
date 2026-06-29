import { formatDistanceToNow } from 'date-fns';
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
  EPIC: { icon: Layers, color: '#8b5cf6', label: 'Epic' },
  STORY: { icon: Bookmark, color: '#22c55e', label: 'Story' },
  TASK: { icon: CheckSquare, color: '#3b82f6', label: 'Task' },
  BUG: { icon: Bug, color: '#ef4444', label: 'Bug' },
  SUBTASK: { icon: GitBranch, color: '#0ea5e9', label: 'Subtask' },
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
  HIGHEST: { icon: ChevronsUp, color: '#dc2626', label: 'Highest' },
  HIGH: { icon: ArrowUp, color: '#ef4444', label: 'High' },
  MEDIUM: { icon: Equal, color: '#f59e0b', label: 'Medium' },
  LOW: { icon: ArrowDown, color: '#3b82f6', label: 'Low' },
  LOWEST: { icon: ChevronsDown, color: '#6366f1', label: 'Lowest' },
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
  TODO: { color: '#475569', bg: '#e2e8f0', label: 'To Do' },
  IN_PROGRESS: { color: '#1d4ed8', bg: '#dbeafe', label: 'In Progress' },
  DONE: { color: '#15803d', bg: '#dcfce7', label: 'Done' },
};

// ---------------------------------------------------------------------------
// Avatars: deterministic initials + background color
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#84cc16',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#d946ef',
  '#ec4899',
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
