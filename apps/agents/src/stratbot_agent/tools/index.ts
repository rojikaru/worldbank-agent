/**
 * Tools available to the agent.
 *
 * Data flows around the model, not through it: get_dataset and the analyst
 * keep full tables in graph state and return short summaries, show_chart
 * renders a chart in the web app from those tables.
 */

import { showChartTool } from "./chart";
import { analyzeTool, preparePythonTool } from "./python";
import { getDatasetTool, searchIndicatorsTool } from "./world-bank";

export const TOOLS = [
  searchIndicatorsTool,
  getDatasetTool,
  preparePythonTool,
  analyzeTool,
  showChartTool,
];
