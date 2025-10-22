import { tool } from "langchain";
import { WorldBankApiClient } from "@repo/world-bank";
import z from "zod";

const client = new WorldBankApiClient();

export const getTopicsTool = tool(async () => await client.getTopics(), {
  name: "get_world_bank_api_topics",
  description: "Get a list of topics from the World Bank API.",
  schema: z.object({}),
});

export const getIndicatorsByTopicTool = tool(
  async ({ topicId }) => await client.getIndicatorsByTopicId(topicId),
  {
    name: "get_world_bank_api_indicators_by_topic",
    description:
      "Get a list of indicators for a given topic from the World Bank API.",
    schema: z.object({
      topicId: z
        .string()
        .describe("The ID of the topic to get indicators for."),
    }),
  },
);

export const datasetByIndicatorTool = tool(
  async (input) => await client.fetchDataForIndicator(input),
  {
    name: "get_world_bank_api_dataset_by_indicator",
    description: "Get dataset for a given indicator from the World Bank API.",
    schema: z.object({
      indicatorId: z
        .string()
        .describe("The ID of the indicator to get dataset for."),
      countryCode: z
        .union([z.string(), z.array(z.string())])
        .default(["all"])
        .describe(
          "The country ISO2 or ISO3 code or all to filter the dataset.",
        ),
      date: z
        .union([z.string(), z.array(z.string()).max(2)])
        .nullish()
        .default(null)
        .describe(
          "The date or date range (as [start, end]) to filter the dataset.",
        ),
    }),
  },
);
