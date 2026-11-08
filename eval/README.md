# Eval harness

Sends `questions.json` through the agent's LangGraph API and answers Python
approvals like the browser does: the same prelude/epilogue is read from
`apps/web/public/pyodide-worker.mjs` and run with CPython in a container.

```bash
docker build -t wb-eval eval
docker run --rm --network host -v "$PWD/eval:/eval" -v "$PWD/apps/web/public:/worker:ro" \
  wb-eval python -I /eval/harness.py http://localhost:2024 /eval/results.jsonl /worker/pyodide-worker.mjs /eval/questions.json
```

Each line of the output records the tools called, Python attempts and errors,
charts, and the final answer. Re-running skips questions already in the file.

## Graded set

`questions-models.json` adds an `expect` block per question (helpers that must run,
chart yes/no, tools, answer regex, max errors). After a run:

```bash
python eval/grade.py eval/questions-models.json eval/results-models.jsonl
```
