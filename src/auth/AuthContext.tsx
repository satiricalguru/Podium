import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type User = { id: string; name: string; email: string; createdAt: string; guest?: boolean };
type AuthState = {
  user: User | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  continueAsGuest: () => User;
  signOut: () => Promise<void>;
};

const GUEST_KEY = 'podium.guest.v1';
const AuthContext = createContext<AuthState | null>(null);

async function post(path: string, body?: unknown) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || (response.status >= 500 ? 'Podium’s server is unreachable. Start it with npm run dev, or continue as a guest.' : 'Something went wrong. Please try again.'));
  return data;
}

function readGuest(): User | null {
  try { return localStorage.getItem(GUEST_KEY) ? { id: 'guest', name: 'Guest', email: '', createdAt: localStorage.getItem(GUEST_KEY)!, guest: true } : null; }
  catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/auth/me', { signal: controller.signal, credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : { user: null })
      .then(data => setUser(data.user ?? readGuest()))
      .catch(() => { if (!controller.signal.aborted) setUser(readGuest()); })
      .finally(() => { if (!controller.signal.aborted) setReady(true); });
    return () => controller.abort();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { user } = await post('/api/auth/login', { email, password });
    setUser(user); return user as User;
  }, []);
  const register = useCallback(async (name: string, email: string, password: string) => {
    const { user } = await post('/api/auth/register', { name, email, password });
    setUser(user); return user as User;
  }, []);
  const continueAsGuest = useCallback(() => {
    const createdAt = new Date().toISOString();
    try { localStorage.setItem(GUEST_KEY, createdAt); } catch { /* guest session lasts for this tab only */ }
    const guest: User = { id: 'guest', name: 'Guest', email: '', createdAt, guest: true };
    setUser(guest); return guest;
  }, []);
  const signOut = useCallback(async () => {
    try { localStorage.removeItem(GUEST_KEY); } catch { /* nothing stored */ }
    if (user && !user.guest) await post('/api/auth/logout').catch(() => undefined);
    setUser(null);
  }, [user]);

  const value = useMemo(() => ({ user, ready, signIn, register, continueAsGuest, signOut }), [user, ready, signIn, register, continueAsGuest, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
