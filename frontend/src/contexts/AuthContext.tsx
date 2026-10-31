import React, { createContext, useState, useEffect, useCallback } from 'react';
import { User, Role, LoginPayload, RegisterPayload } from '../types';
import { authApi } from '../api/auth.api';

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isCustomer: boolean;
  login: (credentials: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const cached = localStorage.getItem('subflow_user');
    return cached ? JSON.parse(cached) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return !localStorage.getItem('subflow_user') && !!localStorage.getItem('subflow_access_token');
  });

  const fetchCurrentUser = useCallback(async () => {
    const token = localStorage.getItem('subflow_access_token');
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const currentUser = await authApi.me();
      setUser(currentUser);
      localStorage.setItem('subflow_user', JSON.stringify(currentUser));
    } catch {
      localStorage.removeItem('subflow_access_token');
      localStorage.removeItem('subflow_refresh_token');
      localStorage.removeItem('subflow_user');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (isMounted) {
      fetchCurrentUser();
    }
    return () => {
      isMounted = false;
    };
  }, [fetchCurrentUser]);

  const login = async (credentials: LoginPayload): Promise<User> => {
    const res = await authApi.login(credentials);
    localStorage.setItem('subflow_access_token', res.accessToken);
    if (res.refreshToken) {
      localStorage.setItem('subflow_refresh_token', res.refreshToken);
    }
    localStorage.setItem('subflow_user', JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  };

  const register = async (payload: RegisterPayload): Promise<void> => {
    await authApi.register(payload);
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch {
      // Continue client cleanup even if network fails
    } finally {
      localStorage.removeItem('subflow_access_token');
      localStorage.removeItem('subflow_refresh_token');
      localStorage.removeItem('subflow_user');
      setUser(null);
    }
  };

  const refreshProfile = async (): Promise<void> => {
    await fetchCurrentUser();
  };

  const isAdmin = user?.role === Role.ADMIN;
  const isStaff = user?.role === Role.ADMIN || user?.role === Role.STAFF;
  const isCustomer = user?.role === Role.CUSTOMER;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        isAdmin,
        isStaff,
        isCustomer,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export { useAuth } from './useAuth';
