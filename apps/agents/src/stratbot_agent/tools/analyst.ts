/**
 * Analyst sub-agent: turns a plain-language analysis task into pandas code,
 * runs it in the user's browser (via interrupt), and retries on errors.
 *
 * It is a set of graph nodes rather than a tool on purpose: LangGraph re-runs
 * an interrupted node from the start on resume, so an LLM call before
 * interrupt() inside one tool could regenerate *different* code than the one
 * the user approved. Separate nodes are checkpointed one by one.
 */

import { AIMessage, ToolMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { interrupt } from "@langchain/langgraph";
import { ensureConfiguration } from "../configuration";
import type { Dataset, State } from "../state";
import { loadChatModel } from "../utils";
import { toCsv } from "./format";
import type { RunPythonRequest, RunPythonResponse } from "./python";

export const MAX_ATTEMPTS = 3;

/* eslint-disable no-process-env, no-undef -- optional separate (e.g. code-tuned) analyst model */
const ANALYST_MODEL = process.env.ANALYST_MODEL;
/* eslint-enable no-process-env, no-undef */
const MAX_STDOUT_CHARS = 3000;
const MAX_TABLE_ROWS_IN_CONTEXT = 40;

const ANALYST_PROMPT = `You write short pandas programs. Reply with Python code only, no explanations, no markdown fences.

ENVIRONMENT (already defined, do not load or redefine):
- dfs: dict of dataset ID -> pandas DataFrame
- df: the first DataFrame in dfs
- wide: when 2+ World Bank datasets are given, one merged DataFrame with columns
  country, year, and one column per indicator ID (e.g. wide["AG.LND.FRST.ZS"]); otherwise None
- pd and json are imported; numpy as np, scipy, statsmodels can be imported if listed in packages
- No network, no files, no plotting libraries.

WORLD BANK DATASET COLUMNS
country (ISO2 code like "PL"), country_name ("Poland"), iso3, year (int), value (float, NaN when missing)

RULES
- Filter by the ISO2 code in country, e.g. df[df["country"] == "PL"].
- Drop NaN values before computing; check selections are not empty before min()/max()/iloc[0].
- print() every number the answer needs, with a short label.
- If the result is a table or a time series worth charting, assign a DataFrame to result
  (first column = x axis, e.g. year; other columns = numeric series).
- Prefer simple, explicit code over clever one-liners.

MODEL HELPERS (already defined; prefer them over writing models yourself)
- linear_trend(x, y) -> fit with .slope .intercept .r2 .p_value .n (also unpacks in that order)
  Use for "is it rising/falling", "trend", "how fast per year". Significant when p_value < 0.05.
- regress(data, y, xs) -> fit with .coefficients (dict) .p_values (dict) .r2 .n
  OLS of column y on a list of columns xs. Use for "does X explain Y", "effect of X on Y",
  several predictors. Usually data=wide and columns are indicator IDs. Correlation is not causation.
- forecast_arima(one_country_df, steps=5, order=(1, 1, 1)) -> DataFrame year, actual, forecast, lower, upper
  Use for "forecast", "predict", "next N years" on ONE yearly series with at least 10 points.
  Assign its output to result so it can be charted, and print the forecast rows.
  Say the interval is a 95% range and that shocks (wars, crises) are not predictable.
Pick the simplest model that answers the question; use a helper whenever the task names one.

EXAMPLES
pl = df[df["country"] == "PL"]
t = linear_trend(pl["year"], pl["value"])
print(f"slope per year: {t.slope:.3f}, R2: {t.r2:.2f}, p-value: {t.p_value:.4f}")

result = forecast_arima(pl, steps=5)
print(result.tail(5).to_string(index=False))

fit = regress(wide[wide["year"] == 2022], "SP.DYN.LE00.IN", ["SE.XPD.TOTL.GD.ZS"])
print(f"R2: {fit.r2:.2f}, coefficients: {fit.coefficients}, p-values: {fit.p_values}")

If a helper says there is too little data, print its message and stop; do not switch models to work around it.

PANDAS REMINDERS
- Growth rate (CAGR): (last / first) ** (1 / (last_year - first_year)) - 1
- Wide table per country: df.pivot(index="year", columns="country", values="value")
- Correlation across countries for one year: wide[wide["year"] == 2022][[a, b]].corr().iloc[0, 1]
- Linear trend: scipy.stats.linregress(x, y) -> slope, intercept, rvalue, pvalue, stderr`;

/** Describes datasets to the analyst without dumping all rows */
export function describeDatasets(datasets: Dataset[]): string {
  return datasets
    .map((dataset) => {
      const years = dataset.rows
        .map((row) => Number(row.year))
        .filter(Number.isFinite);
      const countries = [...new Set(dataset.rows.map((row) => row.country))];
      const sample = dataset.rows.slice(0, 3);
      return [
        `dfs["${dataset.id}"]: ${dataset.title}`,
        `  ${dataset.rows.length} rows, columns: ${dataset.columns.join(", ")}`,
        years.length
          ? `  years ${Math.min(...years)}-${Math.max(...years)}`
          : "",
        countries[0] !== undefined
          ? `  countries: ${countries.slice(0, 25).join(", ")}`
          : "",
        `  first rows:\n${toCsv(dataset.columns, sample).replace(/^/gm, "    ")}`,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function stripFences(text: string): string {
  const fenced = text.match(/```(?:python)?\s*\n([\s\S]*?)```/);
  return (fenced ? fenced[1]! : text).trim();
}

/** Node: the analyst model writes (or fixes) the code */
export async function analystWrite(
  state: State,
  config: RunnableConfig,
): Promise<Partial<State>> {
  const analysis = state.analysis!;
  const configuration = await ensureConfiguration(config);
  const model = await loadChatModel(ANALYST_MODEL || configuration.model);
  const datasets = analysis.datasetIds.map((id) => state.datasets[id]!);

  const task = [
    `TASK: ${analysis.task}`,
    `PACKAGES: ${analysis.packages.join(", ")}`,
    `DATASETS:\n${describeDatasets(datasets)}`,
    analysis.code && analysis.error
      ? `YOUR PREVIOUS CODE:\n${analysis.code}\n\nIT FAILED WITH:\n${analysis.error}\n\nFix it.`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await model.invoke([
    { role: "system", content: ANALYST_PROMPT },
    { role: "user", content: task },
  ]);

  return {
    analysis: {
      ...analysis,
      code: stripFences(response.text),
      attempts: analysis.attempts + 1,
      error: undefined,
    },
  };
}

/** Node: pauses for the user's approval; the browser runs the code and resumes with the output */
export function analystRun(state: State): Partial<State> {
  const analysis = state.analysis!;
  const response = interrupt<RunPythonRequest, RunPythonResponse>({
    type: "run_python",
    code: analysis.code!,
    packages: analysis.packages,
    datasets: analysis.datasetIds.map((id) => state.datasets[id]!),
  });
  return {
    analysis: {
      ...analysis,
      response,
      error: response.status === "error" ? response.error : undefined,
    },
  };
}

/** Edge: retry on Python errors, otherwise report back to the main agent */
export function routeAnalysis(state: State): "analystWrite" | "analystFinish" {
  const analysis = state.analysis!;
  return analysis.response?.status === "error" &&
    analysis.attempts < MAX_ATTEMPTS
    ? "analystWrite"
    : "analystFinish";
}

/** Node: turns the outcome into the ToolMessage answering the main agent's `analyze` call */
export function analystFinish(state: State): Partial<State> {
  const analysis = state.analysis!;
  const response = analysis.response;
  const update: Partial<State> = { analysis: null };
  let content: string;

  if (!response || response.status === "rejected") {
    content =
      "The user declined to run the analysis code. Answer from the dataset summaries you " +
      "already have, and say that no calculations were run.";
  } else if (response.status === "error") {
    content =
      `The analysis failed after ${analysis.attempts} attempts. Last error:\n${response.error}\n` +
      "Tell the user what could not be computed; do not invent numbers.";
  } else {
    const stdout =
      response.stdout.length > MAX_STDOUT_CHARS
        ? `${response.stdout.slice(0, MAX_STDOUT_CHARS)}\n…(output truncated)`
        : response.stdout;
    const parts = [`Analysis output:\n${stdout || "(nothing printed)"}`];
    if (response.table && response.table.rows.length > 0) {
      const { columns, rows } = response.table;
      const id = `analysis-${analysis.toolCallId.slice(-6)}`;
      update.datasets = {
        [id]: {
          id,
          origin: "analysis",
          title: analysis.task.slice(0, 80),
          columns,
          rows,
        },
      };
      const preview = rows.slice(0, MAX_TABLE_ROWS_IN_CONTEXT);
      parts.push(
        `Result table saved as dataset "${id}" (${rows.length} rows), usable in show_chart:\n` +
          toCsv(columns, preview) +
          (rows.length > preview.length ? "\n…" : ""),
      );
    }
    content = parts.join("\n\n");
  }

  update.messages = [
    new ToolMessage({
      content,
      tool_call_id: analysis.toolCallId,
      name: "analyze",
    }),
  ];

  // Several analyze calls in one turn: only the last one ran (they share one slot).
  // Answer the others too, or the next model call fails on unanswered tool calls.
  const answered = new Set(
    state.messages.flatMap((m) =>
      ToolMessage.isInstance(m) ? [m.tool_call_id] : [],
    ),
  );
  const lastAi = state.messages.findLast(AIMessage.isInstance);
  for (const call of lastAi?.tool_calls ?? []) {
    if (
      call.name === "analyze" &&
      call.id &&
      call.id !== analysis.toolCallId &&
      !answered.has(call.id)
    ) {
      update.messages.push(
        new ToolMessage({
          content:
            "Skipped: only one analysis runs per turn. Call analyze again for this task if still needed.",
          tool_call_id: call.id,
          name: "analyze",
        }),
      );
    }
  }
  return update;
}
