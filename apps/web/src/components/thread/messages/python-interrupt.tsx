"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryState } from "nuqs";
import { LoaderCircle, Play, ShieldCheck, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useStreamContext } from "@/providers/Stream";
import { SyntaxHighlighter } from "../syntax-highlighter";
import { preloadPython, runPython, usePythonStatus } from "@/lib/pyodide/runtime";
import type { DatasetPayload, RunResult } from "@/lib/pyodide/protocol";

/** Matches RunPythonRequest in apps/agents/src/stratbot_agent/tools/python.ts */
export interface RunPythonRequest {
  type: "run_python";
  code: string;
  packages: string[];
  datasets: (DatasetPayload & { title: string })[];
}

export function isRunPythonRequest(value: unknown): value is RunPythonRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "run_python" &&
    typeof (value as { code?: unknown }).code === "string"
  );
}

const STATUS_TEXT = {
  idle: "Python not loaded yet",
  "loading-runtime": "Loading Python…",
  "loading-packages": "Loading packages…",
  ready: "Python ready",
  running: "Running…",
  failed: "Python failed to load",
} as const;

// Trust is a per-viewer convenience, so browser storage is fine; it must never throw
const trustKey = (threadId: string | null) => `stratbot:trust-python:${threadId ?? "new"}`;
function readTrust(threadId: string | null) {
  try {
    return localStorage.getItem(trustKey(threadId)) === "1";
  } catch {
    return false;
  }
}
function writeTrust(threadId: string | null, value: boolean) {
  try {
    if (value) localStorage.setItem(trustKey(threadId), "1");
    else localStorage.removeItem(trustKey(threadId));
  } catch {
    // storage unavailable (private mode); trust lasts until reload
  }
}

/**
 * Approval widget for code the agent wants to run in this tab.
 * Run → execute in Pyodide and resume the graph with the output.
 * Stop → resume with "rejected"; the agent answers without calculations.
 */
export function PythonInterruptView({ request }: { request: RunPythonRequest }) {
  const thread = useStreamContext();
  const [threadId] = useQueryState("threadId");
  const [trusted, setTrusted] = useState(() => readTrust(threadId));
  const [busy, setBusy] = useState(false);
  const { status, packages } = usePythonStatus();
  const autoRan = useRef(false);

  useEffect(() => {
    preloadPython(request.packages);
  }, [request.packages]);

  const resume = (result: RunResult) =>
    thread.submit({}, { command: { resume: result } });

  const run = async () => {
    setBusy(true);
    try {
      resume(await runPython(request.code, request.packages, request.datasets));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (trusted && !autoRan.current) {
      autoRan.current = true;
      void run();
    }
    // run only once per mounted request
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trusted]);

  const onTrustChange = (value: boolean) => {
    setTrusted(value);
    writeTrust(threadId, value);
  };

  const loading = status === "loading-runtime" || status === "loading-packages" || status === "running";

  return (
    <div className="w-full max-w-3xl overflow-hidden rounded-xl border">
      <div className="bg-muted/50 flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
        <div>
          <p className="text-sm font-medium">The agent wants to run Python in your browser</p>
          <p className="text-muted-foreground text-xs">
            {request.packages.join(", ")} ·{" "}
            {request.datasets.map((d) => `${d.id} (${d.rows.length} rows)`).join(", ")}
          </p>
        </div>
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          {loading && <LoaderCircle className="size-3.5 animate-spin" />}
          {STATUS_TEXT[status]}
          {status === "loading-packages" && packages && ` (${packages})`}
        </span>
      </div>

      <div className="max-h-80 overflow-auto bg-zinc-950 text-sm">
        <SyntaxHighlighter language="python">{request.code}</SyntaxHighlighter>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2">
        <div className="flex items-center gap-2">
          <Switch id="trust-python" checked={trusted} onCheckedChange={onTrustChange} />
          <Label htmlFor="trust-python" className="text-muted-foreground flex items-center gap-1 text-xs">
            <ShieldCheck className="size-3.5" /> Run without asking in this conversation
          </Label>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => resume({ status: "rejected" })}
          >
            <Square className="size-3.5" /> Stop
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void run()}>
            {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            Run
          </Button>
        </div>
      </div>
    </div>
  );
}
