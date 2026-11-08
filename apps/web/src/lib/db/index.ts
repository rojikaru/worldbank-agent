"use client";

/**
 * Local conversation store: Postgres (PGlite) on top of IndexedDB.
 *
 * The LangGraph dev server keeps threads in memory, so they vanish on restart.
 * Every finished run is copied here; threads the server lost can be restored
 * onto it (see restoreThread in providers/Thread.tsx).
 */

import type { PGliteWorker } from "@electric-sql/pglite/worker";
import type { Message } from "@langchain/langgraph-sdk";

export interface ThreadSnapshot {
  id: string;
  assistantId: string;
  title: string;
  /** Full graph state values (messages, ui, datasets), used to restore the thread */
  values: Record<string, unknown> & { messages: Message[] };
}

export interface LocalThread {
  id: string;
  title: string;
  updated_at: string;
}

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS threads (
  id           text PRIMARY KEY,
  assistant_id text NOT NULL,
  title        text NOT NULL,
  values       jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS messages (
  thread_id text NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  position  integer NOT NULL,
  id        text,
  type      text NOT NULL,
  content   text NOT NULL,
  PRIMARY KEY (thread_id, position)
);
CREATE INDEX IF NOT EXISTS threads_updated_idx ON threads (updated_at DESC);
`;

let dbPromise: Promise<PGliteWorker> | null = null;

function getDb(): Promise<PGliteWorker> {
  dbPromise ??= (async () => {
    const { PGliteWorker } = await import("@electric-sql/pglite/worker");
    const db = new PGliteWorker(
      new Worker(new URL("./pglite.worker.ts", import.meta.url), {
        type: "module",
      }),
    );
    await db.exec(MIGRATIONS);
    return db;
  })();
  return dbPromise;
}

/** Plain text of a message, for titles and search */
export function messageText(message: Message): string {
  const { content } = message;
  if (typeof content === "string") return content;
  return content
    .map((part) =>
      "text" in part && typeof part.text === "string" ? part.text : "",
    )
    .join(" ");
}

export async function saveThread(snapshot: ThreadSnapshot): Promise<void> {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO threads (id, assistant_id, title, values)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
         SET title = EXCLUDED.title, values = EXCLUDED.values, updated_at = now()`,
      [
        snapshot.id,
        snapshot.assistantId,
        snapshot.title,
        JSON.stringify(snapshot.values),
      ],
    );
    await tx.query("DELETE FROM messages WHERE thread_id = $1", [snapshot.id]);
    for (const [position, message] of snapshot.values.messages.entries()) {
      await tx.query(
        "INSERT INTO messages (thread_id, position, id, type, content) VALUES ($1, $2, $3, $4, $5)",
        [
          snapshot.id,
          position,
          message.id ?? null,
          message.type,
          messageText(message),
        ],
      );
    }
  });
}

export async function listThreads(
  assistantId: string,
  search?: string,
): Promise<LocalThread[]> {
  const db = await getDb();
  const { rows } = await db.query<LocalThread>(
    search
      ? `SELECT DISTINCT t.id, t.title, t.updated_at FROM threads t
           JOIN messages m ON m.thread_id = t.id
         WHERE t.assistant_id = $1 AND m.content ILIKE '%' || $2 || '%'
         ORDER BY t.updated_at DESC LIMIT 100`
      : `SELECT id, title, updated_at FROM threads
         WHERE assistant_id = $1 ORDER BY updated_at DESC LIMIT 100`,
    search ? [assistantId, search] : [assistantId],
  );
  return rows;
}

export async function getThreadValues(
  id: string,
): Promise<ThreadSnapshot["values"] | null> {
  const db = await getDb();
  const { rows } = await db.query<{ values: ThreadSnapshot["values"] }>(
    "SELECT values FROM threads WHERE id = $1",
    [id],
  );
  return rows[0]?.values ?? null;
}

export async function deleteThread(id: string): Promise<void> {
  const db = await getDb();
  await db.query("DELETE FROM threads WHERE id = $1", [id]);
}
