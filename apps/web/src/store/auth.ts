import { create } from 'zustand';
import type { LoginDto, RegisterDto, UserDto } from '@tasku/types';
import { authApi, configureApiAuth } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';

const TOKEN_KEY = 'tasku.token';

interface AuthState {
  token: string | null;
  user: UserDto | null;
  /** True until we've attempted to hydrate the user from a persisted token. */
  initialized: boolean;
  login: (dto: LoginDto) => Promise<void>;
  register: (dto: RegisterDto) => Promise<void>;
  logout: () => void;
  setUser: (user: UserDto) => void;
  hydrate: () => Promise<void>;
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore storage failures (private mode, etc.) */
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: readToken(),
  user: null,
  initialized: false,

  login: async (dto) => {
    const res = await authApi.login(dto);
    writeToken(res.accessToken);
    set({ token: res.accessToken, user: res.user, initialized: true });
  },

  register: async (dto) => {
    const res = await authApi.register(dto);
    writeToken(res.accessToken);
    set({ token: res.accessToken, user: res.user, initialized: true });
  },

  logout: () => {
    writeToken(null);
    disconnectSocket();
    set({ token: null, user: null, initialized: true });
  },

  setUser: (user) => set({ user }),

  hydrate: async () => {
    const token = get().token;
    if (!token) {
      set({ initialized: true });
      return;
    }
    try {
      const user = await authApi.me();
      set({ user, initialized: true });
    } catch {
      // Invalid/expired token — clear it.
      writeToken(null);
      set({ token: null, user: null, initialized: true });
    }
  },
}));

// Wire the axios interceptors to the store (token injection + 401 -> logout).
configureApiAuth({
  getToken: () => useAuthStore.getState().token,
  onUnauthorized: () => {
    const { token, logout } = useAuthStore.getState();
    if (token) logout();
  },
});
