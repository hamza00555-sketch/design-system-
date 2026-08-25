import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND } from "./config.js";

export const START = `<!-- ${BRAND.rulesMarker}:start -->`;
export const END = `<!-- ${BRAND.rulesMarker}:end -->`;

/**
 * Assets ship next to the bundle in dist/, and sit in assets/ when running
 * from source — so tests read exactly what users get.
 */
function readAsset(name: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [join(here, name), join(here, "..", "assets", name)]) {
    if (existsSync(candidate)) return readFileSync(candidate, "utf8").trimEnd();
  }
  throw new Error(`Missing packaged asset: ${name}. Reinstall ${BRAND.cli}.`);
}

/** The rules block that teaches an agent to consult and verify, unprompted. */
export function rulesBlock(): string {
  return readAsset("agent-rules.md");
}

export function extractPrompt(): string {
  return readAsset("extract-prompt.md");
}

/**
 * Splice the block into an existing file.
 *
 * Idempotent by construction: an existing block between the markers is
 * replaced in place, anything else the file holds is left exactly as it was.
 * Running init twice must not produce two blocks or reformat someone's notes.
 */
export function installedContent(existing: string | null, block: string): string {
  if (existing === null || existing.trim() === "") return `${block}\n`;

  const startIdx = existing.indexOf(START);
  const endIdx = existing.indexOf(END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return existing.slice(0, startIdx) + block + existing.slice(endIdx + END.length);
  }

  const separator = existing.endsWith("\n\n") ? "" : existing.endsWith("\n") ? "\n" : "\n\n";
  return `${existing}${separator}${block}\n`;
}

/** Agent instruction files we keep in step: Claude Code's and the shared one. */
export function rulesTargets(cwd: string): string[] {
  return [join(cwd, "CLAUDE.md"), join(cwd, "AGENTS.md")];
}

export function readIfExists(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}
