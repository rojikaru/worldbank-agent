"use client";

/**
 * shadcn/ui chart primitives (trimmed): a Recharts container that turns a
 * config into CSS variables (--color-<key>) plus themed tooltip and legend.
 * https://ui.shadcn.com/docs/components/chart
 */

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = Record<string, { label?: React.ReactNode; color?: string }>;

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) throw new Error("useChart must be used within a <ChartContainer />");
  return context;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;
  const style = Object.fromEntries(
    Object.entries(config)
      .filter(([, item]) => item.color)
      .map(([key, item]) => [`--color-${key}`, item.color]),
  ) as React.CSSProperties;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        style={style}
        className={cn(
          "flex aspect-video justify-center text-xs",
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
          "[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border",
          "[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted",
          "[&_.recharts-dot[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-layer]:outline-hidden [&_.recharts-surface]:outline-hidden",
          className,
        )}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

const ChartTooltip = RechartsPrimitive.Tooltip;

type TooltipPayloadItem = {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string | null;
  color?: string;
};

function ChartTooltipContent({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: React.ReactNode;
  formatter?: (value: number) => string;
}) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;

  return (
    <div className="border-border/50 bg-background grid min-w-32 gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{label}</div>
      {payload.map((item) => {
        const key = String(item.dataKey ?? item.name);
        const value = typeof item.value === "number" ? item.value : null;
        return (
          <div key={key} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: item.color ?? `var(--color-${key})` }}
            />
            <span className="text-muted-foreground flex-1">{config[key]?.label ?? key}</span>
            <span className="text-foreground font-mono font-medium tabular-nums">
              {value === null ? "—" : formatter ? formatter(value) : value.toLocaleString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const ChartLegend = RechartsPrimitive.Legend;

/** Clickable legend: toggles series visibility through `onToggle` */
function ChartLegendContent({
  payload,
  hidden,
  onToggle,
}: {
  payload?: { dataKey?: string | number; color?: string }[];
  hidden?: Set<string>;
  onToggle?: (key: string) => void;
}) {
  const { config } = useChart();
  if (!payload?.length) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-3">
      {payload.map((item) => {
        const key = String(item.dataKey);
        const isHidden = hidden?.has(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle?.(key)}
            aria-pressed={!isHidden}
            className={cn(
              "text-foreground flex items-center gap-1.5 text-xs",
              isHidden && "opacity-40",
            )}
          >
            <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
            {config[key]?.label ?? key}
          </button>
        );
      })}
    </div>
  );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent };
