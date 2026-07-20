import { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as authApi from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const access = localStorage.getItem("genhire_access");
    if (!access) {
      setProfile(null);
      setLoading(false);
      return;
    }
    try {
      const data = await authApi.getMe();
      setProfile(data);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  async function login(credentials) {
    await authApi.login(credentials);
    await refreshProfile();
  }

  function logout() {
    authApi.logout();
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ profile, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
