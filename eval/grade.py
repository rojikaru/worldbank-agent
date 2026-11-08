"""Grades harness results against per-question expectations.

usage: python grade.py questions.json results.jsonl

Expectations (all optional) in each question's "expect":
  helpers:      helper names that must appear in a Python run that succeeded
  not_helpers:  helper names that must not be used
  chart:        true/false, whether a chart widget must (not) be shown
  tools:        tool names that must be called
  answer_match: regex the final answer must match (case-insensitive)
  max_errors:   maximum failed Python runs
"""
import json, re, sys

questions = {q["id"]: q for q in json.load(open(sys.argv[1]))}
results = [json.loads(line) for line in open(sys.argv[2])]

def check(q, r):
    e, fails = q.get("expect", {}), []
    ok_code = "\n".join(run["code"] for run in r.get("runs", []) if run["status"] == "ok")
    all_code = "\n".join(run["code"] for run in r.get("runs", []))
    for h in e.get("helpers", []):
        if f"{h}(" not in ok_code:
            fails.append(f"helper {h} not used successfully")
    for h in e.get("not_helpers", []):
        if f"{h}(" in all_code:
            fails.append(f"helper {h} used but shouldn't be")
    if "chart" in e and bool(r.get("charts")) != e["chart"]:
        fails.append(f"chart expected={e['chart']} got={r.get('charts')}")
    for t in e.get("tools", []):
        if t not in r.get("tools", []):
            fails.append(f"tool {t} not called")
    if "answer_match" in e and not re.search(e["answer_match"], r.get("answer", ""), re.I):
        fails.append(f"answer doesn't match /{e['answer_match']}/")
    if "max_errors" in e and r.get("py_errors", 0) > e["max_errors"]:
        fails.append(f"{r['py_errors']} Python errors > {e['max_errors']}")
    if r.get("error"):
        fails.append(f"harness error {r['error']}")
    return fails

passed = 0
for r in results:
    q = questions.get(r["id"])
    if not q:
        continue
    fails = check(q, r)
    passed += not fails
    status = "PASS" if not fails else "FAIL"
    print(f"{status} {r['id']:<22} {r['secs']:>4}s py={r['py_runs']}/{r['py_errors']}err charts={r.get('charts')}")
    for f in fails:
        print(f"     - {f}")
print(f"\n{passed}/{len(results)} passed")
