# Local AI Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish-ready interactive "Local AI Explorer" figure for the local-AI article, backed by a frozen, corrected September 9, 2026 Token Economy snapshot.

**Architecture:** A Python export script in the Token Economy repository reads the existing September 9 parquet store, re-applies `patches.json` exactly like the dashboard, and writes one aggregate, identifier-free JSON file into the blog's `assets/data/`. The blog registers a `local-ai-explorer` figure type that lazy-loads ECharts (vendored from npm at build time, like Three.js) and renders three views: daily calls by deployment, prompt-size distribution, and initial prompt size versus agent trajectory score. A draft post embeds the figure and the orchestrator download callout.

**Tech Stack:** Python 3.12 + pyarrow + pytest (Token Economy `.venv`); Node ESM static site, `node --test`, ECharts (npm), markdown-it.

**Spec:** [docs/local-ai-article-proposal.md](../../local-ai-article-proposal.md) — sections "Visuals and interactive explorer", "Agent trajectory score: proposed revision", "Data and claim checks before publication".

**Out of scope (separate plans):** the four redrawn diagrams (slides 3, 4, 5, 8) and the article prose. The draft post in Task 7 contains only headings from the proposal, the explorer embed, and the download callout.

## Global Constraints

- Repositories: Token Economy = `/Users/pdenarie/Developer/Token Economy`; blog = `/Users/pdenarie/Developer/Personal/Blog_posts`.
- Python commands in Token Economy run with `.venv/bin/python` (system `python3` lacks duckdb/pyarrow deps).
- **Never run `etl.py`.** The snapshot is the existing `data/*.parquet` store (written 2026-09-09, max inference timestamp 2026-09-09 20:30 UTC). `copilot-otel.jsonl` keeps growing; rerunning the ETL would change the data and the conversation-link heuristics.
- **Corrections are mandatory:** load `inferences` through `patch.load()` + `patch.apply("inferences", rows, spec["inferences"])`, exactly like `serve.py:load_parquets`. Do not edit, bypass, or copy `patches.json` into the blog. Provenance records only its SHA-256 and the patch stats.
- Data through: 2026-09-09 inclusive. Day boundaries: UTC. Periods: `local_only` = 2026-07-09…2026-07-31; `hybrid` = 2026-08-01…2026-09-09.
- Deployment per model: `models.parquet` `deployment`, overridden by `prices.json` `_deployment_overrides` (keys starting `_` ignored) — same as `serve.py:load_settings`. Deployments: `local`, `cloud`, `copilot`; anything else → `other`.
- Prompt route: from the deployments of a prompt's (`conv`'s) calls, considering only `local`/`cloud`: only local → `local`, only cloud → `cloud`, both → `mixed`, neither → excluded.
- Score (per prompt): `trajectory_score = ln(1+agent_depth) + ln(1+prompt_position) + ln(1+tool_calls)`, equal weights, rounded to 4 decimals.
  - `agent_depth` = max patched `iterations` over the prompt's calls; `None` if no call has it.
  - `prompt_position` = 1-based rank of the prompt within its `session_id` in `sessions.parquet`, ordered by session-start `ts`; `None` if not found.
  - `tool_calls` = max patched `tool_calls` over the prompt's calls; `None` → `0` (an observed count: no linked tool events).
  - Score is `None` when `agent_depth` or `prompt_position` is `None`.
  - `subagent_runs` = count of `tools.parquet` rows with `tool_name == "runSubagent"` for the prompt; tooltip only, never in the score.
  - Reasoning tokens and output tokens never appear in the export, score, or UI.
- Initial prompt size = `input_tokens` of the prompt's first call (sorted by `ts`, then `input_tokens`).
- Prompt-size bins (calls, not prompts): `<1k`, `1–10k`, `10–100k`, `100k+` with half-open bounds `[0,1e3)`, `[1e3,1e4)`, `[1e4,1e5)`, `[1e5,∞)`.
- Public JSON must not contain any of these keys anywhere: `conv`, `trace_id`, `span_id`, `session_id`, `response_id`, `model`, `ts`, `_note`, `reasoning_tokens`, `output_tokens`. No prompts, file paths, or model names.
- Colors (from Token Economy `static/app.js`): local `#3ddc97`, cloud `#ff7a66`, copilot `#c792ea`, other `#8a94ab`; mixed `#f5c542`.
- Blog commits: the blog index has unrelated staged changes (`.gitmodules`, `cocktail_party_problem`). Always commit with explicit paths: `git add <paths> && git commit -m "…" -- <paths>`. Token Economy has many unrelated uncommitted changes; likewise add/commit only the task's files.
- Do not push either repository or deploy. Pushing the blog deploys `assets/` publicly; publication happens only after the user's final review (Task 8).
- Expected snapshot checks (UTC days, verified by a dry run of Tasks 1–2 against the real store on 2026-11-10): `local_only` has 1,419 local, 0 cloud, 0 copilot calls; `hybrid` has 1,587 local, 1,614 cloud, and 1,961 copilot calls (Copilot helper models: 1,958 `gpt-4o-mini` + 3 `instant-apply-qwen3-4b-no-think`). Prompts: 976 total, 953 scored (local_only/local 426, hybrid/local 360, hybrid/cloud 190; mixed 0). Patch stats on re-apply: `applied 0, disabled 0, orphaned 754` — all 754 corrections are `_disabled` rows (cloud calls in Jul 9–31, "not part of experiment") that the ETL already removed, so they are orphaned on re-apply by design.
- Baseline: Token Economy `pytest` has one pre-existing failure, `tests/test_complexity.py::test_score_all_zero_weights_is_zero` (non-zero weights in `complexity.json`). Leave it alone; it must remain the only failure.

---

### Task 1: Export core functions (Token Economy)

**Files:**
- Create: `/Users/pdenarie/Developer/Token Economy/public_export.py`
- Test: `/Users/pdenarie/Developer/Token Economy/tests/test_public_export.py`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces (module `public_export`):
  - `utc_day(ts_ms: int) -> str` (`"YYYY-MM-DD"`)
  - `period_of(day: str) -> str | None`
  - `size_bin(tokens: int) -> str`
  - `route_of(deployments: Iterable[str | None]) -> str | None`
  - `trajectory_score(agent_depth, prompt_position, tool_calls) -> float | None`
  - `prompt_positions(sessions: list[dict]) -> dict[str, int]`
  - `subagent_runs(tools: list[dict]) -> Counter`
  - `build_prompts(inferences, deployment_of: dict[str, str], positions, subagents) -> list[dict]` with keys `period, route, input_tokens, agent_depth, prompt_position, tool_calls, subagent_runs, score`
  - `daily_calls(inferences, deployment_of) -> list[dict]` with keys `day, deployment, calls`
  - `size_bins(inferences, deployment_of) -> list[dict]` with keys `period, deployment, bin, calls`
  - `assert_public(obj) -> None` (raises `ValueError`)
  - constants `CUTOFF_MS`, `PERIODS`, `BIN_LABELS`, `FORBIDDEN_KEYS`

- [ ] **Step 1: Write the failing tests**

