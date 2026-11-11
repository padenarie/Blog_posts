---
title: "I tried replacing cloud AI with local models. The useful result was a hybrid workflow."
date: 2026-11-10
description: "Three weeks of local-only AI coding, the usage data, and the spec-driven workflow that stayed."
tags: [local-ai, agents, workflow]
---

**13 min read**

**TL;DR**

- I spent three weeks, July 9–31, 2026, doing all my coding work with local models only, then switched cloud models back on and kept measuring.
- Local 27B-class models such as Qwen 3.8 27B handled a large share of daily work: repo search, unit tests, bug spotting, and implementing features from a clear spec.
- They fell short on long refactors, huge repositories, and questions that need broad knowledge rather than reasoning, such as Terraform on Azure.
- Once I could choose again, a clear split appeared: cloud calls had a median of about 84k input tokens, local calls about 33k. The interactive explorer below shows it.
- What stayed is a hybrid, spec-driven workflow: cloud models design, plan and review, local models implement. The orchestrator agent behind it is available to download.

## The bet

In July 2026 I switched off cloud AI for my day-to-day software engineering work. The hypothesis was simple and, in hindsight, a little bold: for the work I actually do, a sufficiently capable model running on my own hardware could replace cloud AI for most tasks without materially reducing my productivity.

I did not expect a clean yes or no, but I did expect the answer to be about replacement. It turned out to be about something else. Local models earned a permanent place in how I work, and cloud models kept theirs. What changed was that I stopped thinking of them as competitors and started routing work between them. I hypothesized replacement; I found complementarity.

This post is a field report rather than a benchmark. I measured what I could with the telemetry my editor already produces, and I describe the rest as my own experience on my own hardware. Where the data can say something, I show it. Where it cannot, I say so.

## Three weeks without cloud AI

The experiment ran from July 9 to July 31, 2026. During those three weeks I did all of my regular work with on-device models only: no frontier model in the editor, no chat assistant in the browser, no quiet exceptions. Before the experiment started I had already turned on the OpenTelemetry export in GitHub Copilot, so every model call, tool call and agent turn from my editor was recorded. On August 1 I switched cloud models back on, and the hybrid period that followed is the second half of the data.

<figure class="diagram diagram--timeline">
<ol class="dg-tl">
<li class="dg-tl-before"><div class="dg-tl-art"><img width="96" height="96" class="dg-portrait" src="../../assets/img/local-ai/guinea-pig.jpg" alt="An illustrated guinea pig with glasses, standing in for the author as the test subject" loading="lazy"></div><div class="dg-tl-bar"></div><p class="dg-tl-date">June 2026</p><p class="dg-tl-label">Copilot OpenTelemetry recording starts</p></li>
<li class="dg-tl-local"><div class="dg-tl-art"><span class="dg-logos dg-tl-off"><img width="34" height="34" class="dg-logo" src="../../assets/img/local-ai/openai.png" alt="OpenAI (switched off)" loading="lazy"><img width="34" height="34" class="dg-logo" src="../../assets/img/local-ai/anthropic.png" alt="Anthropic (switched off)" loading="lazy"></span><img width="104" class="dg-device" src="../../assets/img/local-ai/macbook.png" alt="MacBook Pro" loading="lazy"></div><div class="dg-tl-bar"></div><p class="dg-tl-date">July 9 – July 31, 2026</p><p class="dg-tl-label">Cloud AI off: on-device AI only</p></li>
<li class="dg-tl-hybrid"><div class="dg-tl-art"><span class="dg-logos"><img width="34" height="34" class="dg-logo" src="../../assets/img/local-ai/openai.png" alt="OpenAI" loading="lazy"><img width="34" height="34" class="dg-logo" src="../../assets/img/local-ai/anthropic.png" alt="Anthropic" loading="lazy"></span><span class="dg-plus">+</span><img width="104" class="dg-device" src="../../assets/img/local-ai/macbook.png" alt="MacBook Pro" loading="lazy"></div><div class="dg-tl-bar"></div><p class="dg-tl-date">August 1, 2026 – today</p><p class="dg-tl-label">Hybrid: local and cloud AI together</p></li>
</ol>
<figcaption>The experiment: telemetry first, then three weeks of on-device AI only, then cloud models back on for a hybrid period that is still running.</figcaption>
</figure>

Three weeks is long enough to stop treating the setup as a novelty. By the second week the question was no longer whether a local model could answer a prompt, but whether I could get through a normal working day with it. That is a much harder and more honest test.

## Running a model means running a stack

The first thing I learned is that "running a local model" is not a single decision. It is a stack of decisions, and every layer can make or break the experience.

