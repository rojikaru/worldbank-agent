"use client";

/**
 * One shared Pyodide worker per tab. Nothing loads until the agent asks for
 * Python (prepare_python or analyze tool call, or a run_python interrupt).
 */

import { useSyncExternalStore } from "react";
import type {
  DatasetPayload,
  RunResult,
  RuntimeStatus,
  WorkerRequest,
  WorkerResponse,
} from "./protocol";

let worker: Worker | null = null;
let status: RuntimeStatus = "idle";
let detail = "";
const listeners = new Set<() => void>();
const pending = new Map<string, (result: RunResult) => void>();
const preloaded = new Set<string>();

function setStatus(next: RuntimeStatus, packages?: string[]) {
  status = next;
  detail = packages?.join(", ") ?? "";
  listeners.forEach((listener) => listener());
}

function getWorker(): Worker {
  if (worker) return worker;
  // Static file from /public, see the comment at the top of pyodide-worker.mjs
  worker = new Worker("/pyodide-worker.mjs", { type: "module" });
  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    if (message.type === "status") {
      setStatus(message.status, message.packages);
    } else {
      pending.get(message.id)?.(message.result);
      pending.delete(message.id);
    }
  };
  return worker;
}

const send = (request: WorkerRequest) => getWorker().postMessage(request);

/** Starts loading the runtime and packages in the background; safe to call repeatedly */
export function preloadPython(packages: string[]) {
  const key = [...packages].sort().join(",");
  if (preloaded.has(key)) return;
  preloaded.add(key);
  send({ type: "preload", packages });
}

export function runPython(
  code: string,
  packages: string[],
  datasets: DatasetPayload[],
): Promise<RunResult> {
  const id = crypto.randomUUID();
  return new Promise((resolve) => {
    pending.set(id, resolve);
    send({
      type: "run",
      id,
      code,
      packages,
      datasets: Object.fromEntries(datasets.map((d) => [d.id, d.rows])),
    });
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Live runtime status for widgets ("Loading pandas…") */
export function usePythonStatus() {
  const current = useSyncExternalStore(
    subscribe,
    () => status,
    () => "idle" as RuntimeStatus,
  );
  const packages = useSyncExternalStore(
    subscribe,
    () => detail,
    () => "",
  );
  return { status: current, packages };
}
