import { writeFile } from "node:fs/promises";
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
 */
async function callModel(
  state: typeof MessagesAnnotation.State,
  config: RunnableConfig,
): Promise<typeof MessagesAnnotation.Update> {
  const configuration = await ensureConfiguration(config);

  const model = await loadChatModel(configuration.model).then((m) =>
    m.bindTools(TOOLS),
  );

  const response = await model.invoke([
    { role: "system", content: configuration.systemPrompt },
    ...state.messages,
  ]);

  return { messages: [response] };
}

/**
 * Decide where to route based on whether the model wants to call tools.
 */
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

export const graph = workflow.compile({
  interruptBefore: [], // if you want to update the state before calling the tools
  interruptAfter: [],
});

async function generateGraphDiagram(): Promise<void> {
  const drawableGraph = await graph.getGraphAsync();
  const image = await drawableGraph.drawMermaidPng();
  await writeFile("graph.png", new Uint8Array(await image.arrayBuffer()));
}

// Generate a diagram of our graph only when run directly
if (import.meta.main) {
  await generateGraphDiagram();
}
