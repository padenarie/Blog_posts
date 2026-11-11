# Cocktail Party Space Redesign — Design

**Date:** 2026-11-10
**Status:** Approved in conversation; awaiting written-spec review
**Repository:** `cocktail_party_problem/` (Git submodule → Hugging Face Space `Padenarie/The_Cocktail_Party_Problem`)

## Purpose and scope

The Space demonstrates Pierre-Antoine's QR-T independent component analysis (ICA) algorithm on the cocktail party problem. The current Gradio interface is a stack of default form widgets. It is hard to read, weak on mobile and has no visual identity. This redesign replaces the interface with a custom front end that feels like a playful cocktail party and matches the blog's visual identity. The signal-processing and ICA code are unchanged.

In scope: a new web front end, a small JSON API, extracting the Gradio-free mix and unmix logic into a service layer, backend tests, and deployment to the Space. Out of scope: algorithm changes, new sound-library content, and changes to the blog itself.

## Decisions

| Topic | Decision | Alternatives rejected |
| --- | --- | --- |
| Concept | **The cocktail party itself**: invite guests, hear the noisy room, unmix every voice | Audio-studio console; editorial scroll story |
| Technical controls | Hidden in a **Lab** drawer with good defaults | Reduce to 1–2 playful controls; keep everything visible |
| Science output | **Reveal**: recovered voices are the main output; diagnostics go in "Under the hood"; About content goes in "How does this work?" | Redraw everything up front; drop diagnostics |
| Build approach | **Custom front end with a JSON API** | A Gradio shell with a custom HTML block (fragile); a heavier Gradio restyle (low ceiling) |
| Layout | **One scrolling stage**: 01 Invite guests → 02 The room → 03 Voices recovered | Room-centric stage; three-act story |
| Visual style | **Blog-native, calm**, with a single accent | Neon lounge; warm cocktail bar; an earlier blog-native draft with a colour per guest, rejected as too busy |

## Page design

The approved mockup is `.superpowers/brainstorm/5956-1794346454/content/full-page-v3.html` (local only, gitignored).

### Visual rules

- Use the blog's tokens. Dark: background `#090e15`, text `#e6edf3`, muted `#8b98a5`, faint `#4b5664`, lines `rgba(148,163,184,.12)`, accent `#22d3ee`. Light: the blog's `[data-theme="light"]` palette (`--bg #f7f9fb`, `--text #0f172a`, `--muted #5b6675`, `--border #dbe2ea`, accent `#087c92`). Faint 40 px coordinate grid background.
- **One accent colour.** Use it only for the main button, an invited guest's outline and check, and the active (playing) item. No per-guest colours, glows or gradients.
- Uninvited guest artwork is dimmed (greyscale ≈ 0.9, brightness ≈ 0.55). Invited guests are in full colour. This is the main selection signal.
- Prefer spacing to boxes. Summary statistics are one sentence. Folded sections use thin dividers. Only one filled button is visible at a time.
- Waveforms are neutral grey. Only the playing microphone's waveform uses the accent. The mixing-matrix heatmap uses a single hue.
- Typography: the system sans-serif for everything, and monospace only for the small uppercase section labels (`01 INVITE GUESTS`) and numeric readouts.
- Theme: default to `prefers-color-scheme`; a ☾/☀ toggle overrides it and is stored in `localStorage`; a `?theme=light|dark` query parameter wins over both, so the blog's iframe can pass its theme.
- Honour `prefers-reduced-motion` with instant scrolling and no transitions.

### Structure

