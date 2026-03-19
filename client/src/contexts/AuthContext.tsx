import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '../api/auth';
import { setAccessToken } from '../api/client';
import type {
  User,
  UserRole,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
} from '../types';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<AuthResponse>;
  register: (data: RegisterRequest) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, try to restore session from stored refresh token
  useEffect(() => {
    const init = async () => {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        setIsLoading(false);
        return;
      }
      try {
        const { data: refreshRes } = await authApi.refresh(refreshToken);
        setAccessToken(refreshRes.data.accessToken);
        localStorage.setItem('refreshToken', refreshRes.data.refreshToken);

        const { data: meRes } = await authApi.getMe();
        setUser(meRes.data);
      } catch {
        // Token invalid/expired, clear everything
        setAccessToken(null);
        localStorage.removeItem('refreshToken');
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const login = useCallback(async (data: LoginRequest): Promise<AuthResponse> => {
    const { data: res } = await authApi.login(data);
    const authData = res.data;
    setAccessToken(authData.accessToken);
    localStorage.setItem('refreshToken', authData.refreshToken);
    setUser(authData.user);
    return authData;
  }, []);

  const register = useCallback(async (data: RegisterRequest): Promise<AuthResponse> => {
    const { data: res } = await authApi.register(data);
    const authData = res.data;
    setAccessToken(authData.accessToken);
    localStorage.setItem('refreshToken', authData.refreshToken);
    setUser(authData.user);
    return authData;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    } finally {
      setAccessToken(null);
      localStorage.removeItem('refreshToken');
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data: res } = await authApi.getMe();
      setUser(res.data);
    } catch {
      // If we can't fetch user, leave current state
    }
  }, []);

  const hasRole = useCallback(
    (...roles: UserRole[]) => {
      if (!user) return false;
      return roles.includes(user.role);
    },
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
      refreshUser,
      hasRole,
    }),
    [user, isLoading, login, register, logout, refreshUser, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
