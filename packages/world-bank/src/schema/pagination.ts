import { z } from "zod";

const numberOrStringSchema = z.union([z.number(), z.string()]);

/**
 * Pagination schema returned by the World Bank API.
 */
export const paginationMetaSchema = z
  .object({
    page: numberOrStringSchema.describe("Current page number."),
    pages: numberOrStringSchema.describe("Total number of pages available."),
    per_page: numberOrStringSchema.describe("Number of records per page."),
    total: numberOrStringSchema.describe(
      "Total number of records matching the query.",
    ),
    sourceid: z
      .string()
      .nullable()
      .default(null)
      .describe("Source identifier."),
    lastupdated: z
      .string()
      .nullable()
      .default(null)
      .describe("Timestamp of the last update."),
  })
  .describe("Pagination and metadata information.");

export type Pagination = z.infer<typeof paginationMetaSchema>;

export type PaginatedResponse<T> = [Pagination, T[]];

export const paginatedResponseSchema = <T extends z.ZodObject>(dataSchema: T) =>
  z
    .tuple([
      paginationMetaSchema,
      z.array(dataSchema).describe("Array of data records."),
    ])
    .describe("Paginated response containing metadata and data array.");
