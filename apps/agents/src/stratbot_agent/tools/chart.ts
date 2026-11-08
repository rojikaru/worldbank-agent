import { tool } from "@langchain/core/tools";
import { AIMessage } from "@langchain/core/messages";
import { getCurrentTaskInput } from "@langchain/langgraph";
import { typedUi } from "@langchain/langgraph-sdk/react-ui/server";
import { z } from "zod";
import type { Cell, Dataset, State } from "../state";

/** Props of the `chart` UI component in the web app (keep in sync with chart-widget.tsx) */
export interface ChartProps {
  title: string;
  description?: string;
  /** 1–2 sentence takeaway shown in the card, so the chart never arrives unexplained */
  insight: string;
  kind: "line" | "bar" | "scatter";
  xKey: string;
  series: { key: string; label: string }[];
  rows: Record<string, Cell>[];
  sources: { id: string; title: string; indicatorId?: string }[];
}

/**
 * World Bank datasets are long (country, year, value); charts want wide rows
 * ({ year, Ukraine: 1.2, Poland: 3.4 }). One series per country, or per
 * country + dataset when several indicators are combined.
 */
function pivotWorldBank(datasets: Dataset[]) {
  const byYear = new Map<number, Record<string, Cell>>();
  // label -> safe key ("s0", "s1"…): labels contain dots and spaces that break dataKey paths
  const keys = new Map<string, string>();
  for (const dataset of datasets) {
    for (const row of dataset.rows) {
      const label =
        String(row.country_name ?? row.country) +
        (datasets.length > 1 ? ` · ${dataset.title}` : "");
      if (!keys.has(label)) keys.set(label, `s${keys.size}`);
      const year = Number(row.year);
      const entry = byYear.get(year) ?? { year };
      entry[keys.get(label)!] = row.value;
      byYear.set(year, entry);
    }
  }
  return {
    xKey: "year",
    rows: [...byYear.values()].sort((a, b) => Number(a.year) - Number(b.year)),
    series: [...keys].map(([label, key]) => ({ key, label })),
  };
}

function fromAnalysis(dataset: Dataset, xKey?: string, yKeys?: string[]) {
  const x = xKey ?? dataset.columns[0]!;
  const ys =
    yKeys ??
    dataset.columns.filter(
      (column) =>
        column !== x &&
        dataset.rows.some((row) => typeof row[column] === "number"),
    );
  return {
    xKey: x,
    rows: dataset.rows,
    series: ys.map((key) => ({ key, label: key })),
  };
}

export const showChartTool = tool(
  async (
    { title, description, insight, kind, datasetIds, xKey, yKeys },
    config,
  ) => {
    const state = getCurrentTaskInput<State>();
    const datasets = datasetIds.map((id) => state.datasets[id]);
    if (datasets.some((dataset) => !dataset)) {
      return `Unknown dataset IDs. Available: ${Object.keys(state.datasets).join(", ") || "none"}.`;
    }
    const picked = datasets as Dataset[];
    const analysis = picked.find((dataset) => dataset.origin === "analysis");

    const shape = analysis
      ? fromAnalysis(analysis, xKey, yKeys)
      : pivotWorldBank(picked);
    if (shape.series.length === 0) {
      return "Nothing numeric to plot in these datasets.";
    }

    const props: ChartProps = {
      title,
      description,
      insight,
      kind,
      ...shape,
      sources: picked.map(({ id, title, indicatorId }) => ({
        id,
        title,
        indicatorId,
      })),
    };

    // Attach the widget to the AI message that requested it, so the web app
    // renders it right under that message
    const aiMessage = state.messages.findLast(AIMessage.isInstance);
    typedUi(config).push(
      {
        name: "chart",
        props: { ...props },
        metadata: { message_id: aiMessage?.id },
      },
      { message: aiMessage },
    );

    return `Chart "${title}" is shown to the user (${shape.series.length} series, ${shape.rows.length} points per series). They can export it as CSV, PNG or SVG.`;
  },
  {
    name: "show_chart",
    description:
      "Show an interactive chart to the user, built from stored datasets. " +
      "Use only when the user asks for a chart or when a comparison over time is the answer. " +
      "Still write the key numbers in your text reply.",
    schema: z.object({
      title: z.string(),
      description: z
        .string()
        .optional()
        .describe("One short subtitle line, e.g. units and years."),
      insight: z
        .string()
        .describe(
          "1-2 sentences under the chart: what it shows and the key takeaway, with numbers from the data.",
        ),
      kind: z.enum(["line", "bar", "scatter"]).default("line"),
      datasetIds: z
        .array(z.string())
        .min(1)
        .describe("World Bank datasets to combine, or one analysis dataset."),
      xKey: z
        .string()
        .optional()
        .describe("Analysis datasets only: column for the x axis."),
      yKeys: z
        .array(z.string())
        .optional()
        .describe("Analysis datasets only: columns to plot."),
    }),
  },
);
