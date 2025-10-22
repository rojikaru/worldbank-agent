/**
 * Define the configurable parameters for the agent.
 */

import { Annotation } from "@langchain/langgraph";
import process from "node:process";
import type { RunnableConfig } from "@langchain/core/runnables";
import { SYSTEM_PROMPT } from "./prompts";

type ModelRequirements = {
  requirements: {
    name: string;
    value: string | undefined;
  }[];
};

// Define which models are available and their requirements
/* eslint-disable no-process-env */
const defaultModels = {
  "claude-haiku-4-5-20251001": {
    requirements: [
      {
        name: "ANTHROPIC_API_KEY",
        value: process.env.ANTHROPIC_API_KEY,
      },
    ],
  },
  "gpt-4.1-mini": {
    requirements: [
      {
        name: "OPENAI_API_KEY",
        value: process.env.OPENAI_API_KEY,
      },
    ],
  },
} as const satisfies Record<string, ModelRequirements>;
/* eslint-enable no-process-env */

type RegisteredModels = keyof typeof defaultModels;

// Find the first available model
const defaultModel = Object.entries(defaultModels)
  .find(([, { requirements }]) =>
    requirements.every((req) => req.value !== undefined),
  )
  ?.at(0) as RegisteredModels;

// Assert that we have at least one model available
if (defaultModel === undefined) {
  throw new Error(
    "No language model API keys found in environment variables. " +
      "Please set any of the following environment variables: " +
      Object.values(defaultModels)
        .flatMap(({ requirements }) => requirements.map((req) => req.name))
        .join(", "),
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
  const systemPrompt =
    configurable?.systemPrompt ??
    (await SYSTEM_PROMPT.invoke({ system_time: new Date().toISOString() }));
  return {
    systemPrompt,
    model: configurable?.model ?? defaultModel,
  };
}
