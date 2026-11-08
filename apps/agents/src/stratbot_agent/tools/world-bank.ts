import { tool } from "@langchain/core/tools";
import { ToolMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { WorldBankApiClient } from "@repo/world-bank";
import { z } from "zod";
import type { Dataset } from "../state";
import { formatNumber, toCsv } from "./format";

const client = new WorldBankApiClient();

/** Above this many rows the model gets a per-country summary instead of the table */
const MAX_ROWS_IN_CONTEXT = 60;

export const searchIndicatorsTool = tool(
  async ({ query }) => {
    const results = await client.searchIndicators(query);
    if (results.length === 0) {
      return `No indicators match "${query}". Try shorter or different keywords.`;
    }
    return results
      .map((indicator) => `${indicator.id} | ${indicator.name}`)
      .join("\n");
  },
  {
    name: "search_indicators",
    description:
      "Find World Bank indicator IDs by keywords (World Development Indicators). " +
      "Returns up to 8 lines of 'ID | name'. Use it when you don't already know the exact indicator ID.",
    schema: z.object({
      query: z
        .string()
        .describe("A few keywords, e.g. 'forest area percent of land'."),
    }),
  },
);

/**
 * Per-country summary for datasets too large to show in full.
 */
function summarize(rows: Dataset["rows"]): string {
  // Map.groupBy needs Node 21+, and langgraph.json pins Node 20
  const byCountry = new Map<string, Dataset["rows"]>();
  for (const row of rows) {
    const key = String(row.country);
    byCountry.set(key, [...(byCountry.get(key) ?? []), row]);
  }
  const lines = ["country,first_year,first_value,last_year,last_value,min,max"];
  for (const [country, countryRows] of byCountry) {
    const valued = countryRows
      .filter((row) => typeof row.value === "number")
      .sort((a, b) => Number(a.year) - Number(b.year));
    if (valued.length === 0) {
      lines.push(`${country},,,,,,`);
      continue;
    }
    const values = valued.map((row) => row.value as number);
    const first = valued[0]!;
    const last = valued.at(-1)!;
    lines.push(
      [
        country,
        first.year,
        formatNumber(first.value),
        last.year,
        formatNumber(last.value),
        formatNumber(Math.min(...values)),
        formatNumber(Math.max(...values)),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export const getDatasetTool = tool(
  async ({ indicatorId, countries, startYear, endYear }, config) => {
    const records = await client.fetchDataForIndicator({
      indicatorId,
      countryCode: countries,
      date:
        startYear || endYear ? [startYear ?? "1960", endYear ?? "2100"] : [],
    });

    const rows = records
      // `country` holds the ISO2 code the model asked for: models filter with
      // df["country"] == "PL", and full names there made every filter empty
      .map((record) => ({
        country: record.country.id,
        country_name: record.country.value,
        iso3: record.countryiso3code,
        year: Number(record.date),
        value: record.value,
      }))
      .sort((a, b) => a.country.localeCompare(b.country) || a.year - b.year);

    const id = `${indicatorId}@${countries.join("+")}`;
    const title = records[0]?.indicator.value ?? indicatorId;
    const dataset: Dataset = {
      id,
      origin: "world-bank",
      title,
      indicatorId,
      columns: ["country", "country_name", "iso3", "year", "value"],
      rows,
    };

    const nonEmpty = rows.filter((row) => row.value !== null).length;
    const header =
      `Dataset "${id}": ${title}. ${rows.length} rows (${nonEmpty} with values), ` +
      `columns: country (ISO2 code, e.g. "PL"), country_name, iso3, year (int), value (float or null).`;
    const body =
      rows.length <= MAX_ROWS_IN_CONTEXT
        ? toCsv(["country", "year", "value"], rows)
        : `Too many rows to list; per-country summary:\n${summarize(rows)}\n` +
          "Use analyze for detailed analysis of this dataset.";

    return new Command({
      update: {
        datasets: { [id]: dataset },
        messages: [
          new ToolMessage({
            content:
              rows.length === 0
                ? `${header}\nNo data returned.`
                : `${header}\n${body}`,
            tool_call_id: config.toolCall?.id ?? "",
            name: "get_dataset",
          }),
        ],
      },
    });
  },
  {
    name: "get_dataset",
    description:
      "Fetch values of one World Bank indicator for given countries and years. " +
      "Stores the full table as a dataset (its ID is returned) for analyze and show_chart.",
    schema: z.object({
      indicatorId: z
        .string()
        .describe("Exact indicator ID, e.g. NY.GDP.MKTP.KD.ZG."),
      countries: z
        .array(z.string())
        .min(1)
        .max(20)
        .describe("ISO2 or ISO3 country codes, e.g. ['UA', 'PL']."),
      startYear: z.string().optional().describe("First year, e.g. '2000'."),
      endYear: z.string().optional().describe("Last year, e.g. '2023'."),
    }),
  },
);
