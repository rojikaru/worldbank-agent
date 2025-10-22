import { z } from "zod";
import { paginatedResponseSchema } from "./pagination";

export const topicSchema = z.object({
  id: z.string().describe("World Bank Topic ID"),
  value: z.string().describe("Human readable topic name"),
  sourceNote: z.string().describe("Category description"),
});

export type Topic = z.infer<typeof topicSchema>;

export const topicsResponseSchema = paginatedResponseSchema(topicSchema);

export type TopicsResponse = z.infer<typeof topicsResponseSchema>;
