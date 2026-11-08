"use client";

import { useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { download, rowsToCsv, svgToPngBlob, svgToStandalone } from "./export";

type Cell = string | number | null;
type Kind = "line" | "bar" | "scatter";
type View = Kind | "table";

/** Must match ChartProps in apps/agents/src/stratbot_agent/tools/chart.ts */
export interface ChartWidgetProps {
  title: string;
  description?: string;
  insight?: string;
  kind: Kind;
  xKey: string;
  series: { key: string; label: string }[];
  rows: Record<string, Cell>[];
  sources: { id: string; title: string; indicatorId?: string }[];
}

/** Eight validated categorical slots; past that, series fall back to neutral ink instead of cycling hues */
const seriesColor = (index: number) =>
  index < 8 ? `var(--series-${index + 1})` : "var(--muted-foreground)";

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 });
const precise = new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 });

export function ChartWidget(props: ChartWidgetProps) {
  const { title, description, insight, xKey, series, rows, sources } = props;
  const [view, setView] = useState<View>(props.kind);
  // The chart stays mounted in table view so PNG/SVG export keep working
  const [kind, setKind] = useState<Kind>(props.kind);
  const showTable = view === "table";
  const views: View[] = props.kind === "scatter" ? ["scatter", "table"] : ["line", "bar", "table"];
  const selectView = (next: View) => {
    setView(next);
    if (next !== "table") setKind(next);
  };
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(series.slice(8).map((s) => s.key)),
  );
  const chartRef = useRef<HTMLDivElement>(null);

  const config = useMemo<ChartConfig>(
    () =>
      Object.fromEntries(
        series.map((s, i) => [s.key, { label: s.label, color: seriesColor(i) }]),
      ),
    [series],
  );

  const toggle = (key: string) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const fileName = title.replace(/[^\w-]+/g, "_").slice(0, 60) || "chart";
  const columns = [xKey, ...series.map((s) => s.key)];
  const headers = [xKey, ...series.map((s) => s.label)];

  const exportSvg = () => {
    const svg = chartRef.current?.querySelector<SVGSVGElement>("svg.recharts-surface");
    if (svg) download(new Blob([svgToStandalone(svg, title)], { type: "image/svg+xml" }), `${fileName}.svg`);
  };
  const exportPng = async () => {
    const svg = chartRef.current?.querySelector<SVGSVGElement>("svg.recharts-surface");
    if (svg) download(await svgToPngBlob(svg, title), `${fileName}.png`);
  };
  const exportCsv = () =>
    download(
      new Blob([rowsToCsv(headers, columns, rows)], { type: "text/csv" }),
      `${fileName}.csv`,
    );

  const visible = series.map((s, i) => ({ ...s, color: seriesColor(i) })).filter((s) => !hidden.has(s.key));
  const pointsPerSeries = rows.length;

  // An array, not a fragment: Recharts 2 only finds axes/legend among direct (flattened) children
  const axes = [
      <CartesianGrid key="grid" vertical={false} strokeDasharray="0" stroke="var(--border)" />,
      <XAxis
        key="x"
        dataKey={xKey}
        type={kind === "scatter" ? "number" : "category"}
        domain={["auto", "auto"]}
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        minTickGap={16}
        tickFormatter={(v) => (typeof v === "number" && kind === "scatter" ? compact.format(v) : String(v))}
      />,
      <YAxis key="y" tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => compact.format(v)} />,
      <ChartTooltip key="tooltip" content={<ChartTooltipContent formatter={(v) => precise.format(v)} />} />,
      <ChartLegend key="legend" content={<ChartLegendContent hidden={hidden} onToggle={toggle} />} />
  ];

  // Hidden series stay mounted (hide prop) so the legend can bring them back
  const chart =
    kind === "bar" ? (
      <BarChart data={rows} barGap={2}>
        {axes}
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} fill={seriesColor(i)} radius={[4, 4, 0, 0]} hide={hidden.has(s.key)} />
        ))}
      </BarChart>
    ) : kind === "scatter" ? (
      <ScatterChart>
        {axes}
        {series.map((s, i) => (
          <Scatter
            key={s.key}
            name={s.key}
            data={rows.map((row) => ({ [xKey]: row[xKey], [s.key]: row[s.key] }))}
            dataKey={s.key}
            fill={seriesColor(i)}
            hide={hidden.has(s.key)}
          />
        ))}
      </ScatterChart>
    ) : (
      <LineChart data={rows}>
        {axes}
        {series.map((s, i) => (
          <Line
            key={s.key}
            dataKey={s.key}
            stroke={seriesColor(i)}
            strokeWidth={2}
            dot={pointsPerSeries <= 15 ? { r: 4, strokeWidth: 2, stroke: "var(--background)" } : false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--background)" }}
            connectNulls={false}
            hide={hidden.has(s.key)}
          />
        ))}
      </LineChart>
    );

  return (
    <div className="bg-card text-card-foreground relative w-full max-w-3xl overflow-hidden rounded-xl border p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
        <div role="radiogroup" aria-label="View" className="bg-muted flex items-center gap-0.5 rounded-md p-0.5">
          {views.map((v) => (
            <Button
              key={v}
              role="radio"
              aria-checked={view === v}
              size="sm"
              variant={view === v ? "outline" : "ghost"}
              onClick={() => selectView(v)}
              className={cn("h-7 px-2.5 capitalize", view !== v && "text-muted-foreground")}
            >
              {v === "table" && <Table2 className="size-3.5" />}
              {v}
            </Button>
          ))}
        </div>
      </div>

      {/* Off-screen but measurable in table view: display:none would give the SVG zero size */}
      <div
        ref={chartRef}
        aria-hidden={showTable}
        className={cn(showTable && "pointer-events-none invisible absolute -left-[9999px] w-[720px]")}
      >
        <ChartContainer config={config} className="aspect-auto h-72 w-full">
          {chart}
        </ChartContainer>
      </div>

      {showTable && (
        <div className="max-h-72 overflow-auto rounded-md border">
          <table className="w-full text-xs tabular-nums">
            <thead className="bg-muted sticky top-0">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="border-t">
                  {columns.map((c) => (
                    <td key={c} className="px-2 py-1">
                      {typeof row[c] === "number" && c !== xKey ? precise.format(row[c] as number) : (row[c] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {insight && <p className="mt-3 text-sm leading-relaxed">{insight}</p>}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Source: World Bank
          {sources.some((s) => s.indicatorId) &&
            ` (${sources.flatMap((s) => (s.indicatorId ? [s.indicatorId] : [])).join(", ")})`}
          {visible.length < series.length && ` · ${series.length - visible.length} series hidden`}
        </p>
        <div className="flex items-center gap-1">
          <Download className="text-muted-foreground size-3.5" aria-hidden />
          <Button size="sm" variant="outline" className="h-7 px-2" onClick={exportCsv}>CSV</Button>
          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => void exportPng()}>PNG</Button>
          <Button size="sm" variant="outline" className="h-7 px-2" onClick={exportSvg}>SVG</Button>
        </div>
      </div>
    </div>
  );
}
