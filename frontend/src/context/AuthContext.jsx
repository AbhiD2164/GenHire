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
      return null;
    }
    try {
      const data = await authApi.getMe();
      setProfile(data);
      return data;
    } catch (error) {
      setProfile(null);
      const detail = error.response?.data?.detail;
      const statusCode = error.response?.status;
      const message = typeof detail === "string"
        ? detail
        : `Your account could not be loaded${statusCode ? ` (HTTP ${statusCode})` : ""}. Please try signing in again.`;
      throw new Error(message, { cause: error });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile().catch((error) => {
      console.error("Could not restore the signed-in account.", error);
    });
  }, [refreshProfile]);

  async function login(credentials) {
    try {
      await authApi.login(credentials);
      await refreshProfile();
    } catch (error) {
      authApi.logout();
      setProfile(null);
      throw error;
    }
  }

  async function loginWithFirebase(payload) {
    try {
      await authApi.firebaseSignIn(payload);
      await refreshProfile();
    } catch (error) {
      authApi.logout();
      setProfile(null);
      throw error;
    }
  }

  function logout() {
    authApi.logout();
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ profile, loading, login, loginWithFirebase, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