If the diagram below feels like too much, that is deliberate. When I presented it, the list of terms down the right-hand side was meant to overwhelm: quants, KV-cache quantization, TurboQuant, ANE, MTP heads, drafter models, mixture-of-experts, harnesses. You do not need to know what each of them means. That flood of options, settings and acronyms is exactly what going down the local AI rabbit hole feels like.

<figure class="diagram diagram--slide diagram--stack">
<a href="../../assets/img/local-ai/slide-stack.png" title="Open the full-size image"><img src="../../assets/img/local-ai/slide-stack.png" width="1881" height="768" alt="Layered diagram of the on-device AI stack. Left: model development and preparation (out of scope): pre-training and fine-tuning, quantization and packaging, feeding model artifacts and repositories such as Hugging Face and GitHub. Centre, top to bottom: consuming applications and clients (chat UI, IDEs such as VS Code, agents); the serving and integration layer (APIs, web UI, orchestration, auth, prompt management, RAG, tools) with LM Studio, Ollama, llama.cpp and MTPLX; the on-device model execution stack with inference engines and runtimes (llama.cpp, MLX-LM, vLLM, OpenVINO, ONNX Runtime, TensorRT-LLM) and compute backends (CUDA, Metal, Vulkan, ROCm, oneDNN, OpenCL, CPU kernels). Bottom: on-device hardware (CPU, GPU and unified memory, NPU, RAM, storage) on a laptop, desktop and phone. Right: options at every layer, including Q4/Q5/Q6 and mixed-precision quants, KV-cache quantization, TurboQuant, ANE, MTP heads, DFlash drafter models, dense, MoE and MoA models, and harnesses." loading="lazy"></a>
<figcaption>Down the local AI rabbit hole: the on-device model stack, from hardware to the client in my editor, with a deliberately overwhelming list of options on the right. Model preparation sits next to it and was out of scope for the experiment.</figcaption>
</figure>

I ran the experiment on two machines. The first is a MacBook Pro with an M5 Max and 64 GB of unified memory. The second is a home-built Ubuntu desktop with two RTX 3060 cards of 12 GB each, built on an older platform: an Intel i5-4690K, 32 GB of DDR3 on an MSI Z97 Krait board, and an 850 W power supply.

On the Mac I mostly serve models through LM Studio. Along the way I tried a long list of other runtimes and inference engines, including DFlash, oMLX and MTPLX. Today, LM Studio with the Splash engine is by far the best overall option for Qwen 3.8 27B on that machine. On the desktop I run llama.cpp directly. The main model there is a Q4 quantization of the same Qwen 3.8 27B, split across both GPUs with tensor split, with multi-token prediction turned on, some kernel customization, and a community "GPU unlocker" project that enables additional cores NVIDIA keeps locked on consumer cards.

None of that is plug-and-play. Quantization level, KV-cache settings, context length, drafter models and the runtime itself all moved the result, sometimes by a lot. A model that felt unusable with one configuration was perfectly fine with another. That is the hidden cost of local AI: you are not just choosing a model, you are operating AI infrastructure.

## The model-size sweet spot

The second lesson was about size. Smaller models are fast and cheap to run, but below a certain size they stop being useful for agentic coding work. Larger models do not fit comfortably on the hardware I have. In between there is a class of models that, for me, hits the sweet spot.

<figure class="diagram diagram--slide diagram--sizes">
<a href="../../assets/img/local-ai/slide-model-tiers.png" title="Open the full-size image"><img src="../../assets/img/local-ai/slide-model-tiers.png" width="1627" height="768" alt="Staircase of model sizes by total parameters. About 4B: basic Q&amp;A and limited instruction following, for lightweight extraction. About 8B: factual and coding assistance and bounded, well-specified tasks, for knowledge bots and summarization. About 15B: short-horizon agentic work and modifying existing code, for single unit tests, small Python functions, repo search and single-tool workflows. About 25B to 35B, highlighted with the Qwen logo (dense Qwen 3.8 27B, MoE Qwen 3.6 35B-A3B): strong coding and reasoning and useful medium- to long-horizon agentic behavior, for complex implementation, repo-wide work, multi-step agentic tasks and general assistant intelligence. Above 35B is shown as an empty step." loading="lazy"></a>
<figcaption>Model size versus what I could use it for. The ~25–35B class, dense and mixture-of-experts, served me best in day-to-day work.</figcaption>
</figure>

For my work, that sweet spot is the 25–35 billion parameter class. In practice that meant the dense Qwen 3.8 27B and the mixture-of-experts Qwen 3.6 35B-A3B. Note that the two numbers are not directly comparable: a mixture-of-experts model with 35 billion total parameters only activates about 3 billion of them per token, so it is much faster than a dense 27B model but behaves differently on harder tasks.

This is a statement about my hardware and my work, not a general ranking. With more memory, the sweet spot moves up. With a different workload, it might move down.

## What the usage data shows

