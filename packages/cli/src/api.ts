import { API_BASE } from "./config.js";

export interface ConnectInput {
  code: string;
  projectName: string;
  repoName?: string;
}

export type ConnectResult =
  | { ok: true; projectId: string; apiKey: string }
  | { ok: false; status: number; error: string; code: string };

/** Redeem a connect code for this repo's project key. */
export async function connectProject(input: ConnectInput): Promise<ConnectResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/cli/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: `Could not reach ${API_BASE}: ${err instanceof Error ? err.message : String(err)}`,
      code: "network",
    };
  }

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 201 && typeof body.apiKey === "string") {
    return { ok: true, projectId: String(body.projectId), apiKey: body.apiKey };
  }
  return {
    ok: false,
    status: res.status,
    error: typeof body.error === "string" ? body.error : `Unexpected response (${res.status})`,
    code: typeof body.code === "string" ? body.code : "unknown",
  };
}
