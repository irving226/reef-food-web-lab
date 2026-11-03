import type { AnalysisResult, Preset } from "./types";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") msg = body.detail;
      else if (Array.isArray(body.detail)) msg = body.detail.map((d: { msg: string }) => d.msg).join("; ");
    } catch {
      /* keep default message */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const getPresets = () => fetch("/api/presets").then((r) => handle<Record<string, Preset>>(r));

export interface AnalyzeInput {
  names: string[];
  matrix: number[][];
  removed: number[];
  alpha: number;
  k: number;
}

export const analyze = (input: AnalyzeInput, signal?: AbortSignal) =>
  fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  }).then((r) => handle<AnalysisResult>(r));

export const uploadMatrix = (file: File) => {
  const fd = new FormData();
  fd.append("file", file);
  return fetch("/api/upload", { method: "POST", body: fd }).then((r) =>
    handle<{ names: string[]; matrix: number[][]; sheet: string | null }>(r),
  );
};
