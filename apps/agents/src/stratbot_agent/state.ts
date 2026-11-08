import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import {
  type RemoveUIMessage,
  type UIMessage,
  uiMessageReducer,
} from "@langchain/langgraph-sdk/react-ui/server";

import type { RunPythonResponse } from "./tools/python";

export type Cell = string | number | null;

/** Work order for the analyst sub-agent, set by the `analyze` tool */
export interface Analysis {
  toolCallId: string;
  task: string;
  datasetIds: string[];
  packages: string[];
  attempts: number;
  code?: string;
  error?: string;
  response?: RunPythonResponse;
}

/**
 * A table kept in graph state instead of the model's context.
 * The model only sees a short summary; the browser (Pyodide) and the
 * chart widget read the full rows.
 */
export interface Dataset {
  id: string;
  /** "world-bank" rows come from the API, "analysis" rows from the analyst */
  origin: "world-bank" | "analysis";
  title: string;
  /** World Bank indicator ID, when the dataset came from the API */
  indicatorId?: string;
  columns: string[];
  rows: Record<string, Cell>[];
}

export const StateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  // Generative UI messages (charts), rendered by the web app
  ui: Annotation<
    UIMessage[],
    UIMessage | RemoveUIMessage | (UIMessage | RemoveUIMessage)[]
  >({
    reducer: uiMessageReducer,
    default: () => [],
  }),
  // Pending analysis for the analyst sub-agent (null when idle)
  analysis: Annotation<Analysis | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
  // Datasets fetched or computed during the conversation, keyed by ID
  datasets: Annotation<Record<string, Dataset>>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({}),
  }),
});

export type State = typeof StateAnnotation.State;
