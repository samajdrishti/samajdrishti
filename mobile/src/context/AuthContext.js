import React, { createContext, useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const AuthContext = createContext();

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [restoring, setRestoring] = useState(true);

  // Restore the persisted session so field officials stay signed in between
  // visits and can keep working offline.
  useEffect(() => {
    const restore = async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
      } finally {
        setRestoring(false);
      }
    };

    restore();
  }, []);

  const login = useCallback(async (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    try {
      await AsyncStorage.multiSet([
        [TOKEN_KEY, authToken],
        [USER_KEY, JSON.stringify(userData)],
      ]);
    } catch (err) {
      console.error('Failed to persist session:', err);
    }
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    try {
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    } catch (err) {
      console.error('Failed to clear session:', err);
    }
  }, []);

  const value = {
    user,
    token,
    restoring,
    isAuthenticated: Boolean(token),
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;

