// @ts-check
/**
 * Pyodide worker: runs Python off the main thread so loading pandas (~20 MB)
 * and running analysis never freezes the chat.
 *
 * Served as a static ES module from /public on purpose: webpack bundles
 * workers with importScripts(), which makes Pyodide think it's in a classic
 * worker and refuse to start ("Classic web workers are not supported").
 *
 * Message protocol: see src/lib/pyodide/protocol.ts
 */

const PYODIDE_VERSION = "314.0.7";
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

/** @type {Promise<any> | null} */
let pyodidePromise = null;
const loaded = new Set();

/** @param {import("../src/lib/pyodide/protocol").WorkerResponse} message */
const post = (message) => self.postMessage(message);

function getPyodide() {
  pyodidePromise ??= (async () => {
    post({ type: "status", status: "loading-runtime" });
    const { loadPyodide } = await import(`${INDEX_URL}pyodide.mjs`);
    return loadPyodide({ indexURL: INDEX_URL });
  })();
  return pyodidePromise;
}

/** @param {any} pyodide @param {string[]} packages */
async function ensurePackages(pyodide, packages) {
  const missing = packages.filter((name) => !loaded.has(name));
  if (missing.length === 0) return;
  post({ type: "status", status: "loading-packages", packages: missing });
  await pyodide.loadPackage(missing);
  missing.forEach((name) => loaded.add(name));
}

// Builds `dfs` / `df` from JSON before the agent's code runs
const PRELUDE = `
import json, pandas as pd
dfs = {k: pd.DataFrame(v) for k, v in json.loads(__datasets_json).items()}
df = next(iter(dfs.values())) if dfs else None
# Several World Bank datasets → one wide table, one column per indicator,
# so the agent doesn't have to fight merge suffixes (value_x / value_y)
wide = None
_long = [(k, d) for k, d in dfs.items() if {"country", "year", "value"} <= set(d.columns)]
if len(_long) > 1:
    for _k, _d in _long:
        _part = _d[["country", "year", "value"]].rename(columns={"value": _k.split("@")[0]})
        wide = _part if wide is None else wide.merge(_part, on=["country", "year"], how="outer")
    wide = wide.sort_values(["country", "year"]).reset_index(drop=True)
result = None

# --- Modelling helpers: tested once here instead of re-invented by the model each time ---
from collections import namedtuple as _namedtuple

def _result_type(name, fields):
    # Unpacks in field order (a, b = f()), and also allows r.slope and r["slope"]:
    # with plain dicts, "slope, intercept = linear_trend(...)" silently unpacked the KEYS
    base = _namedtuple(name, fields)
    def _getitem(self, key):
        return getattr(self, key) if isinstance(key, str) else tuple.__getitem__(self, key)
    return type(name, (base,), {"__getitem__": _getitem, "__slots__": ()})

TrendFit = _result_type("TrendFit", "slope intercept r2 p_value n")
RegressionFit = _result_type("RegressionFit", "coefficients p_values r2 n")

def _clean_xy(x, y):
    d = pd.DataFrame({"x": list(x), "y": list(y)}).dropna()
    if len(d) < 3:
        raise ValueError(f"need at least 3 non-missing points, got {len(d)}")
    return d["x"].astype(float), d["y"].astype(float)

def linear_trend(x, y):
    """Straight-line trend y = slope*x + intercept -> TrendFit(slope, intercept, r2, p_value, n)."""
    from scipy import stats
    x, y = _clean_xy(x, y)
    r = stats.linregress(x, y)
    return TrendFit(float(r.slope), float(r.intercept), float(r.rvalue ** 2), float(r.pvalue), len(x))

def regress(data, y, xs):
    """OLS of column y on columns xs -> RegressionFit(coefficients, p_values, r2, n)."""
    import statsmodels.api as sm
    d = data[[y, *xs]].dropna()
    if len(d) < len(xs) + 3:
        raise ValueError(f"need at least {len(xs) + 3} complete rows, got {len(d)}")
    model = sm.OLS(d[y].astype(float), sm.add_constant(d[xs].astype(float))).fit()
    return RegressionFit(
        {k: float(v) for k, v in model.params.items()},
        {k: float(v) for k, v in model.pvalues.items()},
        float(model.rsquared),
        len(d),
    )

def forecast_arima(data, values=None, steps=5, order=(1, 1, 1)):
    """ARIMA forecast of ONE yearly series -> DataFrame year, actual, forecast, lower, upper (95%).
    Call as forecast_arima(one_country_df, steps=5), or forecast_arima(years, values, steps=5)
    with the HISTORICAL years and values."""
    import warnings
    from statsmodels.tsa.arima.model import ARIMA
    if isinstance(data, pd.DataFrame):
        if data["country"].nunique() > 1 if "country" in data else False:
            raise ValueError("forecast_arima takes one country; filter first, e.g. df[df['country'] == 'PL']")
        x, y = _clean_xy(data["year"], data["value"])
    else:
        if values is None or not hasattr(data, "__len__") or len(data) != len(values):
            raise ValueError("pass the historical years and values (same length), or one country's DataFrame")
        x, y = _clean_xy(data, values)
    x, y = x.sort_values(), y.loc[x.sort_values().index]
    if len(y) < 10:
        raise ValueError(
            f"ARIMA needs at least 10 yearly points, got {len(y)}. "
            "Print NEED_MORE_DATA and stop: the data must be fetched for more years (e.g. from 2000)."
        )
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        fit = ARIMA(y.reset_index(drop=True), order=order).fit()
    fc = fit.get_forecast(steps)
    ci = fc.conf_int(alpha=0.05)
    last = int(x.iloc[-1])
    past = pd.DataFrame({"year": x.astype(int).values, "actual": y.values})
    future = pd.DataFrame({
        "year": range(last + 1, last + 1 + steps),
        "forecast": fc.predicted_mean.values,
        "lower": ci.iloc[:, 0].values,
        "upper": ci.iloc[:, 1].values,
    })
    return pd.concat([past, future], ignore_index=True)
`;