```python
import math

import pytest

import public_export as pe

DAY_JUL10 = 1783641600000  # 2026-07-10T00:00:00Z
DAY_AUG02 = 1785628800000  # 2026-08-02T00:00:00Z
DAY_JUN20 = 1781913600000  # 2026-06-20T00:00:00Z
DEP = {"qwen": "local", "claude": "cloud", "gpt-4o-mini": "copilot"}


def test_utc_day_and_periods():
    assert pe.utc_day(DAY_JUL10) == "2026-07-10"
    assert pe.period_of("2026-07-09") == "local_only"
    assert pe.period_of("2026-07-31") == "local_only"
    assert pe.period_of("2026-08-01") == "hybrid"
    assert pe.period_of("2026-09-09") == "hybrid"
    assert pe.period_of("2026-09-10") is None
    assert pe.period_of("2026-07-08") is None


def test_size_bin_edges():
    assert pe.size_bin(0) == "<1k"
    assert pe.size_bin(999) == "<1k"
    assert pe.size_bin(1000) == "1–10k"
    assert pe.size_bin(10000) == "10–100k"
    assert pe.size_bin(100000) == "100k+"


def test_route_of():
    assert pe.route_of(["local", "local"]) == "local"
    assert pe.route_of(["cloud", "copilot"]) == "cloud"
    assert pe.route_of(["local", "cloud"]) == "mixed"
    assert pe.route_of(["copilot", None]) is None


def test_trajectory_score():
    assert pe.trajectory_score(3, 2, 5) == round(math.log1p(3) + math.log1p(2) + math.log1p(5), 4)
    assert pe.trajectory_score(None, 2, 5) is None
    assert pe.trajectory_score(3, None, 5) is None


def test_prompt_positions_rank_within_session_by_ts():
    sessions = [
        {"session_id": "s1", "conv": "b", "ts": 20},
        {"session_id": "s1", "conv": "a", "ts": 10},
        {"session_id": "s2", "conv": "c", "ts": 5},
        {"session_id": None, "conv": "d", "ts": 1},
    ]
    assert pe.prompt_positions(sessions) == {"a": 1, "b": 2, "c": 1}


def test_subagent_runs_counts_only_runSubagent():
    tools = [{"conv": "a", "tool_name": "runSubagent"}, {"conv": "a", "tool_name": "runSubagent"},
             {"conv": "a", "tool_name": "read_file"}, {"conv": None, "tool_name": "runSubagent"}]
    assert pe.subagent_runs(tools) == {"a": 2}


def test_build_prompts():
    inf = [
        # mixed prompt in hybrid period; first call sets the initial size
        {"conv": "m", "ts": DAY_AUG02 + 5, "model": "claude", "input_tokens": 9000, "iterations": 4, "tool_calls": 7},
        {"conv": "m", "ts": DAY_AUG02, "model": "qwen", "input_tokens": 1200, "iterations": 4, "tool_calls": 7},
        # local prompt without linked tools -> tool_calls 0
        {"conv": "l", "ts": DAY_JUL10, "model": "qwen", "input_tokens": 500, "iterations": 1, "tool_calls": None},
        # missing depth -> score None
        {"conv": "n", "ts": DAY_JUL10, "model": "qwen", "input_tokens": 50, "iterations": None, "tool_calls": None},
        # outside both periods -> excluded
        {"conv": "o", "ts": DAY_JUN20, "model": "qwen", "input_tokens": 1, "iterations": 1, "tool_calls": 1},
        # copilot-only -> excluded
        {"conv": "c", "ts": DAY_JUL10, "model": "gpt-4o-mini", "input_tokens": 1, "iterations": 1, "tool_calls": 1},
        # no conversation -> excluded
        {"conv": None, "ts": DAY_JUL10, "model": "qwen", "input_tokens": 1},
    ]
    positions = {"m": 3, "l": 1, "n": 2, "o": 1, "c": 1}
    out = pe.build_prompts(inf, DEP, positions, {"m": 2})
    by_route = {(p["route"], p["input_tokens"]): p for p in out}
    assert len(out) == 3
    m = by_route[("mixed", 1200)]
    assert m == {"period": "hybrid", "route": "mixed", "input_tokens": 1200, "agent_depth": 4,
                 "prompt_position": 3, "tool_calls": 7, "subagent_runs": 2,
                 "score": pe.trajectory_score(4, 3, 7)}
    assert by_route[("local", 500)]["tool_calls"] == 0
    assert by_route[("local", 500)]["subagent_runs"] == 0
    assert by_route[("local", 50)]["score"] is None


def test_daily_calls_and_size_bins():
    inf = [
        {"ts": DAY_JUL10, "model": "qwen", "input_tokens": 500},
        {"ts": DAY_JUL10 + 1, "model": "qwen", "input_tokens": 20000},
        {"ts": DAY_AUG02, "model": "claude", "input_tokens": 150000},
        {"ts": DAY_AUG02, "model": "unknown", "input_tokens": 10},
        {"ts": pe.CUTOFF_MS, "model": "qwen", "input_tokens": 10},  # after cutoff
    ]
    assert pe.daily_calls(inf, DEP) == [
        {"day": "2026-07-10", "deployment": "local", "calls": 2},
        {"day": "2026-08-02", "deployment": "cloud", "calls": 1},
        {"day": "2026-08-02", "deployment": "other", "calls": 1},
    ]
    assert pe.size_bins(inf, DEP) == [
        {"period": "local_only", "deployment": "local", "bin": "<1k", "calls": 1},
        {"period": "local_only", "deployment": "local", "bin": "10–100k", "calls": 1},
        {"period": "hybrid", "deployment": "cloud", "bin": "100k+", "calls": 1},
    ]


def test_assert_public_rejects_identifiers_anywhere():
    pe.assert_public({"prompts": [{"route": "local", "score": 1.0}]})
    with pytest.raises(ValueError, match="conv"):
        pe.assert_public({"prompts": [{"route": "local", "conv": "x"}]})
    with pytest.raises(ValueError, match="reasoning_tokens"):
        pe.assert_public({"a": {"b": [{"reasoning_tokens": 0}]}})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/pdenarie/Developer/Token Economy" && .venv/bin/python -m pytest tests/test_public_export.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'public_export'`

- [ ] **Step 3: Write the implementation**

```python
#!/usr/bin/env python3
"""Export the frozen, corrected public snapshot for the blog's Local AI Explorer.

Reads the existing September 9, 2026 parquet store (never reruns etl.py),
re-applies patches.json exactly like serve.py, and writes aggregate chart
data without identifiers. Reasoning and output tokens are never exported.
"""
import datetime as dt
import math
from collections import Counter, defaultdict

UTC = dt.timezone.utc
CUTOFF_MS = int(dt.datetime(2026, 9, 10, tzinfo=UTC).timestamp() * 1000)  # exclusive
DATA_THROUGH = "2026-09-09"
PERIODS = (("local_only", "2026-07-09", "2026-07-31"),
           ("hybrid", "2026-08-01", "2026-09-09"))
SIZE_BINS = (("<1k", 0, 1e3), ("1–10k", 1e3, 1e4),
             ("10–100k", 1e4, 1e5), ("100k+", 1e5, math.inf))
BIN_LABELS = tuple(b[0] for b in SIZE_BINS)
DEPLOYMENTS = ("local", "cloud", "copilot")
FORBIDDEN_KEYS = {"conv", "trace_id", "span_id", "session_id", "response_id", "model",
                  "ts", "_note", "reasoning_tokens", "output_tokens"}


def utc_day(ts_ms):
    return dt.datetime.fromtimestamp(ts_ms / 1000, UTC).date().isoformat()


def period_of(day):
    for name, start, end in PERIODS:
        if start <= day <= end:
            return name
    return None


def size_bin(tokens):
    for label, lo, hi in SIZE_BINS:
        if lo <= tokens < hi:
            return label
    raise ValueError(f"negative token count: {tokens}")


def deployment(model, deployment_of):
    dep = deployment_of.get(model)
    return dep if dep in DEPLOYMENTS else "other"


def route_of(deployments):
    seen = {d for d in deployments if d in ("local", "cloud")}
    if seen == {"local"}:
        return "local"
    if seen == {"cloud"}:
        return "cloud"
    if seen == {"local", "cloud"}:
        return "mixed"
    return None


def trajectory_score(agent_depth, prompt_position, tool_calls):
    parts = (agent_depth, prompt_position, tool_calls)
    if any(p is None for p in parts):
        return None
    return round(sum(math.log1p(p) for p in parts), 4)


def prompt_positions(sessions):
    by_session = defaultdict(list)
    for s in sessions:
        if s.get("session_id") and s.get("conv"):
            by_session[s["session_id"]].append((s["ts"], s["conv"]))
    positions = {}
    for rows in by_session.values():
        for i, (_, conv) in enumerate(sorted(rows), start=1):
            positions[conv] = i
    return positions


def subagent_runs(tools):
    return Counter(t["conv"] for t in tools
                   if t.get("conv") and t.get("tool_name") == "runSubagent")


def _in_snapshot(row):
    return row["ts"] < CUTOFF_MS


def build_prompts(inferences, deployment_of, positions, subagents):
    by_conv = defaultdict(list)
    for r in inferences:
        if r.get("conv") and _in_snapshot(r):
            by_conv[r["conv"]].append(r)
    prompts = []
    for conv, calls in by_conv.items():
        calls.sort(key=lambda r: (r["ts"], r.get("input_tokens") or 0))
        period = period_of(utc_day(calls[0]["ts"]))
        route = route_of(deployment_of.get(r.get("model")) for r in calls)
        if period is None or route is None:
            continue
        depth = max((r["iterations"] for r in calls if r.get("iterations") is not None), default=None)
        tools = max((r["tool_calls"] for r in calls if r.get("tool_calls") is not None), default=None)
        tools = 0 if tools is None else tools
        position = positions.get(conv)
        prompts.append({
            "period": period, "route": route,
            "input_tokens": int(calls[0].get("input_tokens") or 0),
            "agent_depth": depth, "prompt_position": position, "tool_calls": tools,
            "subagent_runs": subagents.get(conv, 0),
            "score": trajectory_score(depth, position, tools),
        })
    prompts.sort(key=lambda p: (p["period"], p["route"], p["input_tokens"]))
    return prompts


def daily_calls(inferences, deployment_of):
    counts = Counter((utc_day(r["ts"]), deployment(r.get("model"), deployment_of))
                     for r in inferences if _in_snapshot(r))
    return [{"day": d, "deployment": dep, "calls": n} for (d, dep), n in sorted(counts.items())]


def size_bins(inferences, deployment_of):
    counts = Counter()
    for r in inferences:
        if not _in_snapshot(r):
            continue
        period = period_of(utc_day(r["ts"]))
        dep = deployment(r.get("model"), deployment_of)
        if period and dep in ("local", "cloud"):
            counts[(period, dep, size_bin(int(r.get("input_tokens") or 0)))] += 1
    order = {name: i for i, (name, _, _) in enumerate(PERIODS)}
    keys = sorted(counts, key=lambda k: (order[k[0]], k[1] != "local", BIN_LABELS.index(k[2])))
    return [{"period": p, "deployment": d, "bin": b, "calls": counts[(p, d, b)]} for p, d, b in keys]


def assert_public(obj, path="$"):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k in FORBIDDEN_KEYS:
                raise ValueError(f"forbidden key {k!r} at {path}")
            assert_public(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            assert_public(v, f"{path}[{i}]")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/pdenarie/Developer/Token Economy" && .venv/bin/python -m pytest tests/test_public_export.py -q`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd "/Users/pdenarie/Developer/Token Economy"
