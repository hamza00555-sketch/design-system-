"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Copyable } from "@/components/Copyable";
import { ApiError, callApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { API_BASE } from "@/lib/firebase";

/**
 * Connecting a repo without a terminal.
 *
 * The prompt carries the address and the key, so the agent can push over plain
 * HTTP with one request — no .mcp.json, no CLI, nothing to install. It is the
 * shortest path from "I have a repo" to "my design system is here".
 */
export function PromptConnect() {
  const t = useTranslations("connect");
  const { workspace } = useAuth();

  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    // Unreachable: AppShell does not render children without a workspace.
    if (!workspace) return;
    setPending(true);
    setError(null);
    try {
      const result = await callApi<{ apiKey: string }>("/api/projects/create", {
        teamId: workspace.teamId,
        systemId: workspace.systemId,
        name: name.trim() || "project",
      });
      setApiKey(result.apiKey);
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "upgrade_required"
          ? t("upgradeRequired")
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-medium text-muted">{t("promptWayTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("promptWayBody")}</p>
      </div>

      {apiKey ? (
        <div className="flex flex-col gap-3">
          <Copyable value={buildPrompt(API_BASE, apiKey)} label={t("readyPrompt")} />
          <p className="text-xs text-fail">{t("keyWarning")}</p>
        </div>
      ) : (
        <form onSubmit={create} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-faint">{t("projectNameLabel")}</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="my-app"
              className="ltr-content min-w-56 rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm outline-none focus:border-ink"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-line-strong px-3 py-1.5 text-sm transition hover:bg-raised disabled:opacity-50"
          >
            {pending ? t("creating") : t("createProject")}
          </button>
        </form>
      )}

      {error ? <p className="text-sm text-fail">{error}</p> : null}
    </section>
  );
}

/**
 * One block of text that does the whole job: read the code, build the system,
 * send it. Written for an agent to follow literally, which is why the request
 * is spelled out rather than described.
 */
function buildPrompt(base: string, apiKey: string): string {
  return `Read this repository's shipped styling and extract its real design system: the colours, type, spacing, radii, and the usage rules the code already follows.

Rules for the extraction:
- Name tokens for their role, not their appearance: primary, ink, muted, surface — never blue600.
- Collapse near-duplicate values into one token. Three near-miss blues are one token plus two mistakes.
- Keep the scales small and even. Seven spacing steps beat nineteen.
- Record the rules the code already follows, even unwritten ones.

Then send it with a single request:

POST ${base}/api/systems/push
Authorization: Bearer ${apiKey}
Content-Type: application/json

Body: {"system": <the design system>}

Shape:
{"schemaVersion":1,
 "meta":{"name":"<product>","source":"code"},
 "tokens":{
   "color":{"primary":{"value":"#2f6bff","usage":"..."}},
   "typography":{"families":{},"sizes":{},"weights":{},"lineHeights":{},"letterSpacing":{}},
   "spacing":{},"radius":{},"shadow":{},"border":{}},
 "components":[{"name":"Button","description":"...","variants":[],"tokensUsed":[],"dos":[],"donts":[]}],
 "rules":[{"id":"no-raw-color","statement":"...","severity":"must"}]}

Every token value is {"value": "..."} with an optional "usage". Report the
version number and token count that come back.

To check a file against the system afterwards:
POST ${base}/api/systems/verify with {"files":[{"path":"...","content":"..."}]}`;
}
