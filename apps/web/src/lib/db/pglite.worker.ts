/**
 * PGlite runs in a worker that tabs share through leader election, so only
 * one tab ever writes the IndexedDB files (two writers would corrupt them).
 */
import { PGlite } from "@electric-sql/pglite";
import { worker } from "@electric-sql/pglite/worker";

void worker({
  async init() {
    // relaxedDurability: return query results first, flush to IndexedDB right after
    return new PGlite("idb://stratbot", { relaxedDurability: true });
  },
});