1. **Top bar:** `padenarie / cocktail party`, then *How it works*, *Lab* and the theme toggle.
2. **Header:** the author's original introduction: the title "🍸 Interactive Blind Source Separation demo with ICA", three short paragraphs, and the five-step overview (Sources, Mix, Unmix, Results, About).
3. **01 Invite guests:** a grid of artwork cards (five columns on desktop, two on phones) showing the name and a round ▶ preview button. Tapping a card toggles the invitation (`aria-pressed`). The meta line reads "N invited · choose at least 2". The last card is **+ Your own sound** (upload or record).
4. **02 The room:** small overlapping avatars of the invited guests and "Everyone is talking at once…". There is one entry per microphone: a play button, "Microphone n" and a mixture waveform. The main button reads **Start the party** before mixing and **Unmix the room →** afterwards. A ↻ *Remix* text link sits next to it.
5. **03 Voices recovered:** a summary sentence ("3 of 3 voices recovered · 91% average match"); guests the ICA did not recover count as 0. Each recovered guest gets a card with a thumbnail, name and match %, the recovered waveform over a faint original, and an *Original / Recovered* segmented player. A guest that wasn't recovered (fewer components than guests) gets a muted **Not recovered** card with only the original. Unmatched components appear as muted **Background / noise** cards. The Amari index appears in *Under the hood → Run details*, not in the summary: it is computed from the whitened-space rotation, so next to near-perfect matches it can look contradictory.
6. **Under the hood** (folded): the convergence curve, the mixing matrix A as a single-hue heatmap, waveform plots for the sources, mixtures and estimates (SVG), the estimate-to-original matching table, run details (iterations, components used, settings), and the PCA vs ICA showcase from `data/stored_results/`.
7. **How does this work?** (folded): the current About content (infographic, pipeline, QR-T explanation, performance trade-off and links), lightly edited for length.
8. **Lab drawer:** slides in from the right; on phones it is a full-height sheet.
   - **Mixing:** difficulty, conditioning (linear or geometric), number of mixtures (microphones: auto, or N ≥ guests), background noise and seed.
   - **Unmixing:** iterations, tolerance, auto PCA knee, denoise mixtures, Wiener strength, denoise estimates and random restarts (5×).
   - **Per guest:** a speed control for each invited guest.
   - **Defaults:** the current app's defaults, except that **Auto PCA knee is off**: with one microphone per guest it often kept too few components.
9. **Phone:** a single column, plus a sticky bottom bar that always shows the next action.
10. **Lab pop-up:** about a second after load, a small card under the *Lab* link ("🧪 Want a harder party? …") with *Open the Lab* and *Got it* buttons. It keeps appearing on each visit until the visitor opens the Lab or dismisses it; that is remembered in `localStorage` (`cp-lab-hint-done`). It doesn't take focus, is announced once as a polite status message, and Escape closes it.
11. **ⓘ hints:** every Lab option, plus the *Per guest* group, has a small round "i" button. Hovering, focusing or tapping it shows a tooltip explaining what the option does and its intended effect. Each button is linked to its tooltip with `aria-describedby`, so the control's own label stays clean.

## Architecture

```
cocktail_party_problem/
├── app.py           FastAPI app; serves web/ and /api; uvicorn on 0.0.0.0:7860
├── server/
│   ├── api.py       HTTP routes only: validate, call the service, return JSON
│   ├── service.py   library(), add_source(), mix(), unmix(); no web imports
│   ├── store.py     in-memory TTL/LRU store for mixes, uploads and generated audio
│   └── media.py     WAV encoding, cached resized images, previews, waveform envelopes
├── utils.py         DSP helpers only (Gradio and matplotlib code removed)
├── ica_core.py, ica_evaluate.py   unchanged
├── web/
│   ├── index.html
│   ├── app.css
│   └── js/          ES modules, no build step: api, state, guests, room, results, lab, waveform, player
└── tests/           pytest
```

- `service.mix()` and `service.unmix()` are the current `mix_sources_step` and `run_demo` with the Gradio coupling removed. They return plain data, and the numerical pipeline is identical.
- Delete `ui.py`, `styles.css`, the Gradio code in `utils.py`, and the matplotlib plot helpers. Keep `stored_results_pca_vs_ica.py` and `notebooks/`.
- `requirements.txt` explicitly lists `fastapi`, `uvicorn`, `python-multipart`, `pillow`, `numpy`, `scipy`, `soundfile` and `librosa`.
- Hosting: keep `sdk: gradio` in the Space README, so Hugging Face runs `python app.py`. Before building anything else, verify that this serves a plain FastAPI app. If it does not, switch to `sdk: docker` with a minimal Dockerfile that exposes port 7860.
- Never send the original 2816 px PNGs to the browser. Serve resized JPEGs cached in memory: thumbnails at a maximum of 480 px, and About images at a maximum of 1400 px. Generate them at runtime; `data/` is gitignored and its media is in LFS.
- The page must work inside the blog's iframe (`allow="microphone"`). Do not send `X-Frame-Options: DENY`.

## API

