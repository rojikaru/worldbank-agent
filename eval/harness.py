"""Eval harness: runs questions through the LangGraph API and answers run_python
interrupts the way the browser does (same prelude/epilogue, read from the worker)."""
import contextlib, io, json, re, sys, time, traceback
import requests

API = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:2025"
OUT = sys.argv[2]
WORKER = sys.argv[3]
QUESTIONS = json.load(open(sys.argv[4]))
MAX_RESUMES = 10

src = open(WORKER).read()
PRELUDE = re.search(r"const PRELUDE = `(.*?)`;", src, re.S).group(1)
EPILOGUE = re.search(r"const EPILOGUE = `(.*?)`;", src, re.S).group(1)

def run_python(req):
    ns = {"__datasets_json": json.dumps({d["id"]: d["rows"] for d in req["datasets"]})}
    out = io.StringIO()
    try:
        with contextlib.redirect_stdout(out):
            exec(PRELUDE, ns)
            exec(req["code"], ns)
            exec(EPILOGUE.strip().rsplit("\n", 1)[0], ns)  # drop the trailing bare expression
        table = None
        if ns.get("__table"):
            split = json.loads(ns["__table"])
            table = {"columns": split["columns"],
                     "rows": [dict(zip(split["columns"], v)) for v in split["data"]]}
        return {"status": "ok", "stdout": out.getvalue(), **({"table": table} if table else {})}
    except Exception:
        tb = traceback.format_exc().splitlines()
        tb = [l for l in tb if "harness.py" not in l and not l.startswith("Traceback")]
        return {"status": "error", "stdout": out.getvalue(), "error": "\n".join(tb[-4:])}

def wait(thread, body):
    r = requests.post(f"{API}/threads/{thread}/runs/wait", json={"assistant_id": "agent", **body}, timeout=900)
    r.raise_for_status()

def pending_interrupt(thread):
    state = requests.get(f"{API}/threads/{thread}/state").json()
    for task in state.get("tasks", []):
        for it in task.get("interrupts", []):
            return it["value"], state
    return None, state

import os
done = {json.loads(l)["id"] for l in open(OUT)} if os.path.exists(OUT) else set()
with open(OUT, "a") as f:
    for item in QUESTIONS:
        if item["id"] in done:
            continue
        t0 = time.time()
        thread = requests.post(f"{API}/threads", json={}).json()["thread_id"]
        record = {"id": item["id"], "q": item["q"], "thread": thread, "py_runs": 0, "py_errors": 0, "runs": []}
        try:
            wait(thread, {"input": {"messages": [{"role": "user", "content": item["q"]}]}})
            for _ in range(MAX_RESUMES):
                value, state = pending_interrupt(thread)
                if not value:
                    break
                result = run_python(value)
                record["runs"].append({"code": value["code"], "status": result["status"],
                                       "stdout": result.get("stdout", "")[-1500:]})
                record["py_runs"] += 1
                record["py_errors"] += result["status"] == "error"
                wait(thread, {"command": {"resume": result}})
            value, state = pending_interrupt(thread)
            msgs = state["values"]["messages"]
            record["tools"] = [tc["name"] for m in msgs if m["type"] == "ai" for tc in m.get("tool_calls", [])]
            final = msgs[-1]
            record["answer"] = final["content"] if isinstance(final["content"], str) else json.dumps(final["content"])
            record["charts"] = len(state["values"].get("ui", []))
            record["insight"] = [u["props"].get("insight") for u in state["values"].get("ui", [])]
            record["stuck_on_interrupt"] = bool(value)
        except Exception as e:
            record["error"] = repr(e)
        record["secs"] = round(time.time() - t0)
        f.write(json.dumps(record, ensure_ascii=False) + "\n"); f.flush()
        print(f'{item["id"]}: {record["secs"]}s tools={len(record.get("tools", []))} py={record["py_runs"]}/{record["py_errors"]}err charts={record.get("charts")}', flush=True)
