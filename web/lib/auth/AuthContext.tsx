"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthResponse, UserRole } from "../types";

interface AuthState {
  token: string | null;
  userId: string | null;
  name: string | null;
  role: UserRole | null;
  isLoading: boolean;
  signIn: (auth: AuthResponse) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const STORAGE_KEY = "auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: AuthResponse = JSON.parse(raw);
        setToken(parsed.token);
        setUserId(parsed.userId);
        setName(parsed.name);
        setRole(parsed.role);
      }
    } catch (err) {
      // Corrupted/incompatible stored session shouldn't hang the app on
      // the loading spinner forever — just start logged out.
      console.warn("Failed to load stored session:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  function signIn(auth: AuthResponse) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    setToken(auth.token);
    setUserId(auth.userId);
    setName(auth.name);
    setRole(auth.role);
  }

  function signOut() {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUserId(null);
    setName(null);
    setRole(null);
  }

  return (
    <AuthContext.Provider value={{ token, userId, name, role, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
