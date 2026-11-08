import { tool } from "@langchain/core/tools";
import { Command, getCurrentTaskInput } from "@langchain/langgraph";
import { z } from "zod";
import type { Cell, Dataset, State } from "../state";

/**
 * Packages that ship pre-built with Pyodide. Anything else would mean
 * micropip pulling unreviewed code into the user's browser, so it's rejected.
 */
export const ALLOWED_PACKAGES = [
  "numpy",
  "pandas",
  "scipy",
  "statsmodels",
  "scikit-learn",
] as const;

const PackagesSchema = z
  .array(z.enum(ALLOWED_PACKAGES))
  .default(["pandas"])
  .describe(
    `Python packages to load. Allowed: ${ALLOWED_PACKAGES.join(", ")}.`,
  );

/** Payload the web app receives; it renders an approval widget for it */
export interface RunPythonRequest {
  type: "run_python";
  code: string;
  packages: string[];
  datasets: Dataset[];
}

/** What the web app resumes the graph with */
export type RunPythonResponse =
  | {
      status: "ok";
      stdout: string;
      table?: { columns: string[]; rows: Record<string, Cell>[] };
    }
  | { status: "error"; stdout: string; error: string }
  | { status: "rejected" };

export const preparePythonTool = tool(
  async ({ packages }) =>
    `The user's browser is loading Python with ${packages.join(", ")}. ` +
    "Fetch the data you need, then call analyze.",
  {
    name: "prepare_python",
    description:
      "Start loading the in-browser Python runtime early. Call it in the same turn as " +
      "get_dataset when the question needs calculations (growth rates, correlations, " +
      "regressions, rankings) so loading overlaps with fetching.",
    schema: z.object({ packages: PackagesSchema }),
  },
);

export const analyzeTool = tool(
  async ({ task, datasetIds, packages }, config) => {
    const state = getCurrentTaskInput<State>();
    const missing = datasetIds.filter((id) => !(id in state.datasets));
    if (missing.length > 0) {
      return (
        `Unknown dataset IDs: ${missing.join(", ")}. ` +
        `Available: ${Object.keys(state.datasets).join(", ") || "none, call get_dataset first"}.`
      );
    }
    // No ToolMessage here: the analyst nodes answer this call when they finish
    return new Command({
      update: {
        analysis: {
          toolCallId: config.toolCall?.id ?? "",
          task,
          datasetIds,
          packages,
          attempts: 0,
        },
      },
    });
  },
  {
    name: "analyze",
    description:
      "Delegate a calculation to the analyst, which writes and runs pandas code in the user's " +
      "browser (after approval) and returns the printed results. Describe WHAT to compute in plain " +
      "language, e.g. 'average annual growth of value per country 2000-2023, and which country is highest'. " +
      "One analyze call per turn.",
    schema: z.object({
      task: z
        .string()
        .describe(
          "What to compute, in plain language, with years and countries.",
        ),
      datasetIds: z
        .array(z.string())
        .min(1)
        .describe("IDs of datasets returned by get_dataset."),
      packages: PackagesSchema,
    }),
  },
);
