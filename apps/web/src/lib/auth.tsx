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
import { ApiError, callApi } from "./api";
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
  /** Signed in with an account this deployment does not admit. */
  notAllowed: boolean;
  /**
   * The system currently being viewed. A team holds several — one per product
   * — so this is a choice, remembered per person in this browser, and it falls
   * back to the team's default.
   */
  systemId: string | null;
  setSystemId: (systemId: string) => void;
  /** Try the workspace lookup again after a failure. */
  retry: () => Promise<void>;
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
  const [notAllowed, setNotAllowed] = useState(false);
  const [chosenSystemId, setChosenSystemId] = useState<string | null>(null);

  const storageKey = user ? `miswadah.system.${user.uid}` : null;

  useEffect(() => {
    if (!storageKey) {
      setChosenSystemId(null);
      return;
    }
    try {
      setChosenSystemId(window.localStorage.getItem(storageKey));
    } catch {
      // Private windows and blocked site data are not an error worth showing:
      // the default system still works, it just is not remembered.
      setChosenSystemId(null);
    }
  }, [storageKey]);

  const setSystemId = useCallback(
    (systemId: string) => {
      setChosenSystemId(systemId);
      if (!storageKey) return;
      try {
        window.localStorage.setItem(storageKey, systemId);
      } catch {
        // Remembering is a convenience; failing to is not worth interrupting.
      }
    },
    [storageKey],
  );

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Idempotent: finds the existing workspace, or creates one on first sign-in.
      setWorkspace(await callApi<Workspace>("/api/me/bootstrap"));
      setNotAllowed(false);
    } catch (err) {
      // A private deployment refusing an account is not an error to shout
      // about — it is a sentence the person needs to read.
      if (err instanceof ApiError && err.code === "not_allowed") {
        setNotAllowed(true);
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
      setWorkspace(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!configured) return;
    return onAuthStateChanged(auth(), (next) => {
      setUser(next);
      if (!next) {
        setWorkspace(null);
        setNotAllowed(false);
        setError(null);
        setLoading(false);
        return;
      }
      void loadWorkspace();
    });
  }, [configured, loadWorkspace]);

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
      value={{
        user,
        workspace,
        loading,
        configured,
        error,
        notAllowed,
        systemId: chosenSystemId ?? workspace?.systemId ?? null,
        setSystemId,
        retry: loadWorkspace,
        signIn,
        signOutNow,
      }}
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
