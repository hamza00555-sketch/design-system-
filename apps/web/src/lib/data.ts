"use client";

import { parseDesignSystem, type DesignSystem } from "@miswadah/core";
import {
  collection,
  doc,
  getDoc,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { db } from "./firebase";

export interface VersionDoc {
  id: string;
  n: number;
  source: string;
  summary: string;
  tokenCount: number;
  createdAt: string;
  system: DesignSystem;
}

export interface SystemDoc {
  id: string;
  name: string;
  teamId: string;
  currentVersionId: string | null;
  versionCount: number;
}

export interface VerificationDoc {
  id: string;
  systemId: string;
  projectId: string;
  passed: boolean;
  violationCount: number;
  createdAt: Date | null;
}

export interface ScreenDoc {
  id: string;
  name: string;
  description: string | null;
  /** A real screenshot, or an image made to convey the mood. */
  kind: "capture" | "impression";
  mimeType: string;
}

export interface MemberDoc {
  id: string;
  uid: string;
  name: string | null;
  email: string | null;
  role: "owner" | "admin" | "member";
}

export interface ProjectDoc {
  id: string;
  /** Which design system this project pushes to. */
  systemId: string;
  name: string;
  repoName: string | null;
  keyPrefix: string;
  lastSeenAt: Date | null;
}

/** Firestore hands back Timestamps; the UI only ever wants a Date or null. */
function toDate(value: unknown): Date | null {
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

interface Live<T> {
  data: T;
  loading: boolean;
  error: string | null;
}

function useLive<T>(
  subscribe: ((onData: (value: T) => void, onError: (message: string) => void) => () => void) | null,
  initial: T,
  deps: unknown[],
): Live<T> {
  const [state, setState] = useState<Live<T>>({ data: initial, loading: true, error: null });

  useEffect(() => {
    if (!subscribe) {
      setState({ data: initial, loading: false, error: null });
      return;
    }
    return subscribe(
      (value) => setState({ data: value, loading: false, error: null }),
      (message) => setState((prev) => ({ ...prev, loading: false, error: message })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

export function useSystem(systemId: string | null) {
  return useLive<SystemDoc | null>(
    systemId
      ? (onData, onError) =>
          onSnapshot(
            doc(db(), "systems", systemId),
            (snap) =>
              onData(
                snap.exists()
                  ? {
                      id: snap.id,
                      name: (snap.get("name") as string) ?? "Design system",
                      teamId: snap.get("teamId") as string,
                      currentVersionId: (snap.get("currentVersionId") as string) ?? null,
                      versionCount: (snap.get("versionCount") as number) ?? 0,
                    }
                  : null,
              ),
            (err) => onError(err.message),
          )
      : null,
    null,
    [systemId],
  );
}

function toVersion(id: string, data: DocumentData): VersionDoc {
  return {
    id,
    n: (data.n as number) ?? 0,
    source: (data.source as string) ?? "code",
    summary: (data.summary as string) ?? "",
    tokenCount: (data.tokenCount as number) ?? 0,
    createdAt: (data.createdAt as string) ?? "",
    system: parseDesignSystem(data.system),
  };
}

/**
 * Every design system this team owns.
 *
 * Filtered on one field, so Firestore's automatic single-field index covers it
 * and there is nothing to create by hand. Sorted here rather than in the query
 * for the same reason.
 */
export function useTeamSystems(teamId: string | null) {
  return useLive<SystemDoc[]>(
    teamId
      ? (onData, onError) =>
          onSnapshot(
            query(collection(db(), "systems"), where("teamId", "==", teamId)),
            (snap) =>
              onData(
                snap.docs
                  .map((d) => ({
                    id: d.id,
                    name: (d.get("name") as string) ?? "Design system",
                    teamId: d.get("teamId") as string,
                    currentVersionId: (d.get("currentVersionId") as string) ?? null,
                    versionCount: (d.get("versionCount") as number) ?? 0,
                  }))
                  .sort((a, b) => a.name.localeCompare(b.name)),
              ),
            (err) => onError(err.message),
          )
      : null,
    [],
    [teamId],
  );
}

export function useVersions(systemId: string | null, max = 50) {
  return useLive<VersionDoc[]>(
    systemId
      ? (onData, onError) =>
          onSnapshot(
            query(
              collection(db(), "systems", systemId, "versions"),
              orderBy("n", "desc"),
              fsLimit(max),
            ),
            (snap) => onData(snap.docs.map((d) => toVersion(d.id, d.data()))),
            (err) => onError(err.message),
          )
      : null,
    [],
    [systemId, max],
  );
}

export function useVersion(systemId: string | null, versionId: string | null) {
  return useLive<VersionDoc | null>(
    systemId && versionId
      ? (onData, onError) =>
          onSnapshot(
            doc(db(), "systems", systemId, "versions", versionId),
            (snap) => onData(snap.exists() ? toVersion(snap.id, snap.data()) : null),
            (err) => onError(err.message),
          )
      : null,
    null,
    [systemId, versionId],
  );
}

/**
 * Recent verifications for one system.
 *
 * Queried by teamId rather than systemId, because Firestore proves a query
 * against its constraints and not its results: the rule asks whether the
 * caller is a member of `resource.data.teamId`, and a query that never
 * mentions teamId cannot be shown to satisfy it, so it is refused outright.
 * Narrowing to the system, ordering and limiting all happen here instead —
 * which also keeps this on the automatic single-field index, with no
 * composite index to deploy.
 */
export function useVerifications(teamId: string | null, systemId: string | null, max = 12) {
  return useLive<VerificationDoc[]>(
    teamId
      ? (onData, onError) =>
          onSnapshot(
            query(collection(db(), "verifications"), where("teamId", "==", teamId)),
            (snap) =>
              onData(
                snap.docs
                  .map((d) => ({
                    id: d.id,
                    systemId: (d.get("systemId") as string) ?? "",
                    projectId: d.get("projectId") as string,
                    passed: Boolean(d.get("passed")),
                    violationCount: (d.get("violationCount") as number) ?? 0,
                    createdAt: toDate(d.get("createdAt")),
                  }))
                  .filter((check) => !systemId || check.systemId === systemId)
                  .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
                  .slice(0, max),
              ),
            (err) => onError(err.message),
          )
      : null,
    [],
    [teamId, systemId, max],
  );
}

/**
 * Screen names and captions, without the pictures.
 *
 * The image bytes live in a `payload` subcollection, so this listener stays a
 * few kilobytes even when a whole app has been captured. `useScreenImage`
 * fetches a single picture when something is about to display it.
 */
export function useScreens(systemId: string | null) {
  return useLive<ScreenDoc[]>(
    systemId
      ? (onData, onError) =>
          onSnapshot(
            collection(db(), "systems", systemId, "screens"),
            (snap) =>
              onData(
                snap.docs.map((d) => ({
                  id: d.id,
                  name: (d.get("name") as string) ?? d.id,
                  description: (d.get("description") as string) ?? null,
                  kind: d.get("kind") === "impression" ? "impression" : "capture",
                  mimeType: (d.get("mimeType") as string) ?? "image/png",
                })),
              ),
            (err) => onError(err.message),
          )
      : null,
    [],
    [systemId],
  );
}

export interface ScreenImage {
  src: string | null;
  state: "idle" | "loading" | "loaded" | "missing" | "error";
  error: string | null;
  retry: () => void;
}

/**
 * One screenshot's bytes, fetched when something is about to show it.
 *
 * The outcome is reported rather than swallowed. Silently catching here is
 * what turned a refused read into a placeholder that animated forever, which
 * is worse than an error: it looks like progress.
 */
export function useScreenImage(
  systemId: string | null,
  screen: ScreenDoc | null,
  wanted: boolean,
): ScreenImage {
  const [src, setSrc] = useState<string | null>(null);
  const [state, setState] = useState<ScreenImage["state"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState("idle");
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!wanted || !systemId || !screen || src) return;
    let live = true;
    setState("loading");
    setError(null);
    getDoc(doc(db(), "systems", systemId, "screens", screen.id, "payload", "image"))
      .then((snap) => {
        if (!live) return;
        const data = snap.exists() ? (snap.get("data") as string | undefined) : undefined;
        if (!data) {
          setState("missing");
          return;
        }
        setSrc(`data:${screen.mimeType};base64,${data}`);
        setState("loaded");
      })
      .catch((err: unknown) => {
        if (!live) return;
        setError(err instanceof Error ? err.message : String(err));
        setState("error");
      });
    return () => {
      live = false;
    };
  }, [wanted, systemId, screen, src, attempt]);

  return { src, state, error, retry };
}

export function useMembers(teamId: string | null) {
  return useLive<MemberDoc[]>(
    teamId
      ? (onData, onError) =>
          onSnapshot(
            collection(db(), "teams", teamId, "members"),
            (snap) =>
              onData(
                snap.docs.map((d) => ({
                  id: d.id,
                  uid: (d.get("uid") as string) ?? d.id,
                  name: (d.get("name") as string) ?? null,
                  email: (d.get("email") as string) ?? null,
                  role: (d.get("role") as MemberDoc["role"]) ?? "member",
                })),
              ),
            (err) => onError(err.message),
          )
      : null,
    [],
    [teamId],
  );
}

export function useProjects(teamId: string | null) {
  return useLive<ProjectDoc[]>(
    teamId
      ? (onData, onError) =>
          onSnapshot(
            query(collection(db(), "projects"), where("teamId", "==", teamId)),
            (snap) =>
              onData(
                snap.docs.map((d) => ({
                  id: d.id,
                  systemId: (d.get("systemId") as string) ?? "",
                  name: (d.get("name") as string) ?? d.id,
                  repoName: (d.get("repoName") as string) ?? null,
                  keyPrefix: (d.get("keyPrefix") as string) ?? "",
                  lastSeenAt: toDate(d.get("lastSeenAt")),
                })),
              ),
            (err) => onError(err.message),
          )
      : null,
    [],
    [teamId],
  );
}
