import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authenticateUser } from '../services/authService';

const AUTH_STORAGE_KEY = 'shadowgraph.auth';

const AuthContext = createContext(null);

function readStoredSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeStoredSession(session) {
  if (!session) {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function getStoredToken() {
  const session = readStoredSession();
  return session?.token || '';
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = readStoredSession();
    if (stored?.token) {
      setSession(stored);
    }
  }, []);

  useEffect(() => {
    const onUnauthorized = (event) => {
      const from = event?.detail?.from || '/app/overview';
      setSession(null);
      writeStoredSession(null);

      if (!window.location.pathname.startsWith('/auth')) {
        navigate('/auth', { replace: true, state: { from } });
      }
    };

    window.addEventListener('shadowgraph:unauthorized', onUnauthorized);
    return () => window.removeEventListener('shadowgraph:unauthorized', onUnauthorized);
  }, [navigate]);

  const signIn = async ({ email, password, mode = 'login', directSession = null }) => {
    const result = directSession || (await authenticateUser({ email, password, mode }));
    const nextSession = {
      token: result.token,
      user: result.user
    };
    setSession(nextSession);
    writeStoredSession(nextSession);
    return nextSession;
  };

  const signOut = () => {
    setSession(null);
    writeStoredSession(null);
  };

  const value = useMemo(
    () => ({
      user: session?.user || null,
      token: session?.token || '',
      isAuthenticated: Boolean(session?.token),
      signIn,
      signOut
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
