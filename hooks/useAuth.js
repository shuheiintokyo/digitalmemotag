import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export function useAuth() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = () => {
    const token = api.getToken();
    if (token) {
      setIsAdmin(true);
      setUser({ username: 'admin' });
    }
    setLoading(false);
  };

  const login = async (username, password) => {
    try {
      const result = await api.login(password);
      if (result.success) {
        setIsAdmin(true);
        setUser({ username: username || 'admin' });
        return { success: true };
      }
      return { success: false, message: 'ログインに失敗しました' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const logout = () => {
    api.clearToken();
    setIsAdmin(false);
    setUser(null);
  };

  return { isAdmin, user, loading, login, logout };
}