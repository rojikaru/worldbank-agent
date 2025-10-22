import { AIMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import {
  MessagesAnnotation,
  StateGraph,
  START,
  END,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import { ConfigurationSchema, ensureConfiguration } from "./configuration";
import { TOOLS } from "./tools";
import { loadChatModel } from "./utils";

/**
 * Call the LLM powering our agent.
 *
 * @param state - The current state of the MessagesAnnotation
 * @param config - The runnable configuration
 * @returns An update to the MessagesAnnotation state with the LLM's response
 */
async function callModel(
  state: typeof MessagesAnnotation.State,
  config: RunnableConfig,
): Promise<typeof MessagesAnnotation.Update> {
  const configuration = await ensureConfiguration(config);

  // Feel free to customize the prompt, model, and other logic!
  const model = await loadChatModel(configuration.model).then((m) =>
    m.bindTools(TOOLS),
  );

  const response = await model.invoke([
    {
      role: "system",
      content: configuration.systemPrompt,
    },
    ...state.messages,
  ]);

  // We return a list, because this will get added to the existing list
  return { messages: [response] };
}

// Define the function that determines whether to continue or not
function routeModelOutput(state: typeof MessagesAnnotation.State): string {
  const lastMessage = state.messages.at(-1);
  if (!AIMessage.isInstance(lastMessage)) {
    return END;
  }

  const toolCalls = lastMessage.tool_calls ?? [];

  // If the LLM is invoking tools, route there.
  // Otherwise end the graph.
  return toolCalls.length > 0 ? "tools" : END;
}

// Define a new graph. We use the prebuilt MessagesAnnotation to define state:
// https://langchain-ai.github.io/langgraphjs/concepts/low_level/#messagesannotation
const workflow = new StateGraph(MessagesAnnotation, ConfigurationSchema)
  // Define the two nodes we will cycle between
  .addNode("callModel", callModel)
  .addNode("tools", new ToolNode(TOOLS))
  // Set the entrypoint as `callModel`
  // This means that this node is the first one called
  .addEdge(START, "callModel")
  // Decide where to go after calling the model, if needed
  .addConditionalEdges("callModel", routeModelOutput)
  // Pass tool outputs back to the model
  .addEdge("tools", "callModel");

// This compiles it into a graph you can invoke and deploy.
export const graph = workflow.compile({
  interruptBefore: [], // if you want to update the state before calling the tools
  interruptAfter: [],
});
