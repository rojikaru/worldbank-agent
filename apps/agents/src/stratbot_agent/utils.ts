import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import {
  type ConfigurableChatModelCallOptions,
  type ConfigurableModel,
  initChatModel,
} from "langchain/chat_models/universal";

type LoadedModel = ConfigurableModel<
  BaseLanguageModelInput,
  ConfigurableChatModelCallOptions
>;

/**
 * Load a chat model from a fully specified name.
 * @param fullySpecifiedName - String in the format 'provider/model' or 'provider/account/provider/model'.
 * @returns A Promise that resolves to a BaseChatModel instance.
 */
export async function loadChatModel(
  fullySpecifiedName: string,
): Promise<LoadedModel> {
  const index = fullySpecifiedName.indexOf("/");
  if (index === -1) {
    // If there's no "/", assume it's just the model
    return await initChatModel(fullySpecifiedName);
  }
  const provider = fullySpecifiedName.slice(0, index);
  const model = fullySpecifiedName.slice(index + 1);

  if (provider === "dmr") {
    // Docker Model Runner speaks the OpenAI API, so reuse the OpenAI client
    // with its local base URL (no key needed, but the client insists on one)
    return await initChatModel(model, {
      modelProvider: "openai",
      apiKey: "docker-model-runner",
      // eslint-disable-next-line no-process-env
      configuration: { baseURL: process.env.DMR_BASE_URL },
    });
  }
  return await initChatModel(model, { modelProvider: provider });
}
