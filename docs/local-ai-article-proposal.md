# Proposal: When local AI became part of my coding workflow

Status: for review, not for publication

## The story

**Working title:** *I tried replacing cloud AI with local models. The useful result was a hybrid workflow.*

**Central claim:** During a three-week local-only experiment, on-device models became useful for bounded coding work, but did not replace frontier models for longer, more demanding agent work. The lasting change was a workflow that routes work between them. This is a personal field report, supported by usage telemetry; it is not a controlled productivity or model-quality benchmark.

**Possible opening:**

> In July 2026 I turned off cloud AI for my day-to-day software engineering work. I wanted to know whether a capable model running on my own hardware could cover most of the work without slowing me down. Three weeks later, the answer was more useful than a simple yes or no: local models earned a place in my workflow, while cloud models still mattered for long context, difficult design work, and review.

## Article structure

| Section | Purpose and slide material |
| --- | --- |
| The bet | State the original replacement hypothesis from slide 2 and the practical question: which work can move on-device? |
| Three weeks without cloud AI | Use the July 9–31 timeline from slide 3. Explain that Copilot OpenTelemetry recording started earlier, and that August 1 begins the hybrid period. |
| Running a model means running a stack | Adapt the layered diagram from slide 4: hardware, compute backend, inference runtime, serving layer, and coding client. Mention model preparation as an adjacent step. Explain only the choices that affected this experiment. |
| The model-size sweet spot | Adapt slide 5's stepped diagram. Present the roughly 25–35B class as *my* practical sweet spot on this hardware, not a general ranking; distinguish dense and mixture-of-experts parameter counts. |
| What the usage data shows | Embed the curated interactive explorer below. Explain what each plot can and cannot establish. |
| Where local helped, and where it struggled | Develop slide 6 into concrete examples: repo search, code understanding, bounded implementation versus long-context architecture and high-iteration work. Add an example or two from the author's own projects before publication. |
| The workflow that stayed | Redraw slide 8's spec-driven workflow: design and specification, approved task breakdown, exact model selection, routed implementation, review, and user approval. Explain that the actual orchestrator is model-agnostic: the user chooses the implementation model for each task. End with the complementarity conclusion from slide 9. |
| The agent behind the workflow | Introduce the author's version 9 Pi Harness Spec Orchestrator as a concrete implementation of the workflow. Explain how its three companion skills run visible PI sessions, preserve task traces, and handle stalls. Include a download callout and brief setup requirements. |

Target: approximately 1,800–2,200 words, with four adapted diagrams, one embedded explorer, and a downloadable agent bundle. Write in first person and keep the original experiment's hypothesis → observation → changed workflow arc.

In the current local data snapshot (UTC date boundaries, with the `patches.json` corrections in effect), the July 9–31 interval contains 1,419 local inference calls and no cloud calls; 754 cloud calls in that interval are excluded by the correction table as not part of the experiment. August 1–September 9 contains 1,587 local calls, 1,614 cloud coding-model calls, and 1,961 calls to Copilot's built-in helper models (1,958 `gpt-4o-mini` and 3 `instant-apply-qwen3-4b-no-think`, classified as `copilot`). Report the helper calls separately rather than as cloud coding work. These counts establish usage patterns only; the two intervals differ in length and task mix.

## Visuals and interactive explorer

Redraw slides 3, 4, 5, and 8 as responsive SVG or HTML figures in the blog's visual language. Preserve their information and relationships rather than embedding full slide images. This keeps labels readable on phones and avoids carrying over the presentation footer and branding. The stack and workflow figures should have text alternatives.

For the workflow redraw, use the actual agent's gates rather than treating slide 8 as a literal implementation diagram. The agent requires specification and task-breakdown approval, user selection of the exact PI model, task-level review, and final user approval. The cloud/local choices shown in the talk are an example of how those gates were used, not hardcoded agent behavior.

Embed a **Local AI Explorer** directly in the article, with a larger standalone view if the article column is too narrow. Reuse the Token Economy repository's ECharts library, deployment colors, data definitions, and relevant chart logic. Give the public explorer three focused views:

1. **Daily model calls by deployment.** Mark the local-only interval (July 9–31) and the hybrid interval (from August 1). This shows the change in usage, not productivity.
2. **Prompt-size distribution.** Adapt the deck's four logarithmic input-token bins and the dashboard's existing chart. Keep the unit explicit: inference calls.
3. **Prompt size versus agent trajectory, before and after.** Two stacked panels with identical logarithmic x and y axes, matching the deck's chart slide: "Local only (Jul 9–31)" on top and "Hybrid (Aug 1–Sep 9)" below. One point per inference call: x is that call's input tokens, y is the trajectory score of the prompt the call belongs to. Points are colored local, cloud, or copilot (helper calls shown by default, as on the slides), with deployment toggles. The comparison should make the hybrid division visible: in the hybrid period cloud calls have a median of about 84k input tokens (648 calls at 100k or more) while local calls have a median of about 33k (40 calls at 100k or more). Calls with no recorded input tokens or no scored prompt are omitted and counted in the method note. Tooltips show the call's input tokens and its prompt's agent depth, prompt position, linked tool calls, and subagent runs.

Keep the controls to a period filter, deployment toggles in the chart legend, chart selection, reset, and a short method note. Omit the full dashboard's session explorer, raw tool/error tables, arbitrary metric sandbox, and price/cost panels from this article. The local price is set to zero in the source dashboard and several cloud prices are estimates, so those panels would not support a fair cost comparison here.

**Implementation:** Export a small, reviewed public JSON snapshot from Token Economy and bundle it with this static blog. Freeze the snapshot at September 9, 2026; generate it through the existing ETL with the manual corrections in `patches.json` applied, and do not bypass, discard, or rewrite that correction source. Record the as-of date, ETL revision, and correction-file version or hash in export provenance so the corrected snapshot can be reproduced without publishing individual correction records. The blog already supports interactive figures in posts; add a purpose-built figure module for the explorer and adapt its layout for a wider figure area. Keep the export script and formula versioned so the snapshot can be regenerated. The public JSON should contain only chart fields and aggregate counts: no trace or conversation IDs, prompts, file paths, machine paths, correction records, or raw session records. Show its data-through date in the explorer. This gives readers dynamic filtering and hover details without hosting the private FastAPI dashboard.

The current dashboard queries a local FastAPI/DuckDB server and includes session-level views, so embedding its whole page would also require hosting and narrowing that API. The proposed explorer embeds the relevant dashboard behavior in the article. Its charts remain interactive, while the dataset is a dated snapshot rather than a live feed.

## Downloadable orchestrator

Add a callout after the workflow diagram: **Download the Pi Harness Spec Orchestrator (v9) and its three skills**. Link the article to `/assets/downloads/pi-harness-spec-orchestrator-v9.zip`. The bundle is already prepared in this repository at [the public download folder](../assets/downloads/pi-harness-spec-orchestrator-v9/) and contains:

- `pi-harness-spec-orchestrator.agent.md` — the model-agnostic orchestrator with discovery, specification, task and model selection, reviews, and user approval;
- `running-visible-pi-subagents` — PI model resolution and visible, persistent Terminal/tmux sessions;
- `tracing-agent-orchestration` — repository-local task handoffs, progress, and recovery checkpoints;
- `handling-subagent-stalls` — evidence checks and user-directed recovery when a PI task stops making progress;
- a README with install instructions and the blog's Apache 2.0 license.

The article should explain the relationship in plain terms: the agent decides **when** to ask, dispatch, review, and close a task; the skills supply **how** to run and track the PI workers. A short excerpt could say:

> I eventually encoded this workflow as a custom orchestrator agent. It turns a request into an approved spec and small tasks, lets me choose the exact model for each PI worker, and checks the result before I approve it. Three small skills handle the mechanics: keeping workers visible in Terminal, recording handoffs and progress in the repository, and recovering a worker that gets stuck planning. The download includes the agent and those skills, so the diagram is something readers can inspect and adapt.

The public copy preserves the source agent and skills except that one absolute path to the author's local model has been replaced with a setup placeholder. The README states the VS Code Copilot, PI, tmux, and macOS Terminal requirements; readers must configure model IDs for their own environment. The bundle should be linked from the article only after its content and licensing have been reviewed alongside the article.

## Agent trajectory score: proposed revision

The chart on slide 7 shows an older weighted complexity formula with thinking tokens. The current Token Economy implementation uses a configurable weighted `log1p` score; `reasoning_tokens` is a placeholder that is always zero. Neither score should be copied directly into the public article. The article's measure keeps the useful trajectory signals—sequential agent depth, conversation length, and tool use—and drops reasoning tokens.

Use a new, explicitly named **agent trajectory activity score** for this article, computed once per prompt/`conv`:

```text
trajectory_score(p) = (1/3) * (d̂_p + n̂_p + k̂_p)
x̂_p = ln(1 + x_p) / ln(1 + P95(x))
```

