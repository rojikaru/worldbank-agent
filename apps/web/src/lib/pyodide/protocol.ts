/** Messages between the chat UI and the Pyodide worker */

export type Cell = string | number | null;

export interface DatasetPayload {
  id: string;
  columns: string[];
  rows: Record<string, Cell>[];
}

/** Matches RunPythonResponse in apps/agents/src/stratbot_agent/tools/python.ts */
export type RunResult =
  | {
      status: "ok";
      stdout: string;
      table?: { columns: string[]; rows: Record<string, Cell>[] };
    }
  | { status: "error"; stdout: string; error: string }
  | { status: "rejected" };

export type RuntimeStatus =
  | "idle"
  | "loading-runtime"
  | "loading-packages"
  | "ready"
  | "running"
  | "failed";

export type WorkerRequest =
  | { type: "preload"; packages: string[] }
  | {
      type: "run";
      id: string;
      code: string;
      packages: string[];
      /** dataset ID -> rows, becomes `dfs[id]` in Python */
      datasets: Record<string, Record<string, Cell>[]>;
    };

export type WorkerResponse =
  | { type: "status"; status: RuntimeStatus; packages?: string[] }
  | { type: "result"; id: string; result: RunResult };
