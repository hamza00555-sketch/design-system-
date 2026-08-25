"use client";

import {
  GithubAuthProvider,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { callApi } from "./api";
import { auth, isConfigured } from "./firebase";

export interface Workspace {
  teamId: string;
  systemId: string;
  plan: "free" | "pro";
  teamName: string;
  role: "owner" | "admin" | "member";
}

interface AuthState {
  user: User | null;
  workspace: Workspace | null;
  /** True until we know whether there is a session — not the same as signed out. */
  loading: boolean;
  configured: boolean;
  error: string | null;
  signIn: (provider: "google" | "github") => Promise<void>;
  signOutNow: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    return onAuthStateChanged(auth(), async (next) => {
      setUser(next);
      if (!next) {
        setWorkspace(null);
        setLoading(false);
        return;
      }
      try {
        // Idempotent: finds the existing workspace, or creates one on first sign-in.
        setWorkspace(await callApi<Workspace>("/api/me/bootstrap"));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    });
  }, [configured]);

  const signIn = useCallback(async (which: "google" | "github") => {
    setError(null);
    const provider =
      which === "google" ? new GoogleAuthProvider() : new GithubAuthProvider();
    try {
      await signInWithPopup(auth(), provider);
    } catch (err) {
      // A closed popup is a decision, not a failure worth shouting about.
      const code = (err as { code?: string }).code ?? "";
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  }, []);

  const signOutNow = useCallback(async () => {
    await signOut(auth());
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, workspace, loading, configured, error, signIn, signOutNow }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