git add public_export.py tests/test_public_export.py
git commit -m "feat: add public explorer export core" -- public_export.py tests/test_public_export.py
```

---

### Task 2: Corrected snapshot loading and CLI (Token Economy)

**Files:**
- Modify: `/Users/pdenarie/Developer/Token Economy/public_export.py` (append loaders and `main`)
- Test: `/Users/pdenarie/Developer/Token Economy/tests/test_public_export.py` (append)

**Interfaces:**
- Consumes: Task 1 functions; `patch.load(path)`, `patch.apply(table, rows, spec)` from `patch.py`.
- Produces:
  - `load_patched_inferences(data_dir: str, patches_path: str) -> tuple[list[dict], dict]` (rows, patch stats)
  - `load_deployments(data_dir: str, prices_path: str) -> dict[str, str]`
  - `build_snapshot(data_dir, patches_path, prices_path) -> dict` — the public JSON object (shape below)
  - CLI: `.venv/bin/python public_export.py --out <path>`

Public JSON shape (consumed by Tasks 5–6):

```json
{
  "schema": 1,
  "data_through": "2026-09-09",
  "timezone": "UTC",
  "periods": [{"id": "local_only", "start": "2026-07-09", "end": "2026-07-31"},
              {"id": "hybrid", "start": "2026-08-01", "end": "2026-09-09"}],
  "score": {"formula": "ln(1+agent_depth) + ln(1+prompt_position) + ln(1+tool_calls)",
            "excluded": ["reasoning tokens", "output tokens"]},
  "provenance": {"source_commit": "<sha>", "source_dirty": true,
                 "patches_sha256": "<hex>", "disabled_corrections": 754,
                 "patched_rows": {"applied": 0, "disabled": 0, "orphaned": 0, "bad_column": 0, "bad_type": 0},
                 "generated_at": "<ISO UTC>"},
  "coverage": {"prompts": 0, "scored": 0,
               "by_period_route": [{"period": "hybrid", "route": "mixed", "prompts": 0, "scored": 0}]},
  "daily_calls": [{"day": "2026-07-09", "deployment": "local", "calls": 0}],
  "size_bins": [{"period": "local_only", "deployment": "local", "bin": "<1k", "calls": 0}],
  "prompts": [{"period": "hybrid", "route": "mixed", "input_tokens": 0, "agent_depth": 0,
               "prompt_position": 0, "tool_calls": 0, "subagent_runs": 0, "score": 0.0}]
}
```

`patched_rows` summarizes the stats dict returned by `patch.apply` (`{applied, disabled, orphaned, bad_column, bad_type}`) as counts only: the list-valued entries contain row keys (call timestamps) and must never be exported. Because the parquet store was already patched by the ETL, re-applying is idempotent for overrides; rows disabled by the ETL are already absent, so their keys show up in `orphaned` and `disabled` is 0. That is expected.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_public_export.py`:

```python
import json

import pyarrow as pa
import pyarrow.parquet as pq


def _write(path, rows):
    pq.write_table(pa.Table.from_pylist(rows), path)


@pytest.fixture
def store(tmp_path):
    d = tmp_path / "data"
    d.mkdir()
    _write(d / "inferences.parquet", [
        {"ts": DAY_JUL10, "conv": "a", "model": "qwen", "input_tokens": 100,
         "output_tokens": 5, "iterations": 2, "tool_calls": 3, "reasoning_tokens": 0},
        {"ts": DAY_JUL10 + 1, "conv": "a", "model": "qwen", "input_tokens": 200,
         "output_tokens": 5, "iterations": 2, "tool_calls": 3, "reasoning_tokens": 0},
    ])
    _write(d / "sessions.parquet", [{"ts": DAY_JUL10, "conv": "a", "session_id": "s"}])
    _write(d / "tools.parquet", [{"ts": DAY_JUL10, "conv": "a", "tool_name": "runSubagent"}])
    _write(d / "models.parquet", [{"model": "qwen", "deployment": "cloud"}])
    prices = tmp_path / "prices.json"
    prices.write_text(json.dumps({"models": {}, "_deployment_overrides": {"qwen": "local", "_c": "x"}}))
    patches = tmp_path / "patches.json"
    patches.write_text(json.dumps({"inferences": {
        str(DAY_JUL10): {"input_tokens": 999, "_note": "fix"},
        str(DAY_JUL10 + 1): {"_disabled": True}}}))
    return d, patches, prices


def test_load_applies_corrections(store):
    d, patches, _ = store
    rows, _stats = pe.load_patched_inferences(str(d), str(patches))
    assert [r["input_tokens"] for r in rows] == [999]


def test_load_deployments_applies_overrides(store):
    d, _, prices = store
    assert pe.load_deployments(str(d), str(prices)) == {"qwen": "local"}


def test_build_snapshot_is_public_and_corrected(store):
    d, patches, prices = store
    snap = pe.build_snapshot(str(d), str(patches), str(prices))
    pe.assert_public(snap)
    assert snap["data_through"] == "2026-09-09"
    assert snap["prompts"] == [{"period": "local_only", "route": "local", "input_tokens": 999,
                                "agent_depth": 2, "prompt_position": 1, "tool_calls": 3,
                                "subagent_runs": 1, "score": pe.trajectory_score(2, 1, 3)}]
    assert snap["coverage"]["prompts"] == 1 and snap["coverage"]["scored"] == 1
    assert len(snap["provenance"]["patches_sha256"]) == 64
    assert snap["provenance"]["disabled_corrections"] == 1
    assert "reasoning_tokens" not in json.dumps(snap)


def test_build_snapshot_refuses_non_frozen_store(store):
    d, patches, prices = store
    _write(d / "inferences.parquet", [{"ts": pe.CUTOFF_MS + 1000, "conv": "z", "model": "qwen",
                                       "input_tokens": 1, "iterations": 1, "tool_calls": 1}])
    with pytest.raises(SystemExit, match="not the September 9"):
        pe.build_snapshot(str(d), str(patches), str(prices))
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/pdenarie/Developer/Token Economy" && .venv/bin/python -m pytest tests/test_public_export.py -q`
Expected: FAIL with `AttributeError: module 'public_export' has no attribute 'load_patched_inferences'`

- [ ] **Step 3: Write the implementation**

Add `import argparse, hashlib, json, os, subprocess, sys` and `import pyarrow.parquet as pq`, `import patch` to the imports at the top of `public_export.py`, then append:

```python
BASE = os.path.dirname(os.path.abspath(__file__))


def _rows(data_dir, name):
    return pq.read_table(os.path.join(data_dir, f"{name}.parquet")).to_pylist()


def load_patched_inferences(data_dir, patches_path):
    """Same correction path as serve.py:load_parquets (patch.apply on load)."""
    spec = patch.load(patches_path)
    return patch.apply("inferences", _rows(data_dir, "inferences"), spec.get("inferences"))


def load_deployments(data_dir, prices_path):
    """Same mapping as serve.py:load_settings."""
    with open(prices_path) as f:
        overrides = {k: v for k, v in json.load(f).get("_deployment_overrides", {}).items()
                     if not k.startswith("_")}
    return {r["model"]: overrides.get(r["model"], r["deployment"])
            for r in _rows(data_dir, "models")}


def _sha256(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def _git(*args):
    try:
        return subprocess.run(["git", *args], cwd=BASE, capture_output=True,
                              text=True, check=True).stdout.strip()
    except Exception:
        return None


def _coverage(prompts):
    groups = Counter((p["period"], p["route"]) for p in prompts)
    scored = Counter((p["period"], p["route"]) for p in prompts if p["score"] is not None)
    return {"prompts": len(prompts), "scored": sum(scored.values()),
            "by_period_route": [{"period": p, "route": r, "prompts": n, "scored": scored[(p, r)]}
                                for (p, r), n in sorted(groups.items())]}


def build_snapshot(data_dir, patches_path, prices_path):
    inferences, stats = load_patched_inferences(data_dir, patches_path)
    if max(r["ts"] for r in inferences) >= CUTOFF_MS:
        raise SystemExit("inference store is not the September 9, 2026 snapshot "
                         "(was etl.py rerun?) — refusing to export")
    deployment_of = load_deployments(data_dir, prices_path)
    prompts = build_prompts(inferences, deployment_of,
                            prompt_positions(_rows(data_dir, "sessions")),
                            subagent_runs(_rows(data_dir, "tools")))
    snap = {
        "schema": 1,
        "data_through": DATA_THROUGH,
        "timezone": "UTC",
        "periods": [{"id": n, "start": s, "end": e} for n, s, e in PERIODS],
        "score": {"formula": "ln(1+agent_depth) + ln(1+prompt_position) + ln(1+tool_calls)",
                  "excluded": ["reasoning tokens", "output tokens"]},
        "provenance": {
            "source_commit": _git("rev-parse", "HEAD"),
            "source_dirty": bool(_git("status", "--porcelain")),
            "patches_sha256": _sha256(patches_path),
            "disabled_corrections": sum(1 for v in patch.load(patches_path).get("inferences", {}).values()
                                        if v.get("_disabled") is True),
            "patched_rows": {k: (len(v) if isinstance(v, list) else v) for k, v in stats.items()},
            "generated_at": dt.datetime.now(UTC).replace(microsecond=0).isoformat(),
        },
        "coverage": _coverage(prompts),
        "daily_calls": daily_calls(inferences, deployment_of),
        "size_bins": size_bins(inferences, deployment_of),
        "prompts": prompts,
    }
    assert_public(snap)
    return snap


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", required=True, help="output JSON path")
    ap.add_argument("--data", default=os.path.join(BASE, "data"))
    ap.add_argument("--patches", default=patch.PATCHS_PATH)
    ap.add_argument("--prices", default=os.path.join(BASE, "prices.json"))
    a = ap.parse_args(argv)
    snap = build_snapshot(a.data, a.patches, a.prices)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, "w") as f:
        json.dump(snap, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    c = snap["coverage"]
    print(f"wrote {a.out}: {c['prompts']} prompts ({c['scored']} scored), "
          f"patches {snap['provenance']['patched_rows']}", file=sys.stderr)


if __name__ == "__main__":
    main()
```

