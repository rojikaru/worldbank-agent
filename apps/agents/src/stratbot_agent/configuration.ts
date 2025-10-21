/**
 * Define the configurable parameters for the agent.
 */

import { Annotation } from "@langchain/langgraph";
import { SYSTEM_PROMPT_TEMPLATE } from "./prompts";
import { RunnableConfig } from "@langchain/core/runnables";
import process from "node:process";

// Define which models are available based on environment variables
const defaultModels = {
  "claude-haiku-4-5-20251001":
    typeof process.env.ANTHROPIC_API_KEY === "string",
  "gpt-4-mini": typeof process.env.OPENAI_API_KEY === "string",
} as const;

// Find the first available model
const defaultModel = Object.entries(defaultModels)
  .find(([, available]) => available)
  ?.at(0) as keyof typeof defaultModels;

// Assert that we have at least one model available
if (defaultModel === undefined) {
  throw new Error(
    "No language model API keys found in environment variables. Please set ANTHROPIC_API_KEY or OPENAI_API_KEY."
  );
}

export const ConfigurationSchema = Annotation.Root({
  /**
   * The system prompt to be used by the agent.
   */
  systemPromptTemplate: Annotation<string>,

  /**
   * The name of the language model to be used by the agent.
   */
  model: Annotation<string>,
});

/**
 * Ensure the defaults are populated.
 */
export function ensureConfiguration({
  configurable,
}: RunnableConfig): typeof ConfigurationSchema.State {
  return {
    systemPromptTemplate:
      configurable?.systemPromptTemplate ?? SYSTEM_PROMPT_TEMPLATE,
    model: configurable?.model ?? defaultModel,
  };
}
