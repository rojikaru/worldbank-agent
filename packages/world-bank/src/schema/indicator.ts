import { z } from "zod";
import { paginatedResponseSchema } from "./pagination";
import { topicSchema } from "./topic";

export const indicatorSchema = z
  .object({
    id: z.string().describe("World Bank Indicator ID"),
    name: z.string().describe("Human-readable name of the indicator"),
    unit: z
      .string()
      .default("")
      .describe("Unit of measurement for the indicator"),
    source: z
      .object({
        id: z.string().describe("Source ID"),
        value: z.string().describe("Source name"),
      })
      .nullable()
      .default(null)
      .describe("Source information for the indicator"),
    sourceNote: z.string().default("").describe("Description of the indicator"),
    sourceOrganization: z
      .string()
      .default("")
      .describe("Organization responsible for the indicator"),
    topics: z
      .array(topicSchema.pick({ id: true, value: true }))
      .default([])
      .describe("Associated topics"),
  })
  .describe("Metadata object describing a possible or selected indicator.");

export type Indicator = z.infer<typeof indicatorSchema>;

export const indicatorsResponseSchema =
  paginatedResponseSchema(indicatorSchema);

export type IndicatorsResponse = z.infer<typeof indicatorsResponseSchema>;
