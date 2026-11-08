import type { Cell } from "../state";

/** Rounds to 4 significant digits so tables stay short in the model's context */
export function formatNumber(value: Cell | undefined): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "number") return String(value);
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toPrecision(4)));
}

/** Minimal CSV: commas inside text cells are replaced, the model doesn't need quoting rules */
export function toCsv(columns: string[], rows: Record<string, Cell>[]): string {
  const cell = (value: Cell | undefined) =>
    typeof value === "string"
      ? value.replaceAll(",", " ")
      : formatNumber(value);
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => cell(row[column])).join(",")),
  ].join("\n");
}