// Turns `result` (DataFrame or Series) into a JSON table for charts
const EPILOGUE = `
__table = None
if isinstance(result, pd.Series):
    result = result.reset_index()
if isinstance(result, pd.DataFrame):
    __r = result.reset_index() if not isinstance(result.index, pd.RangeIndex) else result
    __r.columns = [str(c) for c in __r.columns]
    __table = __r.head(500).to_json(orient="split", date_format="iso")
__table
`;

/** @param {unknown} error */
const lastLines = (error) =>
  // Drop Pyodide's own frames and keep the tail: the agent only needs its line and the error
  String(/** @type {any} */ (error)?.message ?? error)
    .split("\n")
    .filter((line) => !/_pyodide|Traceback \(most recent|^\s*\^+\s*$|^\s*~+/.test(line))
    .slice(-4)
    .join("\n");

/** @param {MessageEvent<import("../src/lib/pyodide/protocol").WorkerRequest>} event */
self.onmessage = async (event) => {
  const request = event.data;
  const id = request.type === "run" ? request.id : "";
  let pyodide;
  try {
    pyodide = await getPyodide();
    // pandas is always needed for the dfs prelude; helpers pull in scipy/statsmodels on use
    const code = request.type === "run" ? request.code : "";
    const helperPackages = [
      ...(/linear_trend\(/.test(code) ? ["scipy"] : []),
      ...(/(regress|forecast_arima)\(/.test(code) ? ["statsmodels"] : []),
    ];
    await ensurePackages(pyodide, [...new Set(["pandas", ...request.packages, ...helperPackages])]);
    // Packages the agent's own imports need (only those bundled with Pyodide)
    if (code) await pyodide.loadPackagesFromImports(code);
  } catch (error) {
    pyodidePromise = null;
    post({ type: "status", status: "failed" });
    post({ type: "result", id, result: { status: "error", stdout: "", error: `Python runtime failed to load: ${lastLines(error)}` } });
    return;
  }

  if (request.type === "preload") {
    post({ type: "status", status: "ready" });
    return;
  }

  post({ type: "status", status: "running" });
  let stdout = "";
  pyodide.setStdout({ batched: (/** @type {string} */ line) => (stdout += `${line}\n`) });

  // Fresh namespace per run so runs don't leak variables into each other
  const globals = pyodide.globals.get("dict")();
  globals.set("__datasets_json", JSON.stringify(request.datasets));
  try {
    await pyodide.runPythonAsync(PRELUDE, { globals });
    await pyodide.runPythonAsync(request.code, { globals });
    const tableJson = await pyodide.runPythonAsync(EPILOGUE, { globals });
    let table;
    if (tableJson) {
      const split = JSON.parse(tableJson);
      table = {
        columns: split.columns,
        rows: split.data.map((/** @type {unknown[]} */ values) =>
          Object.fromEntries(split.columns.map((/** @type {string} */ c, /** @type {number} */ i) => [c, values[i] ?? null])),
        ),
      };
    }
    post({ type: "result", id, result: { status: "ok", stdout, table } });
  } catch (error) {
    post({ type: "result", id, result: { status: "error", stdout, error: lastLines(error) } });
  } finally {
    globals.destroy();
    post({ type: "status", status: "ready" });
  }
};
