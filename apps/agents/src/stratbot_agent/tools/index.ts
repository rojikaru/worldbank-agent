/**
 * This file defines the tools available to the ReAct agent.
 * Tools are functions that the agent can use to interact with external systems or perform specific tasks.
 */

import { plotTool } from "./plot";

/**
 * Export an array of all available tools
 * Add new tools to this array to make them available to the agent
 *
 * Note: You can create custom tools by implementing the Tool interface from `@langchain/core/tools`
 * and add them to this array.
 * See https://docs.langchain.com/oss/javascript/langchain/tools#tools for more information.
 */
export const TOOLS = [plotTool];
