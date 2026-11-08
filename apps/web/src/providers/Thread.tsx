import { validate } from "uuid";
import { getApiKey } from "@/lib/api-key";
import type { Thread } from "@langchain/langgraph-sdk";
import { useQueryState } from "nuqs";
import type {
  ReactNode,
  Dispatch,
  SetStateAction} from "react";
import {
  createContext,
  useContext,
  useCallback,
  useState
} from "react";
import { createClient } from "./client";
import { getThreadValues, listThreads, type LocalThread } from "@/lib/db";

interface ThreadContextType {
  getThreads: (search?: string) => Promise<Thread[]>;
  restoreThread: (threadId: string) => Promise<void>;
  threads: Thread[];
  setThreads: Dispatch<SetStateAction<Thread[]>>;
  threadsLoading: boolean;
  setThreadsLoading: Dispatch<SetStateAction<boolean>>;
}

const ThreadContext = createContext<ThreadContextType | undefined>(undefined);

function getThreadSearchMetadata(
  assistantId: string,
): { graph_id: string } | { assistant_id: string } {
  if (validate(assistantId)) {
    return { assistant_id: assistantId };
  } else {
    return { graph_id: assistantId };
  }
}

/** A thread only the browser still has, shaped like a server thread for the history list */
function toLocalThread(t: LocalThread): Thread {
  return {
    thread_id: t.id,
    created_at: t.updated_at,
    updated_at: t.updated_at,
    status: "idle",
    metadata: { local: true },
    values: { messages: [{ type: "human", content: t.title }] },
  } as unknown as Thread;
}

export function ThreadProvider({ children }: { children: ReactNode }) {
  // Same fallback as StreamProvider: without it, env-configured setups (no
  // ?apiUrl= in the URL) never listed any threads
  const [apiUrlParam] = useQueryState("apiUrl");
  const [assistantIdParam] = useQueryState("assistantId");
  const apiUrl = apiUrlParam ?? process.env.NEXT_PUBLIC_API_URL ?? null;
  const assistantId = assistantIdParam ?? process.env.NEXT_PUBLIC_ASSISTANT_ID ?? null;
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);

  const getThreads = useCallback(
    async (search?: string): Promise<Thread[]> => {
      if (!apiUrl || !assistantId) return [];
      const client = createClient(apiUrl, getApiKey() ?? undefined);

      const [serverThreads, localThreads] = await Promise.all([
        client.threads.search({
          metadata: { ...getThreadSearchMetadata(assistantId) },
          limit: 100,
        }),
        listThreads(assistantId, search).catch((error: unknown) => {
          console.error("Local thread store unavailable", error);
          return [];
        }),
      ]);

      // Threads only the local store knows (server restarted / in-memory dev server)
      const known = new Map(serverThreads.map((t) => [t.thread_id, t]));
      if (search) {
        // Search hits come from PGlite; prefer the live server thread when it still exists
        return localThreads.map((t) => known.get(t.id) ?? toLocalThread(t));
      }
      const localOnly = localThreads
        .filter((t) => !known.has(t.id))
        .map(toLocalThread);
      return [...serverThreads, ...localOnly];
    },
    [apiUrl, assistantId],
  );

  /** Re-creates a locally stored thread on the LangGraph server so it can be continued */
  const restoreThread = useCallback(
    async (threadId: string) => {
      if (!apiUrl || !assistantId) return;
      const values = await getThreadValues(threadId);
      if (!values) throw new Error(`Thread ${threadId} is not in the local store`);
      const client = createClient(apiUrl, getApiKey() ?? undefined);
      // The server needs the graph to accept state for a thread that never ran
      const graphId = validate(assistantId)
        ? (await client.assistants.get(assistantId)).graph_id
        : assistantId;
      await client.threads.create({
        threadId,
        graphId,
        ifExists: "do_nothing",
        metadata: { ...getThreadSearchMetadata(assistantId) },
      });
      await client.threads.updateState(threadId, { values, asNode: "callModel" });
    },
    [apiUrl, assistantId],
  );

  const value = {
    getThreads,
    restoreThread,
    threads,
    setThreads,
    threadsLoading,
    setThreadsLoading,
  };

  return (
    <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
  );
}

export function useThreads() {
  const context = useContext(ThreadContext);
  if (context === undefined) {
    throw new Error("useThreads must be used within a ThreadProvider");
  }
  return context;
}
