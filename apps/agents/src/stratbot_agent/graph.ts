import { writeFile } from "node:fs/promises";
import { AIMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { StateGraph, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ConfigurationSchema, ensureConfiguration } from "./configuration";
import { TOOLS } from "./tools";
import { loadChatModel } from "./utils";
import { type State, StateAnnotation } from "./state";
import {
  analystFinish,
  analystRun,
  analystWrite,
  routeAnalysis,
} from "./tools/analyst";

/**
 * Call the LLM powering our agent.
 */
async function callModel(
  state: State,
  config: RunnableConfig,
): Promise<Partial<State>> {
  const configuration = await ensureConfiguration(config);

  const model = await loadChatModel(configuration.model).then((m) =>
    m.bindTools(TOOLS),
  );

  const prompt = [
    { role: "system", content: configuration.systemPrompt },
    ...state.messages,
  ];
  let response = await model.invoke(prompt);

  // Small local models sometimes end a turn with nothing after a tool (seen
  // after show_chart). Ask once more instead of leaving the user without an answer;
  // the nudge isn't stored in state.
  if (!response.tool_calls?.length && !response.text.trim()) {
    response = await model.invoke([
      ...prompt,
      {
        role: "user",
        content:
          "Now write the final answer for me: key numbers first, then a short table if useful, then the source.",
      },
    ]);
  }

  return { messages: [response] };
}

/**
 * Decide where to route based on whether the model wants to call tools.
 */
function routeModelOutput(state: State): string {
  const lastMessage = state.messages.at(-1);
  if (!AIMessage.isInstance(lastMessage)) {
    return END;
  }

  const toolCalls = lastMessage.tool_calls ?? [];

  // If the LLM is invoking tools, route there.
  // Otherwise end the graph.
  return toolCalls.length > 0 ? "tools" : END;
}

/** After tools: hand over to the analyst sub-agent when `analyze` queued a task */
function routeAfterTools(state: State): "analystWrite" | "callModel" {
  return state.analysis ? "analystWrite" : "callModel";
}

const workflow = new StateGraph(StateAnnotation, ConfigurationSchema)
  // Main agent: model <-> tools
  .addNode("callModel", callModel)
  .addNode("tools", new ToolNode(TOOLS))
  // Analyst sub-agent: write code -> run in browser (interrupt) -> retry or report
  .addNode("analystWrite", analystWrite)
  .addNode("analystRun", analystRun)
  .addNode("analystFinish", analystFinish)
  .addEdge(START, "callModel")
  // Tool calls go to the tools node, a plain answer ends the run
  .addConditionalEdges("callModel", routeModelOutput)
  // Tool results go back to the model, unless `analyze` queued a task
  .addConditionalEdges("tools", routeAfterTools, ["analystWrite", "callModel"])
  .addEdge("analystWrite", "analystRun")
  .addConditionalEdges("analystRun", routeAnalysis, [
    "analystWrite",
    "analystFinish",
  ])
  .addEdge("analystFinish", "callModel");

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
