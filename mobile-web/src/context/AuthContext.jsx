import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authAPI, clearSession, getStoredUser, getToken, isAuthenticated, saveSession } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setToken] = useState(() => getToken());
  const [restoring, setRestoring] = useState(true);

  // Revalidate the stored token so a revoked/expired session is caught on launch.
  useEffect(() => {
    const restore = async () => {
      if (isAuthenticated()) {
        try {
          const { data } = await authAPI.profile();
          if (data.user) {
            setUser(data.user);
            saveSession({ user: data.user });
          }
        } catch (err) {
          clearSession();
          setUser(null);
          setToken(null);
        }
      }
      setRestoring(false);
    };
    restore();
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await authAPI.login(email, password);
    saveSession({ token: data.token, user: data.user });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await authAPI.register(payload);
    saveSession({ token: data.token, user: data.user });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      restoring,
      isAuthenticated: Boolean(token),
      isBackOffice: user ? ['admin', 'supervisor'].includes(user.role) : false,
      login,
      register,
      logout,
    }),
    [user, token, restoring, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};

export default AuthContext;