The `test_build_snapshot_is_public_and_corrected` test also asserts the counts-only form (add this line to it):

```python
    assert all(isinstance(v, int) for v in snap["provenance"]["patched_rows"].values())
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/pdenarie/Developer/Token Economy" && .venv/bin/python -m pytest -q`
Expected: only `tests/test_complexity.py::test_score_all_zero_weights_is_zero` fails (pre-existing); all `test_public_export.py` tests pass.

- [ ] **Step 5: Commit**

```bash
cd "/Users/pdenarie/Developer/Token Economy"
git add public_export.py tests/test_public_export.py
git commit -m "feat: export corrected Sept 9 snapshot for blog explorer" -- public_export.py tests/test_public_export.py
```

---

### Task 3: Generate and validate the public snapshot

**Files:**
- Create: `/Users/pdenarie/Developer/Personal/Blog_posts/assets/data/local-ai-explorer-2026-09-09.json` (generated)

**Interfaces:**
- Consumes: Task 2 CLI.
- Produces: the JSON file at the path above, used by Tasks 6–7 as `/assets/data/local-ai-explorer-2026-09-09.json`.

- [ ] **Step 1: Generate**

Run:
```bash
cd "/Users/pdenarie/Developer/Token Economy"
.venv/bin/python public_export.py --out "/Users/pdenarie/Developer/Personal/Blog_posts/assets/data/local-ai-explorer-2026-09-09.json"
```
Expected: `wrote …: 976 prompts (953 scored), patches {'applied': 0, 'disabled': 0, 'orphaned': 754, 'bad_column': 0, 'bad_type': 0}`.

- [ ] **Step 2: Check the frozen-period call counts**

Run:
```bash
cd /Users/pdenarie/Developer/Personal/Blog_posts && node -e '
const d = JSON.parse(require("fs").readFileSync("assets/data/local-ai-explorer-2026-09-09.json","utf8"));
const sum = (p, dep) => d.size_bins.filter(x => x.period===p && x.deployment===dep).reduce((s,x)=>s+x.calls,0);
const days = (a, b, dep) => d.daily_calls.filter(x => x.day>=a && x.day<=b && x.deployment===dep).reduce((s,x)=>s+x.calls,0);
console.log({local_only_local: sum("local_only","local"), local_only_cloud: sum("local_only","cloud"),
  local_only_copilot: days("2026-07-09","2026-07-31","copilot"),
  hybrid_local: sum("hybrid","local"), hybrid_cloud: sum("hybrid","cloud"),
  hybrid_copilot: days("2026-08-01","2026-09-09","copilot"), coverage: d.coverage,
  disabled_corrections: d.provenance.disabled_corrections});'
```
Expected: `local_only_local: 1419, local_only_cloud: 0, local_only_copilot: 0, hybrid_local: 1587, hybrid_cloud: 1614, hybrid_copilot: 1961`, coverage `prompts: 976, scored: 953`, `disabled_corrections: 754`. If any value differs, STOP and report the difference to the user; do not adjust code to force the numbers.

- [ ] **Step 3: Privacy check**

Run:
```bash
cd /Users/pdenarie/Developer/Personal/Blog_posts && grep -Eo '"(conv|trace_id|span_id|session_id|response_id|model|ts|_note|reasoning_tokens|output_tokens)"' assets/data/local-ai-explorer-2026-09-09.json | sort | uniq -c; ls -la assets/data/local-ai-explorer-2026-09-09.json
```
Expected: no grep output; file well under 1 MB.

- [ ] **Step 4: Spot-check three prompts against the dashboard**

Start the dashboard (`cd "/Users/pdenarie/Developer/Token Economy" && .venv/bin/python serve.py`, then open it), pick one local, one cloud, and one mixed prompt in the session explorer, and compare initial input tokens, agent iterations, and tool calls with the matching exported prompt (match by period, route, and `input_tokens`). Record the three comparisons in the commit message body. Stop the server afterwards.

- [ ] **Step 5: Commit**

```bash
cd /Users/pdenarie/Developer/Personal/Blog_posts
git add assets/data/local-ai-explorer-2026-09-09.json
git commit -m "data: add corrected Sept 9 local AI explorer snapshot" -- assets/data/local-ai-explorer-2026-09-09.json
```

---

### Task 4: Vendor ECharts in the blog build

**Files:**
- Modify: `/Users/pdenarie/Developer/Personal/Blog_posts/package.json`, `package-lock.json` (via npm)
- Modify: `/Users/pdenarie/Developer/Personal/Blog_posts/src/build.mjs:222-226`
- Test: `/Users/pdenarie/Developer/Personal/Blog_posts/test/build.test.mjs:15-23`

**Interfaces:**
- Produces: `/assets/js/vendor/echarts.esm.min.js` in `dist/` (ES module exporting `init`, `use`, etc.).

- [ ] **Step 1: Write the failing test**