| Method and path | Request | Response |
| --- | --- | --- |
| `GET /api/library` | – | `[{id, name, image_url, preview_url, duration}]` |
| `GET /api/media/{kind}/{id}` | – | A cached JPEG thumbnail or About image, or a 10 s WAV preview |
| `POST /api/sources` | multipart `file`: a 16 kHz mono WAV produced in the browser | `{id, name, duration}`. Trimmed to 30 s; maximum 10 MB. The browser decodes the user's file (wav, mp3, flac, ogg, m4a) or recording with the Web Audio API and encodes it as WAV, so the server needs no codecs or ffmpeg. |
| `POST /api/mix` | `{guests:[{id, speed}], seed, difficulty, conditioning, microphones: int\|null, noise}` | `{mix_id, sample_rate, cond_A, matrix_A, microphones:[{audio_url, waveform}]}` |
| `POST /api/unmix` | `{mix_id, iterations, tolerance, auto_pca, denoise_mixtures, denoise_estimates, wiener_strength, restarts}` | See below |
| `GET /api/audio/{key}.wav` | – | A generated clip from the store |

The unmix response:

- `summary`: `{found, total, mean_match, amari|null, iterations, components_used, seconds}`
- `voices[]`: `{guest_id, name, recovered, match, original_url, recovered_url, waveform_original, waveform_recovered}`. When `recovered` is false, `match` is 0 and `recovered_url` and `waveform_recovered` are `null`.
- `unmatched[]`: `{index, recovered_url, waveform}`
- `diagnostics`: `{convergence[], matrix_A, waveforms:{sources, mixtures, estimates}, pairs[], settings}`

Each waveform is about 300 min/max pairs, not raw samples. `amari` is `null` when A is not square, or when restarts are used. Store entries expire after 30 minutes idle; the store holds at most about 50 mixes and evicts the oldest first. CPU-bound work runs in FastAPI's thread pool, using sync route handlers.

## Behaviour and error handling

- **Too few guests:** the main button is disabled with the hint "Invite at least 2 guests".
- **Stale results:** changing guests, speeds or any mixing setting after a mix marks the room as stale ("Guests changed · Start the party again") and hides the results. Changing only unmixing settings keeps the mix, so the user can unmix again.
- **Busy states:** while working, the button shows "Mixing…" or "Unmixing…" with a spinner and ignores repeat clicks.
- **API errors:** the API returns `{error: "<human message>"}` with 400 (invalid input), 404 or 410 (expired or unknown mix: "This party ended — start it again"), or 500. Messages appear inline under the main button in a muted error colour; there are no pop-ups.
- **Audio playback:** a single shared player plays one sound at a time; starting another sound stops the current one.
- **Recording:** uses `MediaRecorder`; the recording is decoded and sent as WAV, like an upload. If recording is unsupported or permission is denied, hide *Record* and keep *Upload*. If the browser can't decode an uploaded file, show "Couldn't read that file".
- **Limits:** enforce `MAX_SOURCES` (20) for guests and microphones on the server, and reflect it in the Lab's slider limits.
- **Accessibility:** all controls are real buttons or inputs, reachable by keyboard, with a visible focus style. The invite cards use `aria-pressed`, and images have alt text.

## Testing

- **Service:**
  - mix returns the correct shapes and microphone count, both automatic and explicit.
  - A well-conditioned two-guest mix unmixes with a mean match above 0.9.
  - Extra microphones or noise produce unmatched components.
  - `amari` is `null` for a non-square A.
  - Invalid input raises clear errors: fewer than 2 guests, speed ≤ 0, fewer microphones than guests, more than `MAX_SOURCES`.
- **Store:** entries expire after the TTL, and the cap evicts the oldest.
- **API** (FastAPI `TestClient`): library, upload (valid file and undecodable file), mix, unmix, audio fetch, and an expired or unknown `mix_id` returning 410 or 404.
- **Front end:** scripted browser runs of the full flow (invite → start the party → play a microphone → unmix → play original or recovered) at desktop width and at 390 px, in both themes. Also check that only one sound plays at a time, the stale-state behaviour, the error messages, and the Lab controls.

## Deployment

1. Create a **private staging Space** (`Padenarie/The_Cocktail_Party_Problem-staging`), with explicit approval first. Hugging Face only builds a Space's `main`, so a branch cannot test hosting. Push a minimal FastAPI `app.py` there first, to confirm that the `sdk: gradio` runtime serves it; otherwise use `sdk: docker`. Run every later build on staging before touching the live Space.
2. Implement and test locally; commit in small steps in the submodule. Keep the CRLF line endings in the existing files.
3. Once staging passes the browser check, push to the live Space's `main`. Wait for the runtime to report `RUNNING` at the new SHA, then repeat the browser check against `https://padenarie-the-cocktail-party-problem.hf.space/`.
4. Bump the submodule pointer in `Blog_posts`. The parent commit stays local unless pushing is requested.
