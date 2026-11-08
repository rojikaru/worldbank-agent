/**
 * Chart export helpers. Recharts draws SVG whose colors are CSS variables
 * (var(--series-1)), which mean nothing outside the page, so exports copy
 * the computed colors onto the cloned elements first.
 */

type Cell = string | number | null;

export function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function rowsToCsv(
  headers: string[],
  columns: string[],
  rows: Record<string, Cell>[],
) {
  const escape = (value: Cell | undefined) => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [
    headers.map(escape).join(","),
    ...rows.map((row) => columns.map((c) => escape(row[c])).join(",")),
  ].join("\n");
}

const INLINED = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "opacity",
  "font-size",
  "font-family",
] as const;
const TITLE_HEIGHT = 32;

/** Serializes a live chart SVG into a self-contained file with a title and background */
export function svgToStandalone(svg: SVGSVGElement, title: string): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const originals = [svg, ...svg.querySelectorAll("*")];
  const copies = [clone, ...clone.querySelectorAll("*")];
  originals.forEach((el, i) => {
    const style = getComputedStyle(el);
    for (const prop of INLINED) {
      const value = style.getPropertyValue(prop);
      if (value) copies[i]!.setAttribute(prop, value);
    }
  });

  const { width, height } = svg.getBoundingClientRect();
  const page = getComputedStyle(document.body);
  const ns = "http://www.w3.org/2000/svg";

  const root = document.createElementNS(ns, "svg");
  root.setAttribute("xmlns", ns);
  root.setAttribute("width", String(width));
  root.setAttribute("height", String(height + TITLE_HEIGHT));

  const background = document.createElementNS(ns, "rect");
  background.setAttribute("width", "100%");
  background.setAttribute("height", "100%");
  background.setAttribute("fill", page.backgroundColor || "#ffffff");

  const heading = document.createElementNS(ns, "text");
  heading.setAttribute("x", "8");
  heading.setAttribute("y", "22");
  heading.setAttribute("font-size", "15");
  heading.setAttribute("font-weight", "600");
  heading.setAttribute("font-family", page.fontFamily);
  heading.setAttribute("fill", page.color);
  heading.textContent = title;

  clone.setAttribute("y", String(TITLE_HEIGHT));
  root.append(background, heading, clone);
  return new XMLSerializer().serializeToString(root);
}

export async function svgToPngBlob(
  svg: SVGSVGElement,
  title: string,
  scale = 2,
): Promise<Blob> {
  const markup = svgToStandalone(svg, title);
  const url = URL.createObjectURL(
    new Blob([markup], { type: "image/svg+xml" }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;
    const context = canvas.getContext("2d")!;
    context.scale(scale, scale);
    context.drawImage(image, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("PNG export failed")),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
