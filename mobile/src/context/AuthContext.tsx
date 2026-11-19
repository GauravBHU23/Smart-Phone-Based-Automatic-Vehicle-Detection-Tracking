import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthResponse, UserRole } from "../types";

interface AuthState {
  token: string | null;
  userId: string | null;
  name: string | null;
  phone: string | null;
  role: UserRole | null;
  profilePhotoUrl: string | null;
  isLoading: boolean;
  signIn: (auth: AuthResponse) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const STORAGE_KEY = "auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) {
        const parsed: AuthResponse = JSON.parse(raw);
        setToken(parsed.token);
        setUserId(parsed.userId);
        setName(parsed.name);
        setPhone(parsed.phone);
        setRole(parsed.role);
        setProfilePhotoUrl(parsed.profilePhotoUrl);
      }
      setIsLoading(false);
    })();
  }, []);

  async function signIn(auth: AuthResponse) {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(auth));
    setToken(auth.token);
    setUserId(auth.userId);
    setName(auth.name);
    setPhone(auth.phone);
    setRole(auth.role);
    setProfilePhotoUrl(auth.profilePhotoUrl);
  }

  async function signOut() {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    setToken(null);
    setUserId(null);
    setName(null);
    setPhone(null);
    setRole(null);
    setProfilePhotoUrl(null);
  }

  return (
    <AuthContext.Provider
      value={{ token, userId, name, phone, role, profilePhotoUrl, isLoading, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
