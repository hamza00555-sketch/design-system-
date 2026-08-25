import type { DesignSystem, DimensionToken } from "./schema.js";

export interface SystemDiff {
  added: string[];
  removed: string[];
  changed: { path: string; from: string; to: string }[];
  /** True when nothing at all moved — a push that would be a no-op version. */
  identical: boolean;
  summary: string;
}

function flatten(system: DesignSystem): Map<string, string> {
  const out = new Map<string, string>();
  const put = (prefix: string, record: Record<string, DimensionToken>) => {
    for (const [name, token] of Object.entries(record)) {
      out.set(`${prefix}.${name}`, token.value);
    }
  };
  const t = system.tokens;
  put("color", t.color);
  put("spacing", t.spacing);
  put("radius", t.radius);
  put("shadow", t.shadow);
  put("border", t.border);
  put("typography.families", t.typography.families);
  put("typography.sizes", t.typography.sizes);
  put("typography.weights", t.typography.weights);
  put("typography.lineHeights", t.typography.lineHeights);
  put("typography.letterSpacing", t.typography.letterSpacing);
  for (const c of system.components) {
    out.set(`component.${c.name}`, JSON.stringify({ ...c, name: undefined }));
  }
  for (const r of system.rules) out.set(`rule.${r.id}`, `${r.severity}:${r.statement}`);
  return out;
}

/** What changed between two versions — shown in history and on every push. */
export function diffSystems(previous: DesignSystem | null, next: DesignSystem): SystemDiff {
  const before = previous ? flatten(previous) : new Map<string, string>();
  const after = flatten(next);

  const added: string[] = [];
  const removed: string[] = [];
  const changed: SystemDiff["changed"] = [];

  for (const [path, value] of after) {
    const prev = before.get(path);
    if (prev === undefined) added.push(path);
    else if (prev !== value) changed.push({ path, from: prev, to: value });
  }
  for (const path of before.keys()) {
    if (!after.has(path)) removed.push(path);
  }

  const identical = added.length === 0 && removed.length === 0 && changed.length === 0;
  const parts: string[] = [];
  if (added.length) parts.push(`+${added.length}`);
  if (removed.length) parts.push(`-${removed.length}`);
  if (changed.length) parts.push(`~${changed.length}`);

  return {
    added,
    removed,
    changed,
    identical,
    summary: identical ? "no changes" : parts.join(" · "),
  };
}