In `test/build.test.mjs`, add `'dist/assets/js/vendor/echarts.esm.min.js',` to the `expect` array after `'dist/assets/js/vendor/three.module.js',`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/pdenarie/Developer/Personal/Blog_posts && node --test test/build.test.mjs`
Expected: FAIL with `ENOENT … echarts.esm.min.js`

- [ ] **Step 3: Install and copy**

Run: `npm install echarts` then `ls node_modules/echarts/dist/echarts.esm.min.js` (must exist; if the installed major version ships it under another name, use `ls node_modules/echarts/dist/*.esm*` and use that ESM file name in the copy below while keeping the destination name).

In `src/build.mjs`, after the three.js copy:

```js
  await cp(join(root, 'node_modules/echarts/dist/echarts.esm.min.js'),
    join(dist, 'assets', 'js', 'vendor', 'echarts.esm.min.js'));
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/build.mjs test/build.test.mjs
git commit -m "build: vendor ECharts for interactive figures" -- package.json package-lock.json src/build.mjs test/build.test.mjs
```

---

### Task 5: Explorer data model (pure functions)

**Files:**
- Create: `/Users/pdenarie/Developer/Personal/Blog_posts/assets/js/local-ai-explorer/model.js`
- Test: `/Users/pdenarie/Developer/Personal/Blog_posts/test/local-ai-explorer.test.mjs`

**Interfaces:**
- Consumes: Task 2 JSON shape.
- Produces (ES module, no DOM):
  - `ROUTES = ['local','cloud','mixed']`, `COLORS`, `BIN_LABELS`
  - `filterPrompts(prompts, {period='all', routes=ROUTES}) -> prompt[]`
  - `dailySeries(dailyCalls) -> {days: string[], series: {name, data: number[]}[]}`
  - `sizeBinSeries(sizeBins, {period='all'}) -> {bins, series: {name, data}[]}`
  - `scatterSeries(prompts, {period, routes}) -> {name, data: {value:[x,y], prompt}[]}[]`
  - `tooltipLines(prompt) -> string[]`
  - `coverageText(coverage) -> string`

- [ ] **Step 1: Write the failing tests**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROUTES, filterPrompts, dailySeries, sizeBinSeries, scatterSeries, tooltipLines, coverageText,
} from '../assets/js/local-ai-explorer/model.js';

const P = (o) => ({ period: 'hybrid', route: 'local', input_tokens: 10, agent_depth: 1,
  prompt_position: 1, tool_calls: 0, subagent_runs: 0, score: 1.5, ...o });

test('filterPrompts by period and route', () => {
  const ps = [P({}), P({ period: 'local_only' }), P({ route: 'mixed' })];
  assert.equal(filterPrompts(ps).length, 3);
  assert.equal(filterPrompts(ps, { period: 'local_only' }).length, 1);
  assert.deepEqual(filterPrompts(ps, { routes: ['mixed'] }).map((p) => p.route), ['mixed']);
  assert.deepEqual(ROUTES, ['local', 'cloud', 'mixed']);
});

test('dailySeries fills missing days with zero and orders deployments', () => {
  const r = dailySeries([
    { day: '2026-07-10', deployment: 'cloud', calls: 2 },
    { day: '2026-07-09', deployment: 'local', calls: 5 },
  ]);
  assert.deepEqual(r.days, ['2026-07-09', '2026-07-10']);
  assert.deepEqual(r.series, [
    { name: 'local', data: [5, 0] },
    { name: 'cloud', data: [0, 2] },
  ]);
});

test('sizeBinSeries sums periods when period is all', () => {
  const bins = [
    { period: 'local_only', deployment: 'local', bin: '<1k', calls: 1 },
    { period: 'hybrid', deployment: 'local', bin: '<1k', calls: 2 },
    { period: 'hybrid', deployment: 'cloud', bin: '100k+', calls: 4 },
  ];
  assert.deepEqual(sizeBinSeries(bins).series, [
    { name: 'local', data: [3, 0, 0, 0] },
    { name: 'cloud', data: [0, 0, 0, 4] },
  ]);
  assert.deepEqual(sizeBinSeries(bins, { period: 'local_only' }).series[0].data, [1, 0, 0, 0]);
});

test('scatterSeries drops unscored prompts and clamps x for the log axis', () => {
  const s = scatterSeries([P({ input_tokens: 0 }), P({ score: null }), P({ route: 'cloud' })], {});
  assert.deepEqual(s.map((x) => x.name), ['local', 'cloud', 'mixed']);
  assert.deepEqual(s[0].data.map((d) => d.value), [[1, 1.5]]);
  assert.equal(s[1].data.length, 1);
  assert.equal(s[2].data.length, 0);
});

test('tooltipLines lists raw components and never reasoning tokens', () => {
  const lines = tooltipLines(P({ input_tokens: 12345, agent_depth: 7, prompt_position: 3,
    tool_calls: 9, subagent_runs: 1, score: 6.789 }));
  assert.deepEqual(lines, [
    '12,345 initial input tokens', 'Trajectory score 6.79', 'Agent depth 7',
    'Prompt 3 in its chat session', '9 linked tool calls', '1 subagent run',
  ]);
  assert.ok(!lines.join(' ').toLowerCase().includes('reasoning'));
});

test('coverageText', () => {
  assert.equal(coverageText({ prompts: 1479, scored: 1400 }),
    '1,400 of 1,479 prompts have every score component.');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/local-ai-explorer.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: Write the implementation**

```js
// model.js — pure data shaping for the local-ai-explorer figure (no DOM).
export const ROUTES = ['local', 'cloud', 'mixed'];
export const DEPLOYMENTS = ['local', 'cloud', 'copilot', 'other'];
export const BIN_LABELS = ['<1k', '1–10k', '10–100k', '100k+'];
export const COLORS = {
  local: '#3ddc97', cloud: '#ff7a66', mixed: '#f5c542', copilot: '#c792ea', other: '#8a94ab',
};

const fmt = (n) => n.toLocaleString('en-US');
const inPeriod = (period) => (x) => period === 'all' || x.period === period;

export function filterPrompts(prompts, { period = 'all', routes = ROUTES } = {}) {
  return prompts.filter((p) => inPeriod(period)(p) && routes.includes(p.route));
}

export function dailySeries(dailyCalls) {
  const days = [...new Set(dailyCalls.map((d) => d.day))].sort();
  const index = new Map(dailyCalls.map((d) => [`${d.day}|${d.deployment}`, d.calls]));
  const present = DEPLOYMENTS.filter((dep) => dailyCalls.some((d) => d.deployment === dep));
  return {
    days,
    series: present.map((name) => ({ name, data: days.map((day) => index.get(`${day}|${name}`) ?? 0) })),
  };
}

export function sizeBinSeries(sizeBins, { period = 'all' } = {}) {
  const rows = sizeBins.filter(inPeriod(period));
  return {
    bins: BIN_LABELS,
    series: ['local', 'cloud'].map((name) => ({
      name,
      data: BIN_LABELS.map((bin) => rows
        .filter((r) => r.deployment === name && r.bin === bin)
        .reduce((s, r) => s + r.calls, 0)),
    })),
  };
}

export function scatterSeries(prompts, { period = 'all', routes = ROUTES } = {}) {
  const kept = filterPrompts(prompts, { period, routes }).filter((p) => p.score !== null);
  return ROUTES.filter((r) => routes.includes(r)).map((name) => ({
    name,
    // log x-axis cannot show 0 tokens
    data: kept.filter((p) => p.route === name)
      .map((p) => ({ value: [Math.max(1, p.input_tokens), p.score], prompt: p })),
  }));
}

export function tooltipLines(p) {
  return [
    `${fmt(p.input_tokens)} initial input tokens`,
    `Trajectory score ${p.score.toFixed(2)}`,
    `Agent depth ${p.agent_depth}`,
    `Prompt ${p.prompt_position} in its chat session`,
    `${fmt(p.tool_calls)} linked tool call${p.tool_calls === 1 ? '' : 's'}`,
    `${p.subagent_runs} subagent run${p.subagent_runs === 1 ? '' : 's'}`,
  ];
}

export function coverageText({ prompts, scored }) {
  return `${fmt(scored)} of ${fmt(prompts)} prompts have every score component.`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/local-ai-explorer.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add assets/js/local-ai-explorer/model.js test/local-ai-explorer.test.mjs
git commit -m "feat: add local AI explorer data model" -- assets/js/local-ai-explorer/model.js test/local-ai-explorer.test.mjs
```

---

### Task 6: Explorer figure UI

**Files:**
- Create: `/Users/pdenarie/Developer/Personal/Blog_posts/assets/js/local-ai-explorer/explorer.js`
- Modify: `/Users/pdenarie/Developer/Personal/Blog_posts/assets/js/figures.js` (register type before `function initAll()`)
- Modify: `/Users/pdenarie/Developer/Personal/Blog_posts/assets/css/main.css` (after the `.fig canvas` rule, ~line 306)
- Test: `/Users/pdenarie/Developer/Personal/Blog_posts/test/local-ai-explorer.test.mjs` (append build assertions)

**Interfaces:**
- Consumes: Task 4 vendor path `/assets/js/vendor/echarts.esm.min.js`; Task 5 model exports; Task 3 JSON URL.
- Produces: figure type `local-ai-explorer`, config `{"src": "/assets/data/local-ai-explorer-2026-09-09.json", "view": "daily" | "sizes" | "trajectory"}`; `mountLocalAiExplorer(el, cfg) -> Promise<void>`.

- [ ] **Step 1: Write the failing build test**

Append to `test/local-ai-explorer.test.mjs`:

```js
import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');

test('build ships explorer module, data snapshot, and figure registration', async () => {
  await new Promise((res, rej) => execFile('node', ['src/build.mjs'], { cwd: root },
    (e) => (e ? rej(e) : res())));
  await access(join(root, 'dist/assets/js/local-ai-explorer/explorer.js'));
  await access(join(root, 'dist/assets/data/local-ai-explorer-2026-09-09.json'));
  const figures = await readFile(join(root, 'dist/assets/js/figures.js'), 'utf8');
  assert.match(figures, /registerFigure\('local-ai-explorer'/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/local-ai-explorer.test.mjs`
Expected: FAIL with `ENOENT … explorer.js`

- [ ] **Step 3: Implement the figure**

In `assets/js/figures.js`, before `function initAll()`:

```js
// --- local-ai-explorer: Token Economy snapshot charts (ECharts, lazy) ---
registerFigure('local-ai-explorer', async (el, cfg = {}) => {
  const { mountLocalAiExplorer } = await import('/assets/js/local-ai-explorer/explorer.js');
  await mountLocalAiExplorer(el, cfg);
});
```

Create `assets/js/local-ai-explorer/explorer.js`:

```js
// explorer.js — DOM + ECharts wiring for the local-ai-explorer figure.
import {
  ROUTES, COLORS, filterPrompts, dailySeries, sizeBinSeries, scatterSeries, tooltipLines, coverageText,
} from './model.js';

const VIEWS = [
  ['daily', 'Daily model calls'],
  ['sizes', 'Prompt sizes'],
  ['trajectory', 'Prompt size vs trajectory'],
];
const PERIODS = [['all', 'Both periods'], ['local_only', 'Local only (Jul 9–31)'], ['hybrid', 'Hybrid (Aug 1–Sep 9)']];
const PERIOD_MARKS = [['2026-07-09', '2026-07-31', 'Local only'], ['2026-08-01', '2026-09-09', 'Hybrid']];

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function theme() {
  return { text: css('--text-muted') || '#9aa3b2', grid: css('--border') || '#2a3140' };
}

function axis(t, extra = {}) {
  return { axisLabel: { color: t.text }, axisLine: { lineStyle: { color: t.grid } },
    splitLine: { lineStyle: { color: t.grid } }, nameTextStyle: { color: t.text }, ...extra };
}

function dailyOption(data, t) {
  const { days, series } = dailySeries(data.daily_calls);
  return {
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: t.text }, top: 0 },
    grid: { left: 48, right: 16, top: 36, bottom: 40 },
    xAxis: axis(t, { type: 'category', data: days }),
    yAxis: axis(t, { type: 'value', name: 'inference calls' }),
    series: series.map((s, i) => ({
      ...s, type: 'bar', stack: 'calls', itemStyle: { color: COLORS[s.name] },
      ...(i === 0 ? { markArea: {
        itemStyle: { color: 'rgba(255,255,255,0.04)' },
        label: { color: t.text },
        data: PERIOD_MARKS.map(([a, b, name]) => [{ name, xAxis: a }, { xAxis: b }]),
      } } : {}),
    })),
  };
}

function sizesOption(data, state, t) {
  const { bins, series } = sizeBinSeries(data.size_bins, state);
  return {
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: t.text }, top: 0 },
    grid: { left: 56, right: 16, top: 36, bottom: 40 },
    xAxis: axis(t, { type: 'category', data: bins, name: 'input tokens per call', nameLocation: 'middle', nameGap: 28 }),
    yAxis: axis(t, { type: 'log', name: 'inference calls' }),
    series: series.map((s) => ({ ...s, type: 'bar', itemStyle: { color: COLORS[s.name] } })),
  };
}

function trajectoryOption(data, state, t) {
  return {
    tooltip: { trigger: 'item', formatter: (p) => tooltipLines(p.data.prompt).join('<br>') },
    legend: { textStyle: { color: t.text }, top: 0 },
    grid: { left: 56, right: 16, top: 36, bottom: 48 },
    xAxis: axis(t, { type: 'log', name: 'initial prompt input tokens', nameLocation: 'middle', nameGap: 30 }),
    yAxis: axis(t, { type: 'value', name: 'trajectory score' }),
    series: scatterSeries(data.prompts, state).map((s) => ({
      ...s, type: 'scatter', symbolSize: 7, itemStyle: { color: COLORS[s.name], opacity: 0.7 },
    })),
  };
}

function el(tag, attrs = {}, text = '') {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  if (text) node.textContent = text;
  return node;
}

export async function mountLocalAiExplorer(root, cfg = {}) {
  const [echarts, data] = await Promise.all([
    import('/assets/js/vendor/echarts.esm.min.js'),
    fetch(cfg.src).then((r) => {
      if (!r.ok) throw new Error(`explorer data ${r.status}`);
      return r.json();
    }),
  ]);
  const routes = ROUTES.filter((r) => data.prompts.some((p) => p.route === r));
  const initial = { view: cfg.view || 'daily', period: 'all', routes: [...routes] };
  const state = structuredClone(initial);

  root.classList.add('fig--explorer');
  root.replaceChildren();
  const controls = el('div', { class: 'explorer-controls', role: 'group', 'aria-label': 'Explorer controls' });
  const viewButtons = VIEWS.map(([id, label]) => {
    const b = el('button', { type: 'button', 'data-view': id }, label);
    b.addEventListener('click', () => { state.view = id; render(); });
    return b;
  });
  const period = el('select', { 'aria-label': 'Period' });
  PERIODS.forEach(([id, label]) => period.append(el('option', { value: id }, label)));
  period.addEventListener('change', () => { state.period = period.value; render(); });
  const routeBoxes = routes.map((r) => {
    const label = el('label', { class: 'explorer-route' });
    const box = el('input', { type: 'checkbox', value: r });
    box.checked = true;
    box.addEventListener('change', () => {
      state.routes = routeBoxes.filter(([, b]) => b.checked).map(([id]) => id);
      render();
    });
    label.append(box, ` ${r}`);
    return [r, box, label];
  });
  const reset = el('button', { type: 'button', class: 'explorer-reset' }, 'Reset');
  reset.addEventListener('click', () => {
    Object.assign(state, structuredClone(initial));
    period.value = 'all';
    routeBoxes.forEach(([, b]) => { b.checked = true; });
    render();
  });
  const routesGroup = el('span', { class: 'explorer-routes' });
  routesGroup.append(...routeBoxes.map(([, , l]) => l));
  controls.append(...viewButtons, period, routesGroup, reset);

  const chartEl = el('div', { class: 'explorer-chart' });
  const note = el('p', { class: 'explorer-note' });
  root.append(controls, chartEl, note);

  const chart = echarts.init(chartEl, null, { renderer: 'canvas' });
  new ResizeObserver(() => chart.resize()).observe(chartEl);

  function render() {
    const t = theme();
    viewButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    period.disabled = state.view === 'daily';
    routesGroup.hidden = state.view !== 'trajectory';
    const option = state.view === 'daily' ? dailyOption(data, t)
      : state.view === 'sizes' ? sizesOption(data, state, t)
        : trajectoryOption(data, state, t);
    chart.setOption(option, true);
    const shown = state.view === 'trajectory'
      ? ` Showing ${filterPrompts(data.prompts, state).filter((p) => p.score !== null).length} prompts.` : '';
    note.textContent = `Data through ${data.data_through} (UTC days), with manual corrections applied. `
      + '“copilot” is Copilot’s built-in helper model, not a chosen coding model. '
      + `Score = ${data.score.formula}; reasoning and output tokens are excluded. `
      + `Agent depth is a lower bound for very long runs; tool calls are linked heuristically; `
      + `nested subagent depth is not recorded. ${coverageText(data.coverage)}${shown} `
      + 'Counts show usage, not productivity or code quality.';
  }
  render();
}
```

In `assets/css/main.css`, after `.fig canvas { … }`:

```css
.fig.fig--explorer { height: auto; overflow: visible; padding: 16px; }
.explorer-controls { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; margin-bottom: 12px; font-size: 0.85rem; }
.explorer-controls button, .explorer-controls select { font: inherit; color: var(--text); background: transparent;
  border: 1px solid var(--border); border-radius: var(--radius); padding: 4px 10px; cursor: pointer; }
.explorer-controls button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); }
.explorer-controls select:disabled { opacity: 0.4; cursor: default; }
.explorer-routes { display: inline-flex; gap: 10px; }
.explorer-chart { width: 100%; height: 380px; }
.explorer-note { margin: 12px 0 0; color: var(--text-muted); font-size: 0.8rem; line-height: 1.5; }
@media (min-width: 1100px) { .fig.fig--explorer { width: min(1040px, 92vw); margin-left: 50%; transform: translateX(-50%); } }
```

Before finishing this step, confirm `--text`, `--text-muted`, `--border`, `--accent`, `--radius` exist in `main.css` (`grep -n -- '--text-muted\|--accent:' assets/css/main.css`); substitute the existing variable names if any differ.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Verify in the browser**

```bash
cat > content/posts/zz-explorer-preview.md <<'EOF'
---
title: "Explorer preview"
date: 2026-11-10
---
<div class="fig" data-figure="local-ai-explorer" data-config='{"src":"/assets/data/local-ai-explorer-2026-09-09.json"}'></div>
EOF
npm run dev
```
Open `http://localhost:4173/posts/zz-explorer-preview.html` with the browser tools. Check: all three views render; the daily view shows the two shaded periods; the period selector changes the sizes and trajectory views; unticking a route removes its points; Reset restores defaults; scatter tooltips show the six lines from `tooltipLines`; no console errors; layout works at a 390 px wide viewport. Then stop the dev server and run `rm content/posts/zz-explorer-preview.md`.

- [ ] **Step 6: Commit**

```bash
git add assets/js/local-ai-explorer/explorer.js assets/js/figures.js assets/css/main.css test/local-ai-explorer.test.mjs
git commit -m "feat: add local AI explorer figure" -- assets/js/local-ai-explorer/explorer.js assets/js/figures.js assets/css/main.css test/local-ai-explorer.test.mjs
```

---

### Task 6b: Per-call trajectory points in the export (Token Economy + snapshot)

Added after user review on 2026-11-10: the trajectory view must match the deck's two stacked log-log panels with **one point per inference call** (x = that call's input tokens, y = its prompt's trajectory score), colored local / cloud / copilot (copilot shown by default). Per-call is required: hybrid cloud calls have median ≈84k input tokens (648 ≥100k) vs local ≈33k (40 ≥100k); per-prompt initial size hides this.

**Files:**
- Modify: `/Users/pdenarie/Developer/Token Economy/public_export.py`
- Test: `/Users/pdenarie/Developer/Token Economy/tests/test_public_export.py`
- Regenerate: `/Users/pdenarie/Developer/Personal/Blog_posts/assets/data/local-ai-explorer-2026-09-09.json`

**Interfaces:**
- Produces:
  - `prompts_by_conv(inferences, deployment_of, positions, subagents) -> dict[str, dict]` (same prompt dicts as `build_prompts`, keyed by conv); `build_prompts` becomes a thin wrapper (unchanged output and tests).
  - `CALL_FIELDS = ("period", "deployment", "input_tokens", "prompt")`
  - `build_calls(inferences, deployment_of, prompt_index: dict[str, int], prompts: list[dict]) -> tuple[list[list], dict]` — rows `[period, deployment, input_tokens, prompt_idx]` for calls in a period with deployment local/cloud/copilot, `input_tokens > 0`, and a prompt whose score is not None; returns `(rows, {"plotted": n, "zero_tokens": z, "no_score": m})`.
  - Snapshot gains `"call_fields": ["period","deployment","input_tokens","prompt"]`, `"calls": [...]`, and `coverage.calls = {plotted, zero_tokens, no_score}`. `prompt` is an index into `prompts` (no identifiers).

- [ ] **Step 1: Write the failing tests** (append to `tests/test_public_export.py`)

```python
def test_build_calls_rows_and_omissions():
    prompts = [{"score": 2.0}, {"score": None}]
    index = {"a": 0, "b": 1}
    inf = [
        {"conv": "a", "ts": DAY_AUG02, "model": "claude", "input_tokens": 90000},
        {"conv": "a", "ts": DAY_AUG02 + 1, "model": "gpt-4o-mini", "input_tokens": 1600},
        {"conv": "a", "ts": DAY_JUL10, "model": "qwen", "input_tokens": 0},          # zero tokens
        {"conv": "b", "ts": DAY_JUL10, "model": "qwen", "input_tokens": 500},        # prompt unscored
        {"conv": "z", "ts": DAY_AUG02, "model": "gpt-4o-mini", "input_tokens": 1700},  # no prompt
        {"conv": "a", "ts": DAY_JUN20, "model": "qwen", "input_tokens": 10},         # outside periods
        {"conv": "a", "ts": DAY_AUG02, "model": "unknown", "input_tokens": 10},      # other deployment
        {"conv": "a", "ts": pe.CUTOFF_MS, "model": "qwen", "input_tokens": 10},      # after cutoff
    ]
    rows, cov = pe.build_calls(inf, DEP, index, prompts)
    assert rows == [["hybrid", "cloud", 90000, 0], ["hybrid", "copilot", 1600, 0]]
    assert cov == {"plotted": 2, "zero_tokens": 1, "no_score": 2}


def test_snapshot_includes_calls(store):
    d, patches, prices = store
    snap = pe.build_snapshot(str(d), str(patches), str(prices))
    assert snap["call_fields"] == ["period", "deployment", "input_tokens", "prompt"]
    assert snap["calls"] == [["local_only", "local", 999, 0]]
    assert snap["coverage"]["calls"] == {"plotted": 1, "zero_tokens": 0, "no_score": 0}
```

- [ ] **Step 2: Run to verify failure**

Run: `cd "/Users/pdenarie/Developer/Token Economy" && .venv/bin/python -m pytest tests/test_public_export.py -q`
Expected: the two new tests FAIL (`AttributeError: … 'build_calls'` and `KeyError: 'call_fields'`).

- [ ] **Step 3: Implement**

Rename the body of `build_prompts` into `prompts_by_conv`, returning `{conv: prompt_dict}` instead of a sorted list (same filtering and fields), and redefine:

```python
def _prompt_sort_key(p):
    return (p["period"], p["route"], p["input_tokens"])


def build_prompts(inferences, deployment_of, positions, subagents):
    return sorted(prompts_by_conv(inferences, deployment_of, positions, subagents).values(),
                  key=_prompt_sort_key)


CALL_FIELDS = ("period", "deployment", "input_tokens", "prompt")


def build_calls(inferences, deployment_of, prompt_index, prompts):
    rows, omitted = [], Counter()
    for r in inferences:
        if not _in_snapshot(r):
            continue
        period = period_of(utc_day(r["ts"]))
        dep = deployment(r.get("model"), deployment_of)
        if period is None or dep == "other":
            continue
        tokens = int(r.get("input_tokens") or 0)
        i = prompt_index.get(r.get("conv"))
        if tokens <= 0:
            omitted["zero_tokens"] += 1
        elif i is None or prompts[i]["score"] is None:
            omitted["no_score"] += 1
        else:
            rows.append([period, dep, tokens, i])
    rows.sort(key=lambda c: (c[0] != "local_only", DEPLOYMENTS.index(c[1]), c[2], c[3]))
    return rows, {"plotted": len(rows), "zero_tokens": omitted["zero_tokens"],
                  "no_score": omitted["no_score"]}
```

In `build_snapshot`, replace the `prompts = build_prompts(...)` line with:

```python
    by_conv = prompts_by_conv(inferences, deployment_of,
                              prompt_positions(_rows(data_dir, "sessions")),
                              subagent_runs(_rows(data_dir, "tools")))
    convs = sorted(by_conv, key=lambda c: _prompt_sort_key(by_conv[c]))
    prompts = [by_conv[c] for c in convs]
    calls, call_coverage = build_calls(inferences, deployment_of,
                                       {c: i for i, c in enumerate(convs)}, prompts)
```

and add to the snapshot dict `"call_fields": list(CALL_FIELDS)` and `"calls": calls` (after `"prompts"`), and set `snap["coverage"]["calls"] = call_coverage` before `assert_public(snap)`. Extend the CLI's stderr summary with `, {call_coverage['plotted']} call points`.

- [ ] **Step 4: Run tests**

Run: `.venv/bin/python -m pytest -q`
Expected: only the pre-existing `test_score_all_zero_weights_is_zero` fails.

- [ ] **Step 5: Regenerate and check the snapshot**

```bash
cd "/Users/pdenarie/Developer/Token Economy"
.venv/bin/python public_export.py --out "/Users/pdenarie/Developer/Personal/Blog_posts/assets/data/local-ai-explorer-2026-09-09.json"
cd /Users/pdenarie/Developer/Personal/Blog_posts && node -e '
const d = JSON.parse(require("fs").readFileSync("assets/data/local-ai-explorer-2026-09-09.json","utf8"));
const k = {}; d.calls.forEach(([p, dep]) => { k[p+"/"+dep] = (k[p+"/"+dep]||0) + 1; });
console.log(k, d.coverage.calls, d.coverage.prompts, d.coverage.scored, require("fs").statSync("assets/data/local-ai-explorer-2026-09-09.json").size);'
```
Expected: `local_only/local 1254, hybrid/local 1566, hybrid/cloud 1611, hybrid/copilot 1857`; `coverage.calls = {plotted: 6288, zero_tokens: 44, no_score: 249}`; prompts 976 / scored 953 unchanged; file under 600 KB. Re-run the Task 3 Step 2 counts and Step 3 privacy grep; all values must be unchanged. If anything differs, STOP and report.

- [ ] **Step 6: Commit (both repositories, explicit paths, Copilot trailer)**

```bash
cd "/Users/pdenarie/Developer/Token Economy" && git add public_export.py tests/test_public_export.py && git commit -m "feat: export per-call trajectory points" -- public_export.py tests/test_public_export.py
cd /Users/pdenarie/Developer/Personal/Blog_posts && git add assets/data/local-ai-explorer-2026-09-09.json && git commit -m "data: add per-call trajectory points to explorer snapshot" -- assets/data/local-ai-explorer-2026-09-09.json
```

---

### Task 6c: Two-panel per-call trajectory view (blog)

**Files:**
- Modify: `/Users/pdenarie/Developer/Personal/Blog_posts/assets/js/local-ai-explorer/model.js`
- Modify: `/Users/pdenarie/Developer/Personal/Blog_posts/assets/js/local-ai-explorer/explorer.js`
- Modify: `/Users/pdenarie/Developer/Personal/Blog_posts/assets/css/main.css` (only if the taller trajectory chart needs a rule)
- Test: `/Users/pdenarie/Developer/Personal/Blog_posts/test/local-ai-explorer.test.mjs`

**Interfaces:**
- Consumes: Task 6b snapshot fields `calls` (`[period, deployment, input_tokens, promptIdx]`), `prompts`, `coverage.calls`.
- Produces (model.js; replace and delete the per-prompt scatter helpers `scatterSeries`, `unplottedCount`, `filterPrompts`, `ROUTES` and their tests, which become unused):
  - `CALL_DEPLOYMENTS = ['local', 'cloud', 'copilot']`
  - `PANELS = [['local_only', 'Local only · Jul 9–31, 2026'], ['hybrid', 'Hybrid · Aug 1–Sep 9, 2026']]`
  - `callPoints(data) -> { local_only: {local: pt[], cloud: pt[], copilot: pt[]}, hybrid: {…} }` with `pt = { value: [tokens, score], tokens, prompt }`
  - `logRange(values, base = 10) -> { min, max }` (powers of `base` bracketing the values)
  - `callTooltipLines(tokens, prompt) -> string[]`
  - `callCoverageText({ plotted, zero_tokens, no_score }) -> string`

- [ ] **Step 1: Write the failing tests** (replace the `filterPrompts`, `scatterSeries`, `unplottedCount`, and `tooltipLines` tests; keep `dailySeries`, `sizeBinSeries`, `coverageText`, and the build test)

```js
import { callPoints, logRange, callTooltipLines, callCoverageText, PANELS, CALL_DEPLOYMENTS } from '../assets/js/local-ai-explorer/model.js';

const PR = (o) => ({ period: 'hybrid', route: 'local', input_tokens: 10, agent_depth: 2,
  prompt_position: 3, tool_calls: 4, subagent_runs: 1, score: 3.5, ...o });

test('callPoints groups calls by panel and deployment with prompt score as y', () => {
  const data = { prompts: [PR({}), PR({ score: 6 })],
    calls: [['hybrid', 'cloud', 90000, 1], ['local_only', 'local', 300, 0], ['hybrid', 'copilot', 1600, 0]] };
  const pts = callPoints(data);
  assert.deepEqual(Object.keys(pts), PANELS.map(([p]) => p));
  assert.deepEqual(Object.keys(pts.hybrid), CALL_DEPLOYMENTS);
  assert.deepEqual(pts.hybrid.cloud.map((p) => p.value), [[90000, 6]]);
  assert.deepEqual(pts.local_only.local.map((p) => p.value), [[300, 3.5]]);
  assert.equal(pts.hybrid.copilot[0].prompt, data.prompts[0]);
  assert.deepEqual(pts.local_only.cloud, []);
});

test('logRange brackets values with powers of the base', () => {
  assert.deepEqual(logRange([250, 380000]), { min: 100, max: 1000000 });
  assert.deepEqual(logRange([1.39, 11.2], 2), { min: 1, max: 16 });
});

test('callTooltipLines describes the call and its prompt, never reasoning tokens', () => {
  const lines = callTooltipLines(12345, PR({ score: 6.789, tool_calls: 1, subagent_runs: 0 }));
  assert.deepEqual(lines, [
    '12,345 input tokens in this call', 'Prompt trajectory score 6.79', 'Agent depth 2',
    'Prompt 3 in its chat session', '1 linked tool call', '0 subagent runs',
  ]);
  assert.ok(!lines.join(' ').toLowerCase().includes('reasoning'));
});

test('callCoverageText', () => {
  assert.equal(callCoverageText({ plotted: 6288, zero_tokens: 44, no_score: 249 }),
    '6,288 calls plotted; 44 without recorded input tokens and 249 without a scored prompt are omitted.');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/local-ai-explorer.test.mjs`
Expected: FAIL (`does not provide an export named 'callPoints'`).

- [ ] **Step 3: Implement model.js additions**

```js
export const CALL_DEPLOYMENTS = ['local', 'cloud', 'copilot'];
export const PANELS = [['local_only', 'Local only · Jul 9–31, 2026'], ['hybrid', 'Hybrid · Aug 1–Sep 9, 2026']];

export function callPoints(data) {
  const out = Object.fromEntries(PANELS.map(([p]) => [p, Object.fromEntries(CALL_DEPLOYMENTS.map((d) => [d, []]))]));
  for (const [period, deployment, tokens, promptIdx] of data.calls) {
    const prompt = data.prompts[promptIdx];
    out[period][deployment].push({ value: [tokens, prompt.score], tokens, prompt });
  }
  return out;
}

export function logRange(values, base = 10) {
  const log = (v) => Math.log(v) / Math.log(base);
  let lo = Infinity; let hi = -Infinity;
  for (const v of values) { if (v < lo) lo = v; if (v > hi) hi = v; }
  return { min: base ** Math.floor(log(lo)), max: base ** Math.ceil(log(hi)) };
}

export function callTooltipLines(tokens, p) {
  return [
    `${fmt(tokens)} input tokens in this call`,
    `Prompt trajectory score ${p.score.toFixed(2)}`,
    `Agent depth ${p.agent_depth}`,
    `Prompt ${p.prompt_position} in its chat session`,
    `${fmt(p.tool_calls)} linked tool call${p.tool_calls === 1 ? '' : 's'}`,
    `${p.subagent_runs} subagent run${p.subagent_runs === 1 ? '' : 's'}`,
  ];
}

export function callCoverageText({ plotted, zero_tokens: zero, no_score: noScore }) {
  return `${fmt(plotted)} calls plotted; ${fmt(zero)} without recorded input tokens and `
    + `${fmt(noScore)} without a scored prompt are omitted.`;
}
```

Remove `ROUTES`, `filterPrompts`, `scatterSeries`, `unplottedCount`, and `tooltipLines` if nothing else uses them after Step 4.

- [ ] **Step 4: Implement the two-panel view in explorer.js**

Replace `trajectoryOption` with a two-grid option and drop the route checkboxes (deployment toggling uses the ECharts legend: series in both panels share names, so one legend click toggles a deployment in both panels).

```js
function trajectoryOption(data, t, points, xRange, yRange) {
  const grids = [{ left: 64, right: 24, top: 56, height: '36%' }, { left: 64, right: 24, top: '58%', height: '36%' }];
  return {
    aria: { enabled: true },
    tooltip: { trigger: 'item', formatter: (p) => callTooltipLines(p.data.tokens, p.data.prompt).join('<br>') },
    legend: { textStyle: { color: t.text }, top: 0, data: CALL_DEPLOYMENTS },
    title: PANELS.map(([, label], i) => ({ text: label, left: 'center', top: i === 0 ? 30 : '53%',
      textStyle: { color: t.text, fontSize: 13, fontWeight: 'normal' } })),
    grid: grids,
    xAxis: grids.map((_, i) => axis(t, { type: 'log', gridIndex: i, ...xRange,
      ...(i === 1 ? { name: 'input tokens per call', nameLocation: 'middle', nameGap: 28 } : {}) })),
    yAxis: grids.map((_, i) => axis(t, { type: 'log', logBase: 2, gridIndex: i, ...yRange, name: 'trajectory score' })),
    series: PANELS.flatMap(([period], i) => CALL_DEPLOYMENTS.map((dep) => ({
      name: dep, type: 'scatter', xAxisIndex: i, yAxisIndex: i, symbolSize: 5,
      itemStyle: { color: COLORS[dep], opacity: 0.6 }, data: points[period][dep],
    }))),
  };
}
```

In `mountLocalAiExplorer`: compute once after loading data
`const points = callPoints(data); const all = Object.values(points).flatMap((byDep) => Object.values(byDep).flat()); const xRange = logRange(all.map((p) => p.tokens)); const yRange = logRange(all.map((p) => p.value[1]), 2);`.
In `render()`: for the trajectory view set `chartEl.style.height = '640px'` (otherwise `''`, falling back to the CSS 380px) and call `chart.resize()` before `setOption`; disable the period select for both the daily and trajectory views; build the note's trajectory sentence from `callCoverageText(data.coverage.calls)` (replacing the "Showing N prompts…" text). Keep everything else from fix round 1 (period shading, error path, aria, theme observer).

- [ ] **Step 5: Run tests and build**

Run: `node --test test/local-ai-explorer.test.mjs && npm test && npm run build && node --check dist/assets/js/local-ai-explorer/explorer.js`
Expected: all pass (2 Docker tests skip locally).

- [ ] **Step 6: Commit**

```bash
git add assets/js/local-ai-explorer/model.js assets/js/local-ai-explorer/explorer.js assets/css/main.css test/local-ai-explorer.test.mjs
git commit -m "feat: two-panel per-call trajectory view" -- assets/js/local-ai-explorer/model.js assets/js/local-ai-explorer/explorer.js assets/css/main.css test/local-ai-explorer.test.mjs
```

Controller then verifies in the browser (ruling R2) that the two panels share axes and show the deck's pattern: local-only calls clustered at 10k–100k, and hybrid cloud calls shifted right of local.

---

### Task 7: Draft post with explorer and download callout

**Files:**
- Create: `/Users/pdenarie/Developer/Personal/Blog_posts/content/drafts/2026-11-local-ai-hybrid-workflow.md`

**Interfaces:**
- Consumes: figure type and data URL (Task 6); download `/assets/downloads/pi-harness-spec-orchestrator-v9.zip` (already in `assets/downloads/`).

- [ ] **Step 1: Write the draft**

```markdown
---
title: "I tried replacing cloud AI with local models. The useful result was a hybrid workflow."
date: 2026-11-10
description: "Three weeks of local-only AI coding, the usage data, and the spec-driven workflow that stayed."
tags: [local-ai, agents, workflow]
---

## The bet

## Three weeks without cloud AI

## Running a model means running a stack

## The model-size sweet spot

## What the usage data shows

<div class="fig" data-figure="local-ai-explorer" data-config='{"src":"/assets/data/local-ai-explorer-2026-09-09.json","view":"daily"}'></div>

## Where local helped, and where it struggled

## The workflow that stayed

## The agent behind the workflow

**Download the [Pi Harness Spec Orchestrator (v9) and its three skills](/assets/downloads/pi-harness-spec-orchestrator-v9.zip).** The bundle contains the orchestrator agent, the `running-visible-pi-subagents`, `tracing-agent-orchestration`, and `handling-subagent-stalls` skills, and a README with setup requirements (VS Code Copilot, PI, tmux, macOS Terminal). Configure model IDs for your own environment before use. Licensed under Apache 2.0.
```

The section headings come from the proposal's article structure; the prose is written in the follow-up article plan.

- [ ] **Step 2: Verify the draft renders**

Run: `cp content/drafts/2026-11-local-ai-hybrid-workflow.md content/posts/zz-draft-preview.md && npm run build && grep -c 'data-figure="local-ai-explorer"' dist/posts/zz-draft-preview.html && grep -c 'pi-harness-spec-orchestrator-v9.zip' dist/posts/zz-draft-preview.html; rm content/posts/zz-draft-preview.md && npm run build`
Expected: both counts `1`; final build succeeds without the preview post.

- [ ] **Step 3: Commit**

```bash
git add content/drafts/2026-11-local-ai-hybrid-workflow.md
git commit -m "docs: add local AI article draft with explorer embed" -- content/drafts/2026-11-local-ai-hybrid-workflow.md
```

---

### Task 8: User review gate

- [ ] **Step 1:** Run `npm test` in the blog and `.venv/bin/python -m pytest -q` in Token Economy; report results (Token Economy: only the pre-existing complexity failure).
- [ ] **Step 2:** Present to the user: the Task 3 counts and coverage, the three spot-check comparisons, a screenshot of each explorer view, and the provenance block (commit, dirty flag, patches SHA-256, patch stats).
- [ ] **Step 3:** Ask the user to approve (a) the trajectory score's behavior on real data (or fall back to plotting components separately, per the spec), (b) the public JSON contents, and (c) the download bundle. Do not push or move the draft into `content/posts/` without that approval.
