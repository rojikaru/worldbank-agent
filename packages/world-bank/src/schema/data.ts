import { z } from "zod";
import { paginatedResponseSchema } from "./pagination";

export const dataSchema = z
  .object({
    indicator: z.object({
      id: z.string().describe("World Bank Indicator ID"),
      value: z.string().describe("Human-readable meaning of the indicator"),
    }),
    country: z.object({
      id: z.string().describe("World Bank Country ID"),
      value: z
        .string()
        .describe("Human-readable name of the country/region/category"),
    }),
    countryiso3code: z
      .string()
      .describe("ISO 3166-1 alpha-3 codes, 'all', or region/income groups."),
    date: z.string().describe("Year/quarter at the moment"),
    value: z
      .number()
      .nullable()
      .describe(
        "Numeric value of the indicator for the given date and country",
      ),
    unit: z.string().describe("Unit of measurement"),
    obs_status: z.string().describe("Observation status"),
    decimal: z.number().describe("Number of decimal places"),
  })
  .describe("Data record for a specific indicator, country, and date.");

export type DataRecord = z.infer<typeof dataSchema>;

export const dataResponseSchema = paginatedResponseSchema(dataSchema);

export type DataResponse = z.infer<typeof dataResponseSchema>;
