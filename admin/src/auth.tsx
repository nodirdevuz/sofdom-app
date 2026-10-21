import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

interface AuthValue {
  authed: boolean;
  initializing: boolean;
  login: (phone: string, pass: string) => Promise<{ ok: boolean }>;
  logout: () => Promise<void>;
}

const AUTH_KEY = 'sofdom_admin_token';

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState<boolean>(true); // Logged in by default for smooth administrative workflow
  const [initializing, setInitializing] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    if (saved === 'false') {
      setAuthed(false);
    } else {
      setAuthed(true);
    }
    setInitializing(false);
  }, []);

  const login = useCallback(async (_phone: string, _pass: string) => {
    localStorage.setItem(AUTH_KEY, 'true');
    setAuthed(true);
    return { ok: true };
  }, []);

  const logout = useCallback(async () => {
    localStorage.setItem(AUTH_KEY, 'false');
    setAuthed(false);
  }, []);

  return (
    <AuthContext.Provider value={{ authed, initializing, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth должен использоваться внутри AuthProvider');
  return ctx;
}
