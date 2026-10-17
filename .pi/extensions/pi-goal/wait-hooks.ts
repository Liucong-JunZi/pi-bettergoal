import { statSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

export type WaitSpec = {
 reason: string;
 kind: "manual" | "time" | "file" | "event";
 seconds?: number;
 path?: string;
 fileMode?: "exists" | "changed";
 event?: string;
};
export type GoalWait = WaitSpec & {
 id: string; createdAt: number; deadline: number; ready?: string;
 baseline?: string;
};
export function signature(path: string): string {
 try { const s = statSync(path); return `${s.dev}:${s.ino}:${s.size}:${s.mtimeMs}:${s.ctimeMs}`; }
 catch (e: any) { if (e.code === "ENOENT") return "missing"; throw e; }
}
export function makeWait(spec: WaitSpec, cwd: string, now = Date.now()): GoalWait {
 if (!spec.reason?.trim() || spec.reason.length > 2000) throw new Error("A bounded concrete wait reason is required");
 if (!["manual", "time", "file", "event"].includes(spec.kind)) throw new Error("Invalid wait kind");
 const seconds = spec.seconds ?? (spec.kind === "manual" ? 604800 : 86400);
 if (!Number.isFinite(seconds) || seconds < 1 || seconds > 604800) throw new Error("seconds must be 1..604800 (maximum 7 days)");
 const w: GoalWait = { reason: spec.reason.trim(), kind: spec.kind, seconds, id: randomUUID(), createdAt: now, deadline: now + seconds * 1000 };
 if (spec.kind === "file") {
  if (!spec.path?.trim()) throw new Error("file wait requires path");
  if (spec.fileMode && !["exists", "changed"].includes(spec.fileMode)) throw new Error("Invalid fileMode");
  w.path = resolve(cwd, spec.path); w.fileMode = spec.fileMode ?? "exists";
  w.baseline = signature(w.path);
 }
 if (spec.kind === "event") {
  if (!spec.event || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(spec.event)) throw new Error("event must be a bounded identifier");
  w.event = spec.event;
 }
 return w;
}
export function checkWait(w: GoalWait, now = Date.now()): { wake?: string; expired?: boolean } {
 if (w.ready) return { wake: w.ready };
 if (w.kind === "time" && now >= w.deadline) return { wake: "timer elapsed" };
 if (now >= w.deadline) return { expired: true };
 if (w.kind === "file") {
  const current = signature(w.path!);
  if (w.fileMode === "exists" ? current !== "missing" : current !== w.baseline) return { wake: `file ${w.fileMode}: ${w.path}` };
 }
 return {};
}
export function eventMatches(w: GoalWait, goalId: string, data: unknown): boolean {
 const d = data as any;
 return w.kind === "event" && d?.goalId === goalId && d?.waitId === w.id && d?.event === w.event;
}
