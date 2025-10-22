import { z } from "zod";
import type { ChartType } from "chart.js";

const chartTypes = [
  "bar",
  "line",
  "scatter",
  "bubble",
  "pie",
  "doughnut",
  "polarArea",
  "radar",
] satisfies [ChartType, ...ChartType[]];

const ChartTypeSchema = z
  .enum(chartTypes)
  .describe("Chart type. Pick one of the most common types.");

const Color = z.string().describe("Color string (CSS color, hex, rgb, etc.).");

const DataPoint = z
  .union([
    z.number().describe("A single numeric value (typical for simple charts)."),
    z
      .object({
        x: z.number().describe("x"),
        y: z.number().describe("y"),
      })
      .describe("XY point object (for scatter / xy plots)."),
    z
      .array(z.number().describe("A number (x or y)"))
      .length(2)
      .describe("XY point tuple (for scatter / xy plots) as [x, y]."),
    z.null().describe("Missing/no-data marker."),
  ])
  .describe("One data point: number | {x,y} | null.");

const Dataset = z
  .object({
    label: z.string().describe("Optional dataset label."),
    data: z.array(DataPoint).min(1).describe("Array of data points."),
    backgroundColor: z
      .union([Color, z.array(Color)])
      .describe("Background color or array of colors."),
    borderColor: z
      .union([Color, z.array(Color)])
      .describe("Border color or array of border colors."),
  })
  .describe("A single dataset (label, data, basic styling).");

const TitleOption = z
  .object({
    display: z.boolean().default(true).describe("Show the title?"),
    text: z.string().describe("Title text."),
  })
  .describe("Chart title options.");

const LegendOption = z
  .object({
    display: z.boolean().default(true).describe("Show the legend?"),
    position: z
      .enum(["top", "bottom"])
      .default("top")
      .describe("Legend position (simplified)."),
  })
  .describe("Legend options.");

const Options = z
  .object({
    responsive: z.boolean().default(false).describe("Make chart responsive."),
    title: TitleOption.describe("Title plugin options."),
    legend: LegendOption.describe("Legend plugin options."),
  })
  .describe("Top-level options (small subset).");

export const SimplePlotSchema = z
  .object({
    type: ChartTypeSchema.default("line").describe("Chart type to render."),
    data: z
      .object({
        labels: z
          .array(z.string())
          .default([])
          .describe("Optional x-axis labels."),
        datasets: z.array(Dataset).min(1).describe("One or more datasets."),
      })
      .describe("Data object (labels + datasets)."),
    options: Options.describe("Optional chart options."),
  })
  .describe("Minimal Plot input schema meant for LLMs and simple tools.");

export type SimplePlotInput = z.infer<typeof SimplePlotSchema>;

export const NodeCanvasSchema = z
  .object({
    width: z.number().min(100).max(4000).default(800).describe("Canvas width."),
    height: z
      .number()
      .min(100)
      .max(4000)
      .default(600)
      .describe("Canvas height."),
    mimeType: z
      .enum(["image/png", "image/jpeg"])
      .default("image/png")
      .describe("Canvas image MIME type."),
  })
  .describe("Node canvas options where the plot will be rendered.");

export type NodeCanvasOptions = z.infer<typeof NodeCanvasSchema>;

export const PlotToolSchema = SimplePlotSchema.extend({
  nodeCanvas: NodeCanvasSchema.default({
    width: 800,
    height: 600,
    mimeType: "image/png",
  }).describe("Node canvas options."),
});

export type PlotToolInput = z.infer<typeof PlotToolSchema>;
