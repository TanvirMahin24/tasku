import { create } from 'zustand';
import type { ThemeMode } from '@tasku/types';

const THEME_KEY = 'tasku.theme';

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'system';
}

function writeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** Whether the OS currently prefers dark. */
function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/** Resolve a mode to a concrete light/dark choice. */
export function resolveDark(mode: ThemeMode): boolean {
  return mode === 'dark' || (mode === 'system' && systemPrefersDark());
}

/** Toggle the `dark` class on <html> to match the resolved mode. */
function applyDom(mode: ThemeMode): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolveDark(mode));
}

interface ThemeState {
  mode: ThemeMode;
  /** The currently rendered effective theme (light | dark). */
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  /** Cycle light -> dark -> system -> light. */
  cycle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: readMode(),
  isDark: resolveDark(readMode()),

  setMode: (mode) => {
    writeMode(mode);
    applyDom(mode);
    set({ mode, isDark: resolveDark(mode) });
  },

  cycle: () => {
    const order: ThemeMode[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(get().mode) + 1) % order.length];
    get().setMode(next);
  },
}));

/**
 * Apply the persisted theme immediately (call before first paint) and keep it in
 * sync with the OS when the user is on 'system'. Returns a cleanup function.
 */
export function initTheme(): () => void {
  const mode = useThemeStore.getState().mode;
  applyDom(mode);

  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    const current = useThemeStore.getState();
    if (current.mode === 'system') {
      applyDom('system');
      useThemeStore.setState({ isDark: systemPrefersDark() });
    }
  };
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}