Because Copilot was exporting telemetry the whole time, I can look at how the two periods actually differ. The explorer below is built from a frozen snapshot of that data through September 9, 2026. It opens on the comparison I find most telling: every model call plotted by the size of its input and the trajectory score of the prompt it belonged to, once for the local-only period and once for the hybrid period, on identical logarithmic axes.

<div class="fig" data-figure="local-ai-explorer" data-config='{"src":"/assets/data/local-ai-explorer-2026-09-09.json","view":"trajectory"}'></div>

The vertical axis is what I call the trajectory score: a measure of how much observable agent activity one prompt caused. Here a prompt <math><mi>p</mi></math> is one request I typed, together with every model call and tool call the agent made to answer it. The score is the weighted complexity formula from my talk, applied to the three components the telemetry can actually observe:

<div class="formula">
<math display="block"><mrow><mi>T</mi><mo>(</mo><mi>p</mi><mo>)</mo><mo>=</mo><mfrac><mn>1</mn><mn>3</mn></mfrac><mo>(</mo><msub><mover accent="true"><mi>d</mi><mo>^</mo></mover><mi>p</mi></msub><mo>+</mo><msub><mover accent="true"><mi>n</mi><mo>^</mo></mover><mi>p</mi></msub><mo>+</mo><msub><mover accent="true"><mi>k</mi><mo>^</mo></mover><mi>p</mi></msub><mo>)</mo></mrow></math>
</div>

Each component is log-scaled and normalized by its 95th percentile across all prompts:

<div class="formula">
<math display="block"><mrow><msub><mover accent="true"><mi>x</mi><mo>^</mo></mover><mi>p</mi></msub><mo>=</mo><mfrac><mrow><mi>ln</mi><mo>(</mo><mn>1</mn><mo>+</mo><msub><mi>x</mi><mi>p</mi></msub><mo>)</mo></mrow><mrow><mi>ln</mi><mo>(</mo><mn>1</mn><mo>+</mo><msub><mi>P</mi><mn>95</mn></msub><mo>(</mo><mi>x</mi><mo>)</mo><mo>)</mo></mrow></mfrac></mrow></math>
</div>

where <math><mi>x</mi></math> stands for each of the three components:

- <math><msub><mi>d</mi><mi>p</mi></msub></math> is the **agent depth**: the number of sequential agent iterations for <math><mi>p</mi></math>, measured as the highest recorded turn index plus one. Very long runs only export their last turn event, so this is a lower bound.
- <math><msub><mi>n</mi><mi>p</mi></msub></math> is the **prompt position**: the 1-based position of <math><mi>p</mi></math> in its chat session, a proxy for how much conversation came before it.
- <math><msub><mi>k</mi><mi>p</mi></msub></math> is the number of **tool calls** linked to <math><mi>p</mi></math>, or 0 if none were observed.

In this data the P<sub>95</sub> values are 18 for depth, 20 for prompt position and 24.4 for tool calls. The logarithm stops one very long run from dominating the scale, and dividing by the 95th percentile puts the three components on the same footing, so equal weights of one third really do mean equal influence. A prompt with every component at its 95th percentile scores exactly 1. Because depth and position are at least 1, the lowest possible score is about 0.15: a single-step answer to the first prompt of a session, without tools. The highest score in this data is 1.16.

Every model call made for <math><mi>p</mi></math> is plotted at its own input-token count on the horizontal axis and at <math><mi>T</mi><mo>(</mo><mi>p</mi><mo>)</mo></math> on the vertical axis. The formula in my talk also had terms for thinking tokens and output tokens. I left both out here: the telemetry does not record thinking tokens, and output tokens measure verbosity as much as work. A high score means more observed agent activity, not a harder or better task.

During the local-only weeks, local models handled 1,419 calls, and the bulk of them sat between 10,000 and 100,000 input tokens, with the median at about 33,000. In the hybrid period the picture splits. Local calls stayed in the same place, with a median of about 33,000 input tokens. Cloud calls moved to the right: their median input was about 84,000 tokens, and 648 of 1,614 cloud calls were 100,000 tokens or more, compared to only 40 of 1,587 local calls. The separate columns at the left are Copilot's own helper models, which handle small background requests in the editor and are not models I chose.

I did not plan that division. It is what happened once I could choose again: large-context work went to the cloud, and the steady stream of small and medium tasks stayed local. The explorer also has a daily view of the two periods and a breakdown of prompt sizes, and its method note lists what is excluded. In particular, I removed 754 cloud calls from July 9–31 that were not part of the experiment. The data shows how I used the models, not how productive I was or how good the code turned out.

## Where local helped, and where it struggled

