import { Button } from "@/components/ui/button";
import { useThreads } from "@/providers/Thread";
import type { Thread } from "@langchain/langgraph-sdk";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HardDrive } from "lucide-react";
import { Input } from "@/components/ui/input";

import { getContentString } from "../utils";
import { useQueryState, parseAsBoolean } from "nuqs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { PanelRightOpen, PanelRightClose } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";

function ThreadList({
  threads,
  onThreadClick,
}: {
  threads: Thread[];
  onThreadClick?: (threadId: string) => void;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");
  const { restoreThread } = useThreads();

  return (
    <div className="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {threads.map((t) => {
        let itemText = t.thread_id;
        if (
          typeof t.values === "object" &&
          t.values &&
          "messages" in t.values &&
          Array.isArray(t.values.messages) &&
          t.values.messages?.length > 0
        ) {
          const firstMessage = t.values.messages[0];
          itemText = getContentString(firstMessage.content);
        }
        const isLocalOnly = (t.metadata as { local?: boolean } | null)?.local === true;
        return (
          <div
            key={t.thread_id}
            className="w-full px-1"
          >
            <Button
              variant="ghost"
              className="w-[280px] items-start justify-start text-left font-normal"
              title={isLocalOnly ? "Saved in this browser; opening restores it to the server" : undefined}
              onClick={async (e) => {
                e.preventDefault();
                onThreadClick?.(t.thread_id);
                if (t.thread_id === threadId) return;
                if (isLocalOnly) {
                  try {
                    await restoreThread(t.thread_id);
                  } catch (error) {
                    console.error(error);
                    toast.error("Could not restore this conversation");
                    return;
                  }
                }
                void setThreadId(t.thread_id);
              }}
            >
              {isLocalOnly && <HardDrive className="text-muted-foreground size-3.5 shrink-0" />}
              <p className="truncate text-ellipsis">{itemText}</p>
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function ThreadHistoryLoading() {
  return (
    <div className="flex h-full w-full flex-col items-start justify-start gap-2 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {Array.from({ length: 30 }).map((_, i) => (
        <Skeleton
          key={`skeleton-${i}`}
          className="h-10 w-[280px]"
        />
      ))}
    </div>
  );
}

export default function ThreadHistory() {
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(false),
  );

  const { getThreads, threads, setThreads, threadsLoading, setThreadsLoading } =
    useThreads();
  const [search, setSearch] = useState("");

  // Empty search lists server + local threads; text searches every saved message (PGlite)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = setTimeout(() => {
      setThreadsLoading(true);
      getThreads(search.trim() || undefined)
        .then(setThreads)
        .catch(console.error)
        .finally(() => setThreadsLoading(false));
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const searchBox = (
    <div className="w-full px-4">
      <Input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search saved conversations…"
        aria-label="Search saved conversations"
        className="h-8"
      />
    </div>
  );

  return (
    <>
      <div className="shadow-inner-right hidden h-screen w-[300px] shrink-0 flex-col items-start justify-start gap-6 border-r-[1px] border-slate-300 lg:flex">
        <div className="flex w-full items-center justify-between px-4 pt-1.5">
          <Button
            className="hover:bg-gray-100"
            variant="ghost"
            onClick={() => setChatHistoryOpen((p) => !p)}
          >
            {chatHistoryOpen ? (
              <PanelRightOpen className="size-5" />
            ) : (
              <PanelRightClose className="size-5" />
            )}
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">
            Thread History
          </h1>
        </div>
        {searchBox}
        {threadsLoading ? (
          <ThreadHistoryLoading />
        ) : (
          <ThreadList threads={threads} />
        )}
      </div>
      <div className="lg:hidden">
        <Sheet
          open={!!chatHistoryOpen && !isLargeScreen}
          onOpenChange={(open) => {
            if (isLargeScreen) return;
            setChatHistoryOpen(open);
          }}
        >
          <SheetContent
            side="left"
            className="flex lg:hidden"
          >
            <SheetHeader>
              <SheetTitle>Thread History</SheetTitle>
            </SheetHeader>
            {searchBox}
            <ThreadList
              threads={threads}
              onThreadClick={() => setChatHistoryOpen((o) => !o)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
