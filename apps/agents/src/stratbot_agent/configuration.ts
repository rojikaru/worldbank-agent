/**
 * Define the configurable parameters for the agent.
 */

import { Annotation } from "@langchain/langgraph";
import process from "node:process";
import type { RunnableConfig } from "@langchain/core/runnables";
import { SYSTEM_PROMPT } from "./prompts";

type Model<K extends string> = {
  name: K;
  requirements: {
    name: string;
    value?: string;
  }[];
};

// Define which models are available and their requirements
/* eslint-disable no-process-env */
const defaultModels = [
  {
    name: "claude-haiku-5-5",
    requirements: [
      {
        name: "ANTHROPIC_API_KEY",
        value: process.env.ANTHROPIC_API_KEY,
      },
    ],
  },
  {
    name: "gpt-6-luna",
    requirements: [
      {
        name: "OPENAI_API_KEY",
        value: process.env.OPENAI_API_KEY,
      },
    ],
  },
  {
    name: "ollama/qwen3.5:9b",
    requirements: [
      {
        name: "OLLAMA_BASE_URL",
        value: process.env.OLLAMA_BASE_URL,
      },
    ],
  },
] as const satisfies Model<string>[];
/* eslint-enable no-process-env */

// Find the first available model
const defaultModel = defaultModels.find((model) =>
  model.requirements.every((req) => req.value),
)?.name;

// Assert that we have at least one model available
if (defaultModel === undefined) {
  const missingKeys = defaultModels
    .flatMap((model) =>
      model.requirements.filter((req) => !req.value).map((req) => req.name),
    )
    // unique
    .filter((value, index, self) => self.indexOf(value) === index);

  throw new Error(
    "No language model API keys found in environment variables. " +
      "Please set any of the following environment variables: " +
      missingKeys.join(", "),
  );
}

export const ConfigurationSchema = Annotation.Root({
  /**
   * The system prompt to be used by the agent.
   */
  systemPrompt: Annotation<string>,

  /**
   * The name of the language model to be used by the agent.
   */
  model: Annotation<string>,
});

/**
 * Ensure the defaults are populated.
 */
export async function ensureConfiguration({
  configurable,
}: RunnableConfig): Promise<typeof ConfigurationSchema.State> {
  const { systemPrompt, model = defaultModel } = configurable ?? {};

  if (systemPrompt) {
    return { systemPrompt, model };
  }

  const newPrompt = await SYSTEM_PROMPT.invoke({
    system_time: new Date().toISOString(),
  }).then((prompt) => prompt.toString());

  return { systemPrompt: newPrompt, model };
}