Local models were good at more than I expected. Repo search and code understanding were reliable. Writing unit tests was a strong fit. So was spotting bugs, brainstorming possible solutions, and command-line work. Bounded implementation was the real surprise: when a larger frontier model had written a clear specification, a 27B local model implemented features from it well. It was also useful for less obvious jobs, such as turning PDFs into HTML versions we could use as templates, or brainstorming different ways to rewrite text for articles.

Once the hardware and runtime settings were tuned, performance was good enough that I stopped noticing it. Local inference also has two quieter benefits: predictable cost, and no dependency on whether a cloud service is available or rate-limited that afternoon.

Where it struggled was just as clear. Long refactors that touch many files drifted. Very large repositories pushed against context limits and slowed everything down. And questions that need broad, current knowledge rather than reasoning alone, such as detailed Terraform questions about Azure, were where frontier models were simply better. A smaller model can reason well about code in front of it; it cannot know what it was never trained on. Complex architecture questions were less reliable locally, and long, high-iteration agent runs still favored the frontier models.

And of course, getting there took significant tinkering. Performance depended heavily on the runtime, the quantization and the hardware configuration.

## The workflow that stayed

When I turned cloud models back on, I did not simply go back to how I worked before. Over the following weeks a workflow settled in that uses each tier for what it is good at. It is a form of spec-driven development.

<figure class="diagram diagram--slide diagram--workflow">
<a href="../../assets/img/local-ai/slide-workflow.png" title="Open the full-size image"><img src="../../assets/img/local-ai/slide-workflow.png" width="1422" height="768" alt="Spec-driven workflow. Inside a dashed Cloud AI boundary: the user brainstorms and designs a spec with a cloud model in VS Code (Anthropic and OpenAI logos), the cloud AI writes the spec, and a cloud model later reviews the subagents' code, routing insufficient output back to the subagent with feedback. Below the boundary, the cloud AI converts the spec into tasks with a plan and routes them to models: PI agents on the desktop PC with Qwen 3.8 27B, on the MacBook with Qwen 3.8 27B, and on the MacBook with NVIDIA 3.5 Lightning 30B-3B. The agents write code, which goes to the cloud review step and, when finished, to the user for final review." loading="lazy"></a>
<figcaption>The hybrid, spec-driven workflow: cloud models design, plan and review; local models do the implementation work; I review the final result.</figcaption>
</figure>

It starts with me and a frontier cloud model in VS Code, brainstorming and turning an idea into a written specification. Nothing moves until I approve that spec. The cloud model then breaks it into small tasks with a plan, and I approve that breakdown too, including which model runs each task. Most implementation tasks go to local workers: Qwen 3.8 27B on the desktop or the MacBook, or an NVIDIA 30B mixture-of-experts model when speed matters more than depth. When a worker finishes, a cloud model reviews the result. If the output is not good enough, the task goes back to the worker with concrete feedback. When everything is done, the code comes to me for a final review.

The roles follow the data. The cloud tier does what needs long context, broad knowledge and careful judgment: design, planning and review. The local tier does the bulk of the bounded execution, where a capable 27B model is fast, predictable and essentially free to run. The tasks are small enough that context stays manageable, and the spec is clear enough that a local model does not need to guess.

## The agent behind the workflow

I eventually encoded this workflow as a custom agent for VS Code Copilot: the PI Harness Spec Orchestrator. It turns a request into an approved specification and small tasks, asks me to choose the exact model for each PI worker, dispatches the work, has the result reviewed, and only closes a task after I approve it. The orchestrator itself is model-agnostic. The split between cloud and local in the diagram above is how I use it, not something hardcoded.

Three small skills handle the mechanics. The first runs each PI worker in a visible, persistent Terminal session, so I can watch what it does and step in when needed. The second records the handoffs, progress and recovery checkpoints for each task in the repository, so work survives a restart. The third handles a worker that stops making progress: it checks the evidence and asks me how to recover, instead of silently retrying.

**Download the [PI Harness Spec Orchestrator (v9) and its three skills](/assets/downloads/pi-harness-spec-orchestrator-v9.zip).** The bundle contains the orchestrator agent, the `running-visible-pi-subagents`, `tracing-agent-orchestration`, and `handling-subagent-stalls` skills, and a README with setup requirements (VS Code Copilot, PI, tmux, macOS Terminal). Configure model IDs for your own environment before use. Licensed under Apache 2.0.

So, did local AI replace cloud AI? No. It became a complementary compute tier. Local models can cover a meaningful share of professional coding work, especially bounded implementation, repo exploration, code understanding and medium-complexity tasks. The strongest setup is hybrid: local models for capable, cost-effective execution, and frontier models for long context, deep reasoning, orchestration and final review. And running local AI means running AI infrastructure. The best results require tuning models, runtimes, memory, quantization, context and hardware. It is not a plug-and-play replacement for the cloud, but with some care it is a very good partner to it.
