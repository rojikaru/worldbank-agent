import { initApiPassthrough } from "langgraph-nextjs-api-passthrough";

// This file acts as a proxy for requests to your LangGraph server.
// Read the [Going to Production](https://github.com/langchain-ai/agent-chat-ui?tab=readme-ov-file#going-to-production) section for more information.

/* eslint-disable no-process-env, no-undef */
export const { GET, POST, PUT, PATCH, DELETE, OPTIONS, runtime } =
  initApiPassthrough({
    apiUrl: process.env.LANGGRAPH_API_URL, // default, if not defined it will attempt to read process.env.LANGGRAPH_API_URL
    apiKey: process.env.LANGSMITH_API_KEY, // default, if not defined it will attempt to read process.env.LANGSMITH_API_KEY
    runtime: "edge", // default
  });
/* eslint-enable no-process-env, no-undef */