This is the deck's weighted complexity formula (WCS = Σ w_i x̂_i with P95-normalized log terms) restricted to the three observed components: agent depth `d` (deck D), prompt position `n` (deck L) and tool calls `k` (deck A), with equal weights. P95 is taken over all scored prompts in the snapshot (18, 20 and 24.4) and exported with it. The deck's thinking-token and output-token terms are excluded.

The components are:

- `agent_depth` — sequential agent/tool depth for the prompt: Token Economy's existing `iterations` component, `max(turn.index) + 1` per conversation, deduplicated by `span_id`. This is the "sequential tool depth / agent iterations" component from the Token Economy score design. It is a lower bound for the longest runs, whose SDK export keeps only the final turn event.
- `prompt_position` — conversation length at the time of the prompt: the 1-based position of the prompt within its chat session (`session_id`), ordered by session-start timestamp. In the September 9 snapshot, 1,479 prompts fall into 293 chat sessions.
- `observed_tool_calls` — linked `copilot_chat.tool.call` events for the prompt (Token Economy's `tool_calls`).

Show all three raw components in the tooltip, plus the prompt's subagent runs (`runSubagent` tool calls; 61 in the snapshot). Subagent runs are informational only and are not a score component. The telemetry has no parent/child span links, so nested subagent depth is not measured; the method note should say so.

Exclude reasoning tokens entirely from the formula, exported JSON, and score controls. Leave input and output tokens out of this activity score: input tokens are the scatter plot's x-axis, and output tokens measure verbosity as well as work. Preserve missing or unlinked component values as unavailable rather than treating them as zero; identify approximate tool-event links in the method note. Do not describe a high score as proven task difficulty or quality; it indicates more observed agent activity.

Before publishing, validate the components and score against several known prompt trajectories; check component coverage by phase and route. The source notes that very long runs undercount agent depth and that tool-to-prompt linking is partly heuristic. The public figure should report how many prompts have usable values for every score component and explain that linked-tool counts are incomplete. If the score does not survive that review, show the available dimensions separately instead of inventing a stronger claim.

## Data and claim checks before publication

- Freeze the article's comparison and public data snapshot to July 9–31 and August 1–September 9, 2026. Generate the snapshot through the corrected ETL path, with `patches.json` applied, and record its provenance without exposing the correction records. Use one stated timezone for daily boundaries.
- Reconcile deployment labels and mixed prompts before exporting. A prompt-level plot must not count each of its model calls as a separate trajectory.
- Recompute every plot from the snapshot; do not reuse slide 7's screenshots or older formula.
- Separate first-person observations from measured counts. The telemetry records usage, token sizes, and observed steps, but does not measure productivity or code quality directly.
- Review the diagrams and public model names for publication. The deck carries a Deloitte copyright footer and several vendor marks; the proposed redraw keeps the content while using neutral labels and the blog's own design.
- The Token Economy working tree currently contains uncommitted changes and generated data. Record the exact export inputs and commit state when the public snapshot is made.
- Check the downloadable agent bundle's version, model registry, setup instructions, and license before making its link public.

## Review choices

1. Is the central claim and first-person tone right for the blog?
2. Does the revised activity score—agent depth, prompt position in the chat session, and observed tool calls, with reasoning tokens excluded—represent the useful parts of the trajectory measure?
3. Does the public bundle represent the version of the orchestrator and three skills you want readers to receive?

## Source map

- Presentation: *Local AI AIA meeting 11-09-2026*, slides 2–9.
- Token Economy: [README](<../../../Token Economy/README.md>), [score implementation](<../../../Token Economy/complexity.py>), [score configuration](<../../../Token Economy/complexity.json>), [ETL](<../../../Token Economy/etl.py>), [dashboard API](<../../../Token Economy/serve.py>), and [dashboard charts](<../../../Token Economy/static/app.js>).
- Blog implementation: [post instructions](../README.md), [post figure registry](../assets/js/figures.js), and [site build](../src/build.mjs).
- Workflow files: [orchestrator agent](<../../../Agents & Skills/agents/pi-harness-spec-orchestrator.agent.md>), [visible PI skill](<../../../Agents & Skills/skills/running-visible-pi-subagents/SKILL.md>), [trace skill](<../../../Agents & Skills/skills/tracing-agent-orchestration/SKILL.md>), and [stall skill](<../../../Agents & Skills/skills/handling-subagent-stalls/SKILL.md>).
