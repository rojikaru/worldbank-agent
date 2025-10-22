import { type $Fetch, ofetch } from "ofetch";
import type { z } from "zod";
import type {
  Indicator,
  IndicatorsResponse,
  TopicsResponse,
  Topic,
  DataResponse,
  DataRecord,
} from "./schema";
import {
  topicsResponseSchema,
  indicatorsResponseSchema,
  dataResponseSchema,
} from "./schema";

type MaybeArray<T> = T | T[] | null;

/**
 * World Bank API client for interacting with the World Bank API.
 */
export class WorldBankApiClient {
  // Fetch client for making API requests
  private readonly fetch: $Fetch = ofetch.create({
    baseURL: "https://api.worldbank.org/v2",
    query: { format: "json" },
  });

  // Cache for topics and indicators
  private topics: Topic[] | null = null;
  private readonly indicators: Map<string, Indicator[]> = new Map();

  /**
   * Concatenates an array of strings into a single string with a specified separator.
   * @param arr - The array of strings to concatenate.
   * @param std - The default string to return if the array is empty or not an array.
   * @param sep - The separator to use between strings (default is ";").
   * @returns The concatenated string or the default string.
   */
  private static concatStrings(
    arr: MaybeArray<string> = null,
    std: string | null = null,
    sep: string = ";"
  ): string | null {
    if (arr === null || arr === undefined) {
      return null;
    }
    if (typeof arr === "string") {
      return arr;
    }
    if (!Array.isArray(arr) || arr.length === 0) {
      return std;
    }
    return arr.join(sep);
  }

  /**
   * Parses the API response using the provided Zod schema.
   * @param schema - The Zod schema to validate the response against.
   * @param text - The raw JSON response text.
   * @returns The parsed and validated data.
   * @throws An error if the response cannot be parsed or validated.
   */
  private static parseResponse<T extends z.ZodType>(
    schema: T,
    text: string
  ): z.infer<T> {
    const json = JSON.parse(text);
    const { data, error, success } = schema.safeParse(json);
    if (!success) {
      throw new Error("Failed to parse response", { cause: error });
    }
    return data;
  }

  /**
   * Fetches and caches the list of topics from the World Bank API.
   * @returns A promise that resolves to an array of Topic objects.
   */
  async getTopics(): Promise<Topic[]> {
    if (this.topics !== null) {
      return this.topics;
    }

    const [, topics] = await this.fetch<TopicsResponse>("/topic", {
      parseResponse: (text) => topicsResponseSchema.parse(JSON.parse(text)),
    });

    this.topics = topics;
    return this.topics;
  }

  /**
   * Fetches a specific topic by its ID from the World Bank API.
   * @param id - The ID of the topic to fetch.
   * @returns A promise that resolves to the Topic object or null if not found.
   */
  async getTopicById(id: string): Promise<Topic | null> {
    if (this.topics !== null) {
      return this.topics.find((topic) => topic.id === id) ?? null;
    }

    const [, data] = await this.fetch<TopicsResponse>(`/topic/${id}`, {
      parseResponse: WorldBankApiClient.parseResponse.bind(
        this,
        topicsResponseSchema
      ),
    });
    return data.at(0) ?? null;
  }

  /**
   * Fetches indicators associated with a specific topic ID from the World Bank API.
   * @param topicId - The ID of the topic to fetch indicators for. Can be a string, an array of strings, or null (defaults to "all").
   * @returns A promise that resolves to an array of Indicator objects.
   * @throws An error if the specified topic ID is not found in the cached topics.
   */
  async getIndicatorsByTopicId(
    topicId: MaybeArray<string> = null
  ): Promise<Indicator[]> {
    const topicParam = WorldBankApiClient.concatStrings(topicId, "all")!;

    // Return cached indicators if available
    if (this.indicators.has(topicParam)) {
      return this.indicators.get(topicParam)!;
    }

    // Try to concat available caches
    if (Array.isArray(topicId) && topicId.every(this.indicators.has)) {
      return topicId.flatMap((id) => this.indicators.get(id)!);
    }

    // Check if topic exists (if topics are already fetched)
    if (
      this.topics !== null &&
      topicParam !== "all" &&
      !this.topics.some((t) => t.id === topicParam)
    ) {
      throw new Error(`Topic with ID ${topicParam} not found.`);
    }

    const parseResponse = WorldBankApiClient.parseResponse.bind(
      this,
      indicatorsResponseSchema
    );

    // Fetch pagination info first
    const [pagination] = await this.fetch<IndicatorsResponse>(
      `/topic/${topicParam}/indicator`,
      {
        query: { per_page: 1 },
        parseResponse,
      }
    );

    // Then fetch all indicators
    const [, indicators] = await this.fetch<IndicatorsResponse>(
      `/topic/${topicParam}/indicator`,
      {
        query: { per_page: pagination.total },
        parseResponse,
      }
    );

    // Cache the fetched indicators
    this.indicators.set(topicParam, indicators);

    return indicators;
  }

  /**
   * Fetches data records for a specific indicator from the World Bank API.
   * @param parameters - An object containing the parameters for the data fetch:
   *   - indicatorId: The ID(s) of the indicator(s) to fetch data for (string or array of strings).
   *   - countryCode: (Optional) The country code(s) to filter the data by (string or array of strings). Defaults to "all".
   *   - date: (Optional) The date to filter the data by (string).
   * @returns A promise that resolves to an array of DataRecord objects.
   */
  async fetchDataForIndicator(parameters: {
    indicatorId: string | string[];
    countryCode?: MaybeArray<string>;
    date?: MaybeArray<string>;
  }): Promise<DataRecord[]> {
    const indicator = WorldBankApiClient.concatStrings(parameters.indicatorId);
    const country = WorldBankApiClient.concatStrings(
      parameters.countryCode,
      "all"
    );
    const date = WorldBankApiClient.concatStrings(parameters.date, "all", ":");

    const [, data] = await this.fetch<DataResponse>(
      `/country/${country}/indicator/${indicator}`,
      {
        query: { date },
        parseResponse: WorldBankApiClient.parseResponse.bind(
          this,
          dataResponseSchema
        ),
      }
    );
    return data;
  }
}
