import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { login as loginApi, fetchMe } from "../services/auth";
import type { LoginRequest, TokenResponse, UserInfo } from "../services/auth";

interface AuthState {
  user: UserInfo | null;
  loading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
});

const TOKEN_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

function getStoredTokens(): { access: string | null; refresh: string | null } {
  return {
    access: localStorage.getItem(TOKEN_KEY),
    refresh: localStorage.getItem(REFRESH_KEY),
  };
}

function setStoredTokens(tokens: TokenResponse) {
  localStorage.setItem(TOKEN_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
}

function clearStoredTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (checked) return;
    const { access } = getStoredTokens();
    if (access) {
      fetchMe()
        .then(setUser)
        .catch(() => clearStoredTokens())
        .finally(() => {
          setLoading(false);
          setChecked(true);
        });
    } else {
      setLoading(false);
      setChecked(true);
    }
  }, [checked]);

  const login = useCallback(async (data: LoginRequest) => {
    const tokens = await loginApi(data);
    setStoredTokens(tokens);
    setUser({ id: 0, username: data.username, display_name: tokens.display_name });
  }, []);

  const logout = useCallback(() => {
    clearStoredTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
