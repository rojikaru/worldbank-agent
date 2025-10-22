import { PlotToolSchema } from "@repo/agents/stratbot_agent/schema";
import { tool } from "@langchain/core/tools";
import { createCanvas } from "canvas";
import { Chart, type ChartItem } from "chart.js/auto";

export const plotTool = tool(
  ({ nodeCanvas: { width, height, mimeType }, ...config }) => {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    const chart = new Chart(ctx as unknown as ChartItem, config);
    return ["Generated chart", chart.toBase64Image(mimeType)];
  },
  {
    name: "plot_tool",
    description: `A tool to create plots based on provided data and specifications.
    Use this tool when you need to visualize data in 2D or 3D formats 
    because user requested a plot, graph or statistical representation.`,
    schema: PlotToolSchema,
    responseFormat: "content_and_artifact",
    returnDirect: true,
  },
);
