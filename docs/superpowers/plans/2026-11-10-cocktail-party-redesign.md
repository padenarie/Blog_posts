# Cocktail Party Space Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Gradio interface of the Hugging Face Space with a calm, blog-native "cocktail party" web page backed by a small JSON API, without changing the ICA mathematics.

**Architecture:** A FastAPI app (`app.py`) serves static files from `web/` and a JSON API under `/api`. The routes in `server/api.py` are thin; all mixing and unmixing logic lives in `server/service.py`, built on the existing DSP helpers in `utils.py` and the untouched `ica_core.py` and `ica_evaluate.py`. The front end is plain HTML, CSS and ES modules with no build step.

**Tech Stack:** Python 3.10+, FastAPI, Uvicorn, Pydantic v2, NumPy, SciPy, soundfile, Pillow, pytest; vanilla JavaScript (ES modules), SVG, the Web Audio API and MediaRecorder.

**Spec:** `docs/superpowers/specs/2026-11-10-cocktail-party-redesign-design.md`. Read it before starting; this plan implements it.

## Global Constraints

- All code paths are in the submodule `cocktail_party_problem/` unless stated otherwise. Run every command from that directory.
- Python must run on **3.10**, the Hugging Face default: no `except*`, `typing.Self` or other 3.11+ features. The local venv (`.venv`, Python 3.15) is for development only.
- **Do not change the numerical pipeline.** `ica_core.py` and `ica_evaluate.py` stay untouched. In `utils.py`, only Gradio and plotting code is removed, and `gr.Error` becomes `ValueError`.
- `utils.py` uses **CRLF** line endings, so keep them. After editing it, `git diff --stat` must show only the intended changes.
- `MAX_SOURCES = 20` limits both guests and microphones.
- Store limits: mixes expire after **30 minutes idle** and the store holds at most **50 mixes**, evicting the oldest first.
- API errors are always JSON `{"error": "<human message>"}` with status 400, 404, 410 or 500.
- Never send the original 2816 px PNGs. Thumbnails are at most **480 px** and About images at most **1400 px**, served as JPEG.
- Visual rules: one accent colour (`#22d3ee` dark, `#087c92` light), used only for the main button, invited guests and the item that's playing. There are no per-guest colours. Monospace is used only for the small section labels and numeric readouts.
- No front-end framework or build step: ES modules loaded from `web/js/`.
- Locally, always start the server with `HOST=127.0.0.1` so it doesn't listen on the network.
- Commit in the submodule after each task, using its short free-form message style (for example "Add in-memory store and media helpers"). End every commit message with `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`.
- Never push to the live Space (`origin`) before Task 12, and only after the user gives an explicit go-ahead. Commits in the parent `Blog_posts` repo stay local.

## File Map

| File | Status | Responsibility |
| --- | --- | --- |
| `app.py` | Rewrite | Entry point: `create_app()` served by Uvicorn on `HOST`/`PORT` (default `0.0.0.0:7860`) |
| `server/__init__.py` | Create | Package marker |
| `server/store.py` | Create | `TTLStore`: a thread-safe in-memory store with idle expiry and an LRU cap |
| `server/media.py` | Create | `slugify`, `wav_bytes`, `decode_wav`, `waveform`, `jpeg_bytes` |
| `server/service.py` | Create | `PartyService`: library, uploads, `mix()`, `unmix()`, clips; `ServiceError`, `PartyExpired` |
| `server/api.py` | Create | `create_app()`: routes, request models, error handlers, static mount |
| `utils.py` | Modify | Keep only the DSP and audio helpers |
| `ui.py`, `styles.css` | Delete | The old Gradio UI |
| `requirements.txt` | Rewrite | Runtime dependencies |
| `requirements-dev.txt` | Create | `pytest` |
| `README.md` | Modify | Add a "Run locally" section; front matter unchanged unless Task 1 requires Docker |
| `web/index.html` | Create | Page markup, including the Lab drawer and "How does this work?" |
| `web/app.css` | Create | The complete visual system: dark and light tokens, components, phone layout |
| `web/js/theme.js` | Create | The theme toggle |
| `web/js/state.js` | Create | App state, defaults, stale detection, request builders |
| `web/js/api.js` | Create | `fetch` wrappers and `ApiError` |
| `web/js/dom.js` | Create | `el`, `audioButton`, `guestArt`, `prefersReducedMotion` |
| `web/js/player.js` | Create | The single shared audio player |
| `web/js/audio-input.js` | Create | The "Your own sound" card: decoding to WAV, upload and recording |
| `web/js/guests.js` | Create | The guest grid and inviting |
| `web/js/waveform.js` | Create | SVG envelopes and the line chart |
| `web/js/room.js` | Create | The room, the main action, mixing and unmixing |
| `web/js/results.js` | Create | Recovered voices and "Under the hood" |
| `web/js/lab.js` | Create | The Lab drawer |
| `web/js/main.js` | Create, then grow | Bootstrap; it gains imports in Tasks 7–10 |
| `tests/conftest.py` | Create | `sys.path` setup and the synthetic `library` fixture |
| `tests/test_store.py`, `tests/test_media.py`, `tests/test_service.py`, `tests/test_unmix.py`, `tests/test_api.py` | Create | Backend tests |

---

### Task 1: Verify hosting on a private staging Space

The spec requires checking, before building anything else, that a `sdk: gradio` Space will run a plain FastAPI app.

**Files:** none in this repository. A throwaway clone goes in `/tmp/cpp-staging`.

**Interfaces:**
- Produces: the hosting decision, **gradio** or **docker**, which Task 12 uses, and the staging Space `Padenarie/The_Cocktail_Party_Problem-staging`.

- [ ] **Step 1: Ask the user for approval.** Use the ask_user tool: "May I create a private Space `Padenarie/The_Cocktail_Party_Problem-staging` on your Hugging Face account for testing?" Stop if the user declines. In that case, mark this task blocked and continue with Task 2. Task 12 then deploys straight to the live Space, after the user agrees to that.

- [ ] **Step 2: Create the Space**

```bash
.venv/bin/python - <<'EOF'
from huggingface_hub import HfApi
url = HfApi().create_repo("Padenarie/The_Cocktail_Party_Problem-staging", repo_type="space", space_sdk="gradio", private=True, exist_ok=True)
print(url)
EOF
```
Expected: prints `https://huggingface.co/spaces/Padenarie/The_Cocktail_Party_Problem-staging`.

- [ ] **Step 3: Write the hosting probe**

```bash
rm -rf /tmp/cpp-staging && GIT_TERMINAL_PROMPT=0 git clone https://huggingface.co/spaces/Padenarie/The_Cocktail_Party_Problem-staging /tmp/cpp-staging
```

Create `/tmp/cpp-staging/README.md`:
```markdown
---
title: Cocktail Party staging
sdk: gradio
sdk_version: 6.10.0
app_file: app.py
pinned: false
---
Staging copy of The Cocktail Party Problem.
```

Create `/tmp/cpp-staging/requirements.txt`:
```
fastapi
uvicorn
```

Create `/tmp/cpp-staging/app.py`:
```python
import uvicorn
from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def root():
    return {"hello": "cocktail party"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=7860)
```

- [ ] **Step 4: Push and wait for the build**

```bash
cd /tmp/cpp-staging && git add -A && git commit -qm "Hosting probe" && GIT_TERMINAL_PROMPT=0 git push origin HEAD:main
```
Then poll until the stage is `RUNNING` or an error (up to about 10 minutes):
```bash
TOKEN=$(/Users/pdenarie/Developer/Personal/Blog_posts/cocktail_party_problem/.venv/bin/python -c "from huggingface_hub import get_token; print(get_token() or '')")
for i in $(seq 1 30); do curl -s -H "Authorization: Bearer $TOKEN" https://huggingface.co/api/spaces/Padenarie/The_Cocktail_Party_Problem-staging/runtime | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('stage'), (d.get('errorMessage') or '')[:200])"; sleep 20; done
```

- [ ] **Step 5: Check the response**

```bash
curl -s -H "Authorization: Bearer $TOKEN" https://padenarie-the-cocktail-party-problem-staging.hf.space/
```
Expected for **gradio**: `{"hello":"cocktail party"}`.

- [ ] **Step 6 (only if Step 4 or 5 failed): Switch the probe to Docker.** Replace the README front matter with:
```markdown
---
title: Cocktail Party staging
sdk: docker
app_port: 7860
pinned: false
---
```
Add `/tmp/cpp-staging/Dockerfile`:
```dockerfile
FROM python:3.11-slim
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"
WORKDIR /home/user/app
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt
COPY --chown=user . .
EXPOSE 7860
CMD ["python", "app.py"]
```
Commit, push, and repeat Steps 4–5. Expected: `{"hello":"cocktail party"}`. The hosting decision is then **docker**.

- [ ] **Step 7: Record the decision and clean up.** Tell the user which hosting mode works. Then run `rm -rf /tmp/cpp-staging`; the Space stays for Task 12.

---

### Task 2: In-memory store and media helpers

**Files:**
- Create: `server/__init__.py` (empty), `server/store.py`, `server/media.py`
- Create: `tests/conftest.py`, `tests/test_store.py`, `tests/test_media.py`, `requirements-dev.txt`

**Interfaces:**
- Produces:
  - `TTLStore(ttl_seconds=1800, max_items=50, clock=time.monotonic)` with `.put(value, key=None) -> str`, `.get(key) -> value | None` and `len()`.
  - `slugify(text) -> str`
  - `wav_bytes(x, sr) -> bytes`
  - `decode_wav(data) -> (int, np.ndarray)`, which raises `ValueError("Couldn't read that file.")`
  - `waveform(x, points=300) -> list[list[float]]`, containing `[min, max]` pairs in [-1, 1]
  - `jpeg_bytes(path: str, max_side: int) -> bytes`, cached
  - pytest fixture `library` → `(sounds_dir, images_dir)` with three 8 s, 16 kHz WAVs: "Laplace Noise", "Saw Tooth" and "Square Wave" (only "Square Wave" has a PNG)

- [ ] **Step 1: Install pytest in the venv**

Create `requirements-dev.txt`:
```
-r requirements.txt
pytest
```
Run: `.venv/bin/pip install pytest`
Expected: `Successfully installed ... pytest-...`.

- [ ] **Step 2: Write the test fixtures** in `tests/conftest.py`

```python
import sys
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

SR = 16000


@pytest.fixture
def library(tmp_path):
    """A tiny sound library: three distinct, non-Gaussian 8 s signals; only one has artwork."""
    sounds = tmp_path / "sound_files"
    images = tmp_path / "images"
    sounds.mkdir()
    images.mkdir()
    t = np.arange(SR * 8) / SR
    rng = np.random.default_rng(0)
    signals = {
        "Square Wave": np.sign(np.sin(2 * np.pi * 3 * t)),
        "Laplace Noise": rng.laplace(size=t.size) / 4,
        "Saw Tooth": 2 * ((t * 5) % 1) - 1,
    }
    for name, x in signals.items():
        sf.write(sounds / f"{name}.wav", (0.5 * np.clip(x, -1, 1)).astype(np.float32), SR, subtype="PCM_16")
    Image.new("RGB", (64, 48), (200, 30, 30)).save(images / "Square Wave.png")
    return sounds, images
```

- [ ] **Step 3: Write the failing tests**

`tests/test_store.py`:
```python
from server.store import TTLStore


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now


def test_put_and_get_roundtrip():
    store = TTLStore()
    key = store.put({"a": 1})
    assert store.get(key) == {"a": 1}


def test_put_accepts_an_explicit_key():
    store = TTLStore()
    assert store.put("x", key="upload-1") == "upload-1"
    assert store.get("upload-1") == "x"


def test_unknown_key_returns_none():
    assert TTLStore().get("nope") is None


def test_entries_expire_after_ttl_of_inactivity():
    clock = FakeClock()
    store = TTLStore(ttl_seconds=10, clock=clock)
    key = store.put("x")
    clock.now = 9
    assert store.get(key) == "x"  # reading refreshes the idle timer
    clock.now = 18
    assert store.get(key) == "x"
    clock.now = 29
    assert store.get(key) is None


def test_cap_evicts_least_recently_used():
    store = TTLStore(max_items=2)
    a = store.put("a")
    b = store.put("b")
    store.get(a)
    c = store.put("c")
    assert store.get(b) is None
    assert store.get(a) == "a"
    assert store.get(c) == "c"
    assert len(store) == 2
```

`tests/test_media.py`:
```python
import io

import numpy as np
import pytest
from PIL import Image

from server.media import decode_wav, jpeg_bytes, slugify, wav_bytes, waveform


def test_slugify():
    assert slugify("A Christmas adventure") == "a-christmas-adventure"
    assert slugify("Omae wa mou shindeiru!") == "omae-wa-mou-shindeiru"
    assert slugify("***") == "sound"


def test_wav_roundtrip():
    x = np.sin(np.linspace(0, 100, 16000)).astype(np.float32)
    sr, y = decode_wav(wav_bytes(x, 16000))
    assert sr == 16000
    assert y.shape == (16000,)
    assert np.max(np.abs(y)) <= 1.0


def test_decode_wav_rejects_garbage():
    with pytest.raises(ValueError, match="Couldn't read"):
        decode_wav(b"not audio")


def test_waveform_shape_and_range():
    env = waveform(np.random.default_rng(0).normal(size=5000), points=50)
    assert len(env) == 50
    assert all(-1 <= low <= high <= 1 for low, high in env)


def test_waveform_handles_short_and_empty_signals():
    assert len(waveform(np.ones(3), points=10)) == 10
    assert waveform(np.array([]), points=4) == [[0.0, 0.0]] * 4


def test_jpeg_bytes_downscales(tmp_path):
    path = tmp_path / "big.png"
    Image.new("RGB", (2000, 1000)).save(path)
    with Image.open(io.BytesIO(jpeg_bytes(str(path), 480))) as image:
        assert image.format == "JPEG"
        assert max(image.size) == 480
```

- [ ] **Step 4: Run the tests to confirm they fail**

Run: `.venv/bin/python -m pytest tests/test_store.py tests/test_media.py -q`
Expected: collection errors, `ModuleNotFoundError: No module named 'server'`.

- [ ] **Step 5: Implement**

`server/__init__.py`: an empty file.

`server/store.py`:
```python
"""Thread-safe in-memory store with idle expiry and a size cap (oldest evicted first)."""
import threading
import time
import uuid
from collections import OrderedDict


class TTLStore:
    def __init__(self, ttl_seconds=1800, max_items=50, clock=time.monotonic):
        self._ttl = float(ttl_seconds)
        self._max = int(max_items)
        self._clock = clock
        self._items = OrderedDict()
        self._lock = threading.Lock()

    def put(self, value, key=None):
        key = key or uuid.uuid4().hex
        with self._lock:
            self._purge()
            self._items[key] = (self._clock(), value)
            self._items.move_to_end(key)
            while len(self._items) > self._max:
                self._items.popitem(last=False)
        return key

    def get(self, key):
        with self._lock:
            self._purge()
            item = self._items.get(key)
            if item is None:
                return None
            self._items[key] = (self._clock(), item[1])
            self._items.move_to_end(key)
            return item[1]

    def __len__(self):
        with self._lock:
            self._purge()
            return len(self._items)

    def _purge(self):
        now = self._clock()
        expired = [key for key, (touched, _) in self._items.items() if now - touched > self._ttl]
        for key in expired:
            del self._items[key]
```

`server/media.py`:
```python
"""Encoding helpers shared by the service and the API: WAV, JPEG and waveform envelopes."""
import functools
import io
import re

import numpy as np
import soundfile as sf
from PIL import Image

from utils import safe_audio, to_mono


def slugify(text):
    slug = re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")
    return slug or "sound"


def wav_bytes(x, sr):
    buf = io.BytesIO()
    sf.write(buf, safe_audio(x), int(sr), format="WAV", subtype="PCM_16")
    return buf.getvalue()


def decode_wav(data):
    """Decode WAV bytes to (sample_rate, mono float32 array)."""
    try:
        x, sr = sf.read(io.BytesIO(data), always_2d=False, dtype="float32")
    except Exception as exc:
        raise ValueError("Couldn't read that file.") from exc
    return int(sr), to_mono(np.asarray(x, dtype=np.float32))


def waveform(x, points=300):
    """Min/max envelope in `points` buckets, scaled to [-1, 1] and rounded for compact JSON."""
    x = np.asarray(x, dtype=np.float32).ravel()
    if x.size == 0:
        return [[0.0, 0.0]] * points
    peak = float(np.max(np.abs(x))) or 1.0
    edges = np.linspace(0, x.size, points + 1).astype(int)
    out = []
    for start, end in zip(edges[:-1], edges[1:]):
        start = min(int(start), x.size - 1)
        segment = x[start:max(int(end), start + 1)]
        out.append([round(float(segment.min()) / peak, 3), round(float(segment.max()) / peak, 3)])
    return out


@functools.lru_cache(maxsize=64)
def jpeg_bytes(path, max_side):
    with Image.open(path) as image:
        image = image.convert("RGB")
        image.thumbnail((max_side, max_side))
        buf = io.BytesIO()
        image.save(buf, format="JPEG", quality=82, optimize=True)
    return buf.getvalue()
```

- [ ] **Step 6: Run the tests to confirm they pass**

Run: `.venv/bin/python -m pytest tests/test_store.py tests/test_media.py -q`
Expected: `11 passed`.

- [ ] **Step 7: Commit**

```bash
git add server/__init__.py server/store.py server/media.py tests/conftest.py tests/test_store.py tests/test_media.py requirements-dev.txt
git commit -m "Add in-memory store and media helpers" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 3: Service — library, uploads and mixing

**Files:**
- Create: `server/service.py`
- Test: `tests/test_service.py`

**Interfaces:**
- Consumes (from Task 2): `TTLStore`, `decode_wav`, `slugify`, `waveform`. From `utils.py`: `IMAGE_LIBRARY_DIR`, `MAX_SOURCES`, `SOUND_LIBRARY_DIR`, `SUPPORTED_AUDIO_EXTS`, `load_audio_from_path`, `mix_sources`, `random_mixing`, `speed_resample`, `stack_sources`, `to_mono`.
- Produces:
  - `ServiceError(message, status=400)` with `.message` and `.status`
  - `PartyExpired()`, a subclass with status 410
  - `PartyService(library_dir=SOUND_LIBRARY_DIR, image_dir=IMAGE_LIBRARY_DIR, mixes=None, uploads=None)` with:
    - `.library() -> list[dict]`: `{id, name, duration, image_url|None, preview_url}`
    - `.preview(guest_id) -> (sr, x)`, at most 10 s
    - `.image_path(guest_id) -> Path`, which raises a 404 `ServiceError` if there's no artwork
    - `.add_source(filename, data: bytes) -> dict`: same shape as a library item, `id` starts with `upload-`
    - `.mix(guests, seed=0, difficulty=5.0, conditioning="linear", microphones=None, noise=0.0) -> dict`: `{mix_id, sample_rate, cond_A, matrix_A, guests:[{id,name}], microphones:[{index, audio_url, waveform}]}`
    - `.clip(mix_id, clip) -> (sr, x)`
  - Clip names: `mic-{i}`, `orig-{j}`, later `rec-{j}` and `noise-{k}`.
  - Audio URLs: `/api/audio/{mix_id}/{clip}.wav?v={run}`.

- [ ] **Step 1: Write the failing tests** in `tests/test_service.py`

```python
import numpy as np
import pytest

from server.media import wav_bytes
from server.service import PartyExpired, PartyService, ServiceError


@pytest.fixture
def service(library):
    sounds, images = library
    return PartyService(library_dir=sounds, image_dir=images)


def test_library_lists_guests_with_ids_and_artwork(service):
    lib = service.library()
    assert [g["id"] for g in lib] == ["laplace-noise", "saw-tooth", "square-wave"]
    square = lib[2]
    assert square["name"] == "Square Wave"
    assert square["duration"] == 8.0
    assert square["image_url"] == "/api/media/thumb/square-wave"
    assert square["preview_url"] == "/api/media/preview/square-wave"
    assert lib[0]["image_url"] is None


def test_preview_is_at_most_ten_seconds(service):
    up = service.add_source("Long.wav", wav_bytes(np.sin(np.linspace(0, 9000, 16000 * 20)), 16000))
    sr, x = service.preview(up["id"])
    assert sr == 16000 and len(x) == 160000


def test_image_path_requires_artwork(service):
    assert service.image_path("square-wave").name == "Square Wave.png"
    with pytest.raises(ServiceError, match="No artwork"):
        service.image_path("saw-tooth")


def test_add_source_accepts_wav_and_trims_to_30_seconds(service):
    x = np.sin(np.linspace(0, 4000, 16000 * 40)).astype(np.float32)
    src = service.add_source("My Voice.wav", wav_bytes(x, 16000))
    assert src["id"].startswith("upload-")
    assert src["name"] == "My Voice"
    assert src["duration"] == 30.0
    assert src["image_url"] is None


def test_add_source_rejects_garbage(service):
    with pytest.raises(ServiceError, match="Couldn't read"):
        service.add_source("x.wav", b"nope")


def test_add_source_rejects_very_short_sounds(service):
    with pytest.raises(ServiceError, match="too short"):
        service.add_source("blip.wav", wav_bytes(np.ones(100), 16000))


def test_mix_returns_one_microphone_per_guest_by_default(service):
    out = service.mix([{"id": "square-wave"}, {"id": "laplace-noise"}])
    assert len(out["microphones"]) == 2
    assert np.array(out["matrix_A"]).shape == (2, 2)
    assert out["microphones"][0]["audio_url"] == f"/api/audio/{out['mix_id']}/mic-0.wav?v=0"
    assert len(out["microphones"][0]["waveform"]) == 300
    assert out["guests"] == [{"id": "square-wave", "name": "Square Wave"}, {"id": "laplace-noise", "name": "Laplace Noise"}]
    assert out["sample_rate"] == 16000


def test_mix_adds_a_microphone_when_noise_is_on(service):
    out = service.mix([{"id": "square-wave"}, {"id": "laplace-noise"}], noise=0.05)
    assert len(out["microphones"]) == 3


def test_mix_with_explicit_microphones(service):
    out = service.mix([{"id": "square-wave"}, {"id": "laplace-noise"}], microphones=3)
    assert np.array(out["matrix_A"]).shape == (3, 2)


@pytest.mark.parametrize(
    "guests,kwargs,message",
    [
        ([{"id": "square-wave"}], {}, "at least 2"),
        ([{"id": "square-wave"}, {"id": "nope"}], {}, "Unknown guest"),
        ([{"id": "square-wave"}, {"id": "square-wave"}], {}, "only be invited once"),
        ([{"id": "square-wave", "speed": 0}, {"id": "saw-tooth"}], {}, "greater than 0"),
        ([{"id": "square-wave"}, {"id": "saw-tooth"}, {"id": "laplace-noise"}], {"microphones": 2}, "at least as many microphones"),
        ([{"id": "square-wave"}, {"id": "saw-tooth"}], {"microphones": 21}, "at most 20 microphones"),
    ],
)
def test_mix_rejects_bad_input(service, guests, kwargs, message):
    with pytest.raises(ServiceError, match=message):
        service.mix(guests, **kwargs)


def test_mix_accepts_uploaded_guest(service):
    up = service.add_source("Hum.wav", wav_bytes(np.sin(np.linspace(0, 3000, 16000 * 8)), 16000))
    out = service.mix([{"id": up["id"]}, {"id": "square-wave"}])
    assert [g["name"] for g in out["guests"]] == ["Hum", "Square Wave"]


def test_clip_returns_microphone_and_original_audio(service):
    out = service.mix([{"id": "square-wave"}, {"id": "laplace-noise"}])
    sr, x = service.clip(out["mix_id"], "mic-1")
    assert sr == 16000 and x.shape == (128000,)
    _, original = service.clip(out["mix_id"], "orig-0")
    assert original.shape == (128000,)
    with pytest.raises(ServiceError, match="Unknown clip"):
        service.clip(out["mix_id"], "rec-0")


def test_unknown_mix_raises_party_expired(service):
    with pytest.raises(PartyExpired):
        service.clip("missing", "mic-0")
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `.venv/bin/python -m pytest tests/test_service.py -q`
Expected: collection error, `ModuleNotFoundError: No module named 'server.service'`.

- [ ] **Step 3: Implement `server/service.py`.** It also contains the imports that Task 4's `unmix` uses.

```python
"""Mix and unmix logic behind the API. Plain Python: no web framework imports."""
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np

from ica_core import SVDinit, QRT_shifted
from ica_evaluate import evaluate_ica
from server.media import decode_wav, slugify, waveform
from server.store import TTLStore
from utils import (
    IMAGE_LIBRARY_DIR,
    MAX_SOURCES,
    SOUND_LIBRARY_DIR,
    SUPPORTED_AUDIO_EXTS,
    _random_orthogonal_matrix,
    _select_best_candidates_global,
    load_audio_from_path,
    mix_sources,
    normalize,
    random_mixing,
    select_components_by_knee,
    speed_resample,
    stack_sources,
    stft_wiener_denoise_matrix,
    to_mono,
)

TARGET_SR = 16000
MIX_SECONDS = 8.0
PREVIEW_SECONDS = 10.0
UPLOAD_MAX_SECONDS = 30.0
UPLOAD_MIN_SECONDS = 0.5
UPLOAD_MAX_BYTES = 10 * 1024 * 1024
FOUND_THRESHOLD = 0.8
DIAGNOSTIC_POINTS = 200


class ServiceError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


class PartyExpired(ServiceError):
    def __init__(self):
        super().__init__("This party ended — start it again.", status=410)


@dataclass(frozen=True)
class Guest:
    id: str
    name: str
    audio_path: Path
    image_path: Optional[Path]


class PartyService:
    def __init__(self, library_dir=SOUND_LIBRARY_DIR, image_dir=IMAGE_LIBRARY_DIR, mixes=None, uploads=None):
        self.library_dir = Path(library_dir)
        self.image_dir = Path(image_dir)
        self.mixes = mixes or TTLStore()
        self.uploads = uploads or TTLStore(max_items=200)
        self._guests = self._scan_library()
        self._audio_cache = {}

    # ── library ────────────────────────────────────────────────────────
    def _scan_library(self):
        guests = {}
        if not self.library_dir.exists():
            return guests
        for path in sorted(self.library_dir.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in SUPPORTED_AUDIO_EXTS:
                continue
            rel = path.relative_to(self.library_dir)
            image = (self.image_dir / rel).with_suffix(".png")
            guest_id = slugify(rel.with_suffix("").as_posix())
            guests[guest_id] = Guest(guest_id, path.stem, path, image if image.exists() else None)
        return guests

    def _guest(self, guest_id):
        guest = self._guests.get(guest_id)
        if guest is None:
            raise ServiceError(f"Unknown guest '{guest_id}'.", status=404)
        return guest

    def guest_audio(self, guest_id):
        """Mono float32 audio for a library guest or an upload."""
        if guest_id.startswith("upload-"):
            item = self.uploads.get(guest_id)
            if item is None:
                raise ServiceError("That uploaded sound expired — add it again.", status=410)
            return item["sr"], item["x"]
        if guest_id not in self._audio_cache:
            sr, x = load_audio_from_path(self._guest(guest_id).audio_path)
            self._audio_cache[guest_id] = (int(sr), to_mono(np.asarray(x)).astype(np.float32))
        return self._audio_cache[guest_id]

    def _display_name(self, guest_id):
        if guest_id.startswith("upload-"):
            item = self.uploads.get(guest_id)
            return item["name"] if item else "Your sound"
        return self._guest(guest_id).name

    def _describe(self, guest_id, name, image_url):
        sr, x = self.guest_audio(guest_id)
        return {
            "id": guest_id,
            "name": name,
            "duration": round(len(x) / sr, 1),
            "image_url": image_url,
            "preview_url": f"/api/media/preview/{guest_id}",
        }

    def library(self):
        return [
            self._describe(g.id, g.name, f"/api/media/thumb/{g.id}" if g.image_path else None)
            for g in self._guests.values()
        ]

    def preview(self, guest_id):
        sr, x = self.guest_audio(guest_id)
        return sr, x[: int(sr * PREVIEW_SECONDS)]

    def image_path(self, guest_id):
        guest = self._guest(guest_id)
        if guest.image_path is None:
            raise ServiceError("No artwork for this guest.", status=404)
        return guest.image_path

    def add_source(self, filename, data):
        if len(data) > UPLOAD_MAX_BYTES:
            raise ServiceError("That file is too large (max 10 MB).")
        try:
            sr, x = decode_wav(data)
        except ValueError as exc:
            raise ServiceError(str(exc)) from None
        if x.size < sr * UPLOAD_MIN_SECONDS:
            raise ServiceError("That sound is too short (min 0.5 s).")
        x = x[: int(sr * UPLOAD_MAX_SECONDS)]
        name = (Path(filename or "").stem or "Your sound")[:60]
        guest_id = f"upload-{uuid.uuid4().hex[:12]}"
        self.uploads.put({"name": name, "sr": sr, "x": x}, key=guest_id)
        return self._describe(guest_id, name, None)

    # ── mixing ─────────────────────────────────────────────────────────
    @staticmethod
    def _clip_url(mix_id, clip, run):
        return f"/api/audio/{mix_id}/{clip}.wav?v={run}"

    def _entry(self, mix_id):
        entry = self.mixes.get(mix_id)
        if entry is None:
            raise PartyExpired()
        return entry

    def mix(self, guests, seed=0, difficulty=5.0, conditioning="linear", microphones=None, noise=0.0):
        if len(guests) < 2:
            raise ServiceError("Invite at least 2 guests.")
        if len(guests) > MAX_SOURCES:
            raise ServiceError(f"Invite at most {MAX_SOURCES} guests.")
        ids = [str(g["id"]) for g in guests]
        if len(set(ids)) != len(ids):
            raise ServiceError("Each guest can only be invited once.")

        audio, names = [], []
        for guest in guests:
            speed = float(guest.get("speed", 1.0))
            if speed <= 0:
                raise ServiceError("Speed must be greater than 0.")
            sr, x = self.guest_audio(guest["id"])
            audio.append((sr, speed_resample(x, speed)))
            names.append(self._display_name(guest["id"]))

        S, sr = stack_sources(audio, target_sr=TARGET_SR, max_seconds=MIX_SECONDS)
        n_sources = S.shape[0]
        noise = float(noise)
        if microphones is None:
            n_mics = n_sources + (1 if noise > 0 else 0)
        else:
            n_mics = int(microphones)
        if n_mics < n_sources:
            raise ServiceError(f"Use at least as many microphones as guests ({n_sources}).")
        if n_mics > MAX_SOURCES:
            raise ServiceError(f"Use at most {MAX_SOURCES} microphones.")

        A = random_mixing(
            n_sources=n_sources,
            n_mixtures=n_mics,
            seed=int(seed),
            difficulty=float(difficulty),
            conditioning_mode=conditioning,
        )
        X = mix_sources(A, S, noise_std=noise, seed=int(seed))
        singular_values = np.linalg.svd(A, compute_uv=False)
        cond_A = float(singular_values[0] / max(singular_values[-1], 1e-12))

        clips = {f"mic-{i}": X[i] for i in range(n_mics)}
        clips.update({f"orig-{j}": S[j] for j in range(n_sources)})
        entry = {
            "S": S, "A": A, "X": X, "sr": int(sr),
            "guest_ids": ids, "names": names,
            "noise": noise > 0, "run": 0, "clips": clips,
        }
        mix_id = self.mixes.put(entry)
        return {
            "mix_id": mix_id,
            "sample_rate": int(sr),
            "cond_A": round(cond_A, 3),
            "matrix_A": np.round(A, 3).tolist(),
            "guests": [{"id": i, "name": n} for i, n in zip(ids, names)],
            "microphones": [
                {"index": i, "audio_url": self._clip_url(mix_id, f"mic-{i}", 0), "waveform": waveform(X[i])}
                for i in range(n_mics)
            ],
        }

    def clip(self, mix_id, clip):
        entry = self._entry(mix_id)
        x = entry["clips"].get(clip)
        if x is None:
            raise ServiceError("Unknown clip.", status=404)
        return entry["sr"], x
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `.venv/bin/python -m pytest tests/test_service.py -q`
Expected: `18 passed`.

- [ ] **Step 5: Commit**

```bash
git add server/service.py tests/test_service.py
git commit -m "Add party service: library, uploads and mixing" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Service — unmixing

**Files:**
- Modify: `server/service.py`: add the `unmix` method at the end of `PartyService`, and the `_sign_align` function at the end of the module
- Test: `tests/test_unmix.py`

**Interfaces:**
- Consumes (from Task 3): `PartyService`, `_entry`, `_clip_url`, the entry dict (`S`, `A`, `X`, `sr`, `guest_ids`, `names`, `noise`, `run`, `clips`), and the constants `FOUND_THRESHOLD = 0.8` and `DIAGNOSTIC_POINTS = 200`.
- Produces: `PartyService.unmix(mix_id, iterations=150, tolerance=1e-6, auto_pca=True, denoise_mixtures=True, denoise_estimates=False, wiener_strength=0.55, restarts=False) -> dict`:
  ```
  {
    "summary": {"found", "total", "mean_match", "amari" (float|None), "iterations", "components_used", "seconds"},
    "voices": [{"guest_id", "name", "match", "original_url", "recovered_url", "waveform_original", "waveform_recovered"}],
    "unmatched": [{"index", "recovered_url", "waveform"}],
    "diagnostics": {"convergence": [float], "matrix_A": [[float]],
                    "waveforms": {"sources": [...], "mixtures": [...], "estimates": [...]},
                    "pairs": [{"estimate", "guest" (str|None), "match" (float|None)}],
                    "settings": {"iterations", "tolerance", "auto_pca", "denoise_mixtures",
                                 "denoise_estimates", "wiener_strength", "restarts", "noise"}}
  }
  ```
  Each unmix increments the entry's `run`, which is used as the `?v=` cache-buster in URLs.

- [ ] **Step 1: Write the failing tests** in `tests/test_unmix.py`

```python
import pytest

from server.service import PartyExpired, PartyService

TWO = [{"id": "square-wave"}, {"id": "laplace-noise"}]


@pytest.fixture
def service(library):
    sounds, images = library
    return PartyService(library_dir=sounds, image_dir=images)


def test_unmix_recovers_a_well_conditioned_two_guest_mix(service):
    mix = service.mix(TWO, difficulty=1)
    out = service.unmix(mix["mix_id"], denoise_mixtures=False)
    summary = out["summary"]
    assert summary["total"] == 2
    assert summary["mean_match"] > 0.9
    assert summary["found"] == 2
    assert summary["amari"] is not None
    assert {v["guest_id"] for v in out["voices"]} == {"square-wave", "laplace-noise"}
    assert out["voices"][0]["recovered_url"].endswith("?v=1")
    assert out["unmatched"] == []


def test_unmix_with_default_settings_runs(service):
    mix = service.mix(TWO)
    out = service.unmix(mix["mix_id"])
    assert len(out["voices"]) == 2
    assert out["diagnostics"]["settings"]["denoise_mixtures"] is True


def test_recovered_audio_is_available_as_a_clip(service):
    mix = service.mix(TWO, difficulty=1)
    service.unmix(mix["mix_id"], denoise_mixtures=False)
    sr, x = service.clip(mix["mix_id"], "rec-0")
    assert sr == 16000 and x.shape == (128000,)


def test_extra_microphone_produces_an_unmatched_component(service):
    mix = service.mix(TWO, microphones=3, difficulty=1)
    out = service.unmix(mix["mix_id"], auto_pca=False, denoise_mixtures=False)
    assert len(out["unmatched"]) == 1
    assert out["summary"]["amari"] is None  # A is 3x2, not square
    assert len(out["diagnostics"]["pairs"]) == 3
    assert sum(p["guest"] is None for p in out["diagnostics"]["pairs"]) == 1
    service.clip(mix["mix_id"], f"noise-{out['unmatched'][0]['index']}")


def test_restarts_match_every_guest_and_skip_amari(service):
    mix = service.mix(TWO, difficulty=1)
    out = service.unmix(mix["mix_id"], restarts=True, denoise_mixtures=False)
    assert out["summary"]["amari"] is None
    assert len(out["voices"]) == 2
    assert out["unmatched"] == []
    assert out["summary"]["mean_match"] > 0.9


def test_diagnostics_have_compact_waveforms(service):
    mix = service.mix(TWO, difficulty=1)
    d = service.unmix(mix["mix_id"], denoise_mixtures=False)["diagnostics"]
    assert len(d["waveforms"]["sources"]) == 2
    assert len(d["waveforms"]["sources"][0]) == 200
    assert len(d["waveforms"]["mixtures"]) == 2
    assert len(d["convergence"]) >= 1
    assert len(d["matrix_A"]) == 2


def test_second_unmix_bumps_the_cache_buster(service):
    mix = service.mix(TWO, difficulty=1)
    service.unmix(mix["mix_id"], denoise_mixtures=False)
    out = service.unmix(mix["mix_id"], denoise_mixtures=False)
    assert out["voices"][0]["recovered_url"].endswith("?v=2")


def test_unmix_of_unknown_mix_raises_party_expired(service):
    with pytest.raises(PartyExpired):
        service.unmix("missing")
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `.venv/bin/python -m pytest tests/test_unmix.py -q`
Expected: `AttributeError: 'PartyService' object has no attribute 'unmix'` in every test.

- [ ] **Step 3: Implement.** This is `run_demo` from the original `utils.py`, with the Gradio output replaced by plain data; the numerical steps and their order are identical. Add the method at the end of the `PartyService` class:

```python
    # ── unmixing ───────────────────────────────────────────────────────
    def unmix(self, mix_id, iterations=150, tolerance=1e-6, auto_pca=True, denoise_mixtures=True,
              denoise_estimates=False, wiener_strength=0.55, restarts=False):
        entry = self._entry(mix_id)
        started = time.perf_counter()
        S, A, X = entry["S"], entry["A"], entry["X"]
        n_sources, n_components = S.shape[0], X.shape[0]
        wiener_strength = float(np.clip(float(wiener_strength), 0.0, 1.0))

        X_proc = stft_wiener_denoise_matrix(X, strength=wiener_strength) if denoise_mixtures else X
        if auto_pca:
            r_knee = select_components_by_knee(X_proc, r_max=n_components)
            r_used = r_knee + 1 if (r_knee + 1) <= n_components else r_knee
        else:
            r_used = n_components
        Z = SVDinit(X_proc, R=r_used, removemean=True)[2]

        rng = np.random.default_rng(20260317)
        runs = []
        for _ in range(5 if restarts else 1):
            Q0 = _random_orthogonal_matrix(r_used, rng) if restarts else None
            S_est, Q, err, n_last = QRT_shifted(
                np.copy(Z), n_iter=int(iterations), shift=None, shift_from="gram",
                return_Q=True, tol=float(tolerance), Q0=Q0,
            )
            S_eval = stft_wiener_denoise_matrix(S_est, strength=wiener_strength) if denoise_estimates else S_est
            score = evaluate_ica(S, S_eval, W=None, A=None, verbose=False).get("mean_corr", np.nan)
            runs.append({
                "est": np.asarray(S_eval, dtype=np.float32), "err": np.asarray(err),
                "iters": int(n_last), "Q": np.asarray(Q), "score": float(score),
            })
        best = runs[int(np.nanargmax([r["score"] for r in runs]))]

        if restarts:
            candidates = np.vstack([r["est"] for r in runs])
            selected, _, corrs = _select_best_candidates_global(S, candidates)
            recovered = np.stack([normalize(_sign_align(S[i], selected[i])) for i in range(n_sources)])
            estimates = np.stack([normalize(ch) for ch in selected])
            est_to_true = list(range(n_sources))
            amari = None
        else:
            est = best["est"]
            use_amari = A.shape[0] == A.shape[1] == best["Q"].shape[0]
            res = evaluate_ica(
                S, est,
                W=best["Q"] if use_amari else None,
                A=A if use_amari else None,
                verbose=False,
            )
            corrs = np.asarray(res["correlations"], dtype=float)
            recovered = np.stack([normalize(ch) for ch in res["S_matched"]])
            estimates = np.stack([normalize(ch) for ch in est])
            est_to_true = [-1] * estimates.shape[0]
            for true_i, est_i in enumerate(np.asarray(res["permutation"], dtype=int)):
                if 0 <= est_i < len(est_to_true):
                    est_to_true[est_i] = true_i
            amari = float(res["amari_index"]) if use_amari else None

        entry["run"] += 1
        run = entry["run"]
        clips = entry["clips"]
        for key in [k for k in clips if k.startswith(("rec-", "noise-"))]:
            del clips[key]

        voices = []
        for i in range(n_sources):
            clips[f"rec-{i}"] = recovered[i]
            voices.append({
                "guest_id": entry["guest_ids"][i],
                "name": entry["names"][i],
                "match": round(float(corrs[i]), 4),
                "original_url": self._clip_url(mix_id, f"orig-{i}", run),
                "recovered_url": self._clip_url(mix_id, f"rec-{i}", run),
                "waveform_original": waveform(S[i]),
                "waveform_recovered": waveform(recovered[i]),
            })

        unmatched = []
        for est_i, true_i in enumerate(est_to_true):
            if true_i >= 0:
                continue
            clips[f"noise-{est_i}"] = estimates[est_i]
            unmatched.append({
                "index": est_i,
                "recovered_url": self._clip_url(mix_id, f"noise-{est_i}", run),
                "waveform": waveform(estimates[est_i]),
            })

        points = DIAGNOSTIC_POINTS
        return {
            "summary": {
                "found": int(np.sum(np.asarray(corrs) >= FOUND_THRESHOLD)),
                "total": n_sources,
                "mean_match": round(float(np.mean(corrs)), 4) if len(corrs) else 0.0,
                "amari": None if amari is None else round(amari, 4),
                "iterations": best["iters"],
                "components_used": int(r_used),
                "seconds": round(time.perf_counter() - started, 2),
            },
            "voices": voices,
            "unmatched": unmatched,
            "diagnostics": {
                "convergence": [round(float(e), 6) for e in best["err"]],
                "matrix_A": np.round(A, 3).tolist(),
                "waveforms": {
                    "sources": [waveform(s, points) for s in S],
                    "mixtures": [waveform(x, points) for x in X_proc],
                    "estimates": [waveform(e, points) for e in estimates],
                },
                "pairs": [
                    {
                        "estimate": est_i,
                        "guest": entry["names"][t] if t >= 0 else None,
                        "match": round(float(corrs[t]), 4) if t >= 0 else None,
                    }
                    for est_i, t in enumerate(est_to_true)
                ],
                "settings": {
                    "iterations": int(iterations), "tolerance": float(tolerance),
                    "auto_pca": bool(auto_pca), "denoise_mixtures": bool(denoise_mixtures),
                    "denoise_estimates": bool(denoise_estimates), "wiener_strength": wiener_strength,
                    "restarts": bool(restarts), "noise": bool(entry["noise"]),
                },
            },
        }
```

Add at the end of the module, outside the class:

```python
def _sign_align(reference, estimate):
    """ICA recovers sources up to sign; flip `estimate` to correlate positively with `reference`."""
    ref = reference - np.mean(reference)
    est = estimate - np.mean(estimate)
    return estimate if float(np.dot(ref, est)) >= 0 else -estimate
```

- [ ] **Step 4: Run all backend tests**

Run: `.venv/bin/python -m pytest -q`
Expected: `37 passed`. If a separation-quality assertion (`> 0.9`) fails, print `out["summary"]` and investigate, starting with the synthetic signals in `tests/conftest.py`. Do not loosen the ICA code.

- [ ] **Step 5: Commit**

```bash
git add server/service.py tests/test_unmix.py
git commit -m "Add unmixing to the party service" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 5: JSON API, new entry point, and removing the Gradio UI

**Files:**
- Create: `server/api.py`, `tests/test_api.py`, `tests/test_utils.py`, `web/index.html` (a placeholder; Task 6 replaces it)
- Rewrite: `app.py`, `requirements.txt`
- Modify: `utils.py` (remove the Gradio and plotting code), `README.md` (add a "Run locally" section)
- Delete: `ui.py`, `styles.css`

**Interfaces:**
- Consumes: `PartyService`, `ServiceError` (Tasks 3–4), `jpeg_bytes` and `wav_bytes` (Task 2).
- Produces: `create_app(service=None, web_dir=WEB_DIR, showcase_dir=SHOWCASE_DIR) -> FastAPI` with these routes:
  - `GET /api/library`
  - `GET /api/media/thumb/{guest_id}` (JPEG, 480 px)
  - `GET /api/media/preview/{guest_id}` (WAV)
  - `GET /api/media/image/{name}` for the About images `bss-infographic`, `ica-pipeline` and `qr-t-algorithm` (JPEG, 1400 px)
  - `GET /api/media/showcase/{name}`, where the name matches `^(mixture|pca|ica)_[1-3]$`
  - `POST /api/sources` (multipart field `file`)
  - `POST /api/mix`
  - `POST /api/unmix`
  - `GET /api/audio/{mix_id}/{clip}.wav`
  - static files from `web/` at `/`

- [ ] **Step 1: Write the failing tests**

`tests/test_api.py`:
```python
import io

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from server.api import create_app
from server.media import wav_bytes
from server.service import PartyService


@pytest.fixture
def client(library, tmp_path):
    sounds, images = library
    web = tmp_path / "web"
    web.mkdir()
    (web / "index.html").write_text("<title>The Cocktail Party</title>")
    return TestClient(create_app(PartyService(library_dir=sounds, image_dir=images), web_dir=web, showcase_dir=tmp_path))


def hum():
    return wav_bytes(np.sin(np.linspace(0, 3000, 16000 * 8)), 16000)


def test_index_is_served(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "The Cocktail Party" in response.text


def test_library(client):
    response = client.get("/api/library")
    assert response.status_code == 200
    assert [g["id"] for g in response.json()] == ["laplace-noise", "saw-tooth", "square-wave"]


def test_thumbnail_is_jpeg(client):
    response = client.get("/api/media/thumb/square-wave")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"


def test_missing_artwork_is_404_with_message(client):
    response = client.get("/api/media/thumb/saw-tooth")
    assert response.status_code == 404
    assert response.json() == {"error": "No artwork for this guest."}


def test_preview_is_wav(client):
    response = client.get("/api/media/preview/square-wave")
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/wav"
    x, sr = sf.read(io.BytesIO(response.content))
    assert sr == 16000 and len(x) <= 160000


def test_upload_mix_unmix_and_play(client):
    upload = client.post("/api/sources", files={"file": ("Hum.wav", hum(), "audio/wav")})
    assert upload.status_code == 200
    mix = client.post("/api/mix", json={"guests": [{"id": upload.json()["id"]}, {"id": "square-wave"}], "difficulty": 1})
    assert mix.status_code == 200
    result = client.post("/api/unmix", json={"mix_id": mix.json()["mix_id"], "denoise_mixtures": False})
    assert result.status_code == 200
    voices = result.json()["voices"]
    assert len(voices) == 2
    audio = client.get(voices[0]["recovered_url"])
    assert audio.status_code == 200
    assert audio.headers["content-type"] == "audio/wav"


def test_undecodable_upload_is_400(client):
    response = client.post("/api/sources", files={"file": ("x.wav", b"nope", "audio/wav")})
    assert response.status_code == 400
    assert "Couldn't read" in response.json()["error"]


def test_validation_errors_are_400_with_message(client):
    response = client.post("/api/mix", json={"guests": [], "difficulty": 500})
    assert response.status_code == 400
    assert "difficulty" in response.json()["error"]


def test_service_errors_are_400_with_message(client):
    response = client.post("/api/mix", json={"guests": [{"id": "square-wave"}]})
    assert response.status_code == 400
    assert response.json() == {"error": "Invite at least 2 guests."}


def test_unknown_mix_is_410(client):
    assert client.post("/api/unmix", json={"mix_id": "nope"}).status_code == 410
    assert client.get("/api/audio/nope/mic-0.wav").status_code == 410


def test_unknown_about_image_is_404(client):
    assert client.get("/api/media/image/secret").status_code == 404


def test_showcase_rejects_unknown_names(client):
    assert client.get("/api/media/showcase/secret").status_code == 404
```

`tests/test_utils.py`:
```python
import numpy as np
import pytest

import utils


def test_utils_no_longer_depends_on_gradio():
    assert not hasattr(utils, "gr")
    assert not hasattr(utils, "run_demo")


def test_speed_resample_rejects_non_positive_speed():
    with pytest.raises(ValueError, match="greater than 0"):
        utils.speed_resample(np.ones(10), 0)
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `.venv/bin/python -m pytest tests/test_api.py tests/test_utils.py -q`
Expected: `ModuleNotFoundError: No module named 'server.api'`, and `test_utils_no_longer_depends_on_gradio` fails.

- [ ] **Step 3: Implement `server/api.py`**

```python
"""HTTP layer: request validation, JSON errors and static files. All logic lives in PartyService."""
import re
from typing import List, Literal, Optional

from fastapi import FastAPI, File, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from server.media import jpeg_bytes, wav_bytes
from server.service import PartyService, ServiceError
from utils import MAX_SOURCES, ROOT

WEB_DIR = ROOT / "web"
SHOWCASE_DIR = ROOT / "data" / "stored_results"
ABOUT_IMAGES = {
    "bss-infographic": "BSS infographic.png",
    "ica-pipeline": "ICA pipeline.png",
    "qr-t-algorithm": "QR-T algorithm.png",
}
SHOWCASE_NAME = re.compile(r"^(mixture|pca|ica)_[1-3]$")
CACHE_DAY = {"Cache-Control": "public, max-age=86400"}


class GuestIn(BaseModel):
    id: str
    speed: float = Field(1.0, gt=0, le=4)


class MixIn(BaseModel):
    guests: List[GuestIn]
    seed: int = Field(0, ge=0)
    difficulty: float = Field(5.0, ge=1, le=100)
    conditioning: Literal["linear", "geometric"] = "linear"
    microphones: Optional[int] = Field(None, ge=2, le=MAX_SOURCES)
    noise: float = Field(0.0, ge=0, le=0.2)


class UnmixIn(BaseModel):
    mix_id: str
    iterations: int = Field(150, ge=10, le=500)
    tolerance: float = Field(1e-6, gt=0, le=1e-2)
    auto_pca: bool = True
    denoise_mixtures: bool = True
    denoise_estimates: bool = False
    wiener_strength: float = Field(0.55, ge=0, le=1)
    restarts: bool = False


def create_app(service=None, web_dir=WEB_DIR, showcase_dir=SHOWCASE_DIR):
    service = service or PartyService()
    app = FastAPI(title="The Cocktail Party", docs_url=None, redoc_url=None, openapi_url=None)

    @app.exception_handler(ServiceError)
    async def service_error(_request, exc):
        return JSONResponse({"error": exc.message}, status_code=exc.status)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_request, exc):
        errors = exc.errors()
        first = errors[0] if errors else {}
        field = ".".join(str(part) for part in first.get("loc", ())[1:]) or "request"
        return JSONResponse({"error": f"Invalid {field}: {first.get('msg', 'bad value')}."}, status_code=400)

    @app.exception_handler(Exception)
    async def unexpected_error(_request, _exc):
        return JSONResponse({"error": "Something went wrong on the server. Please try again."}, status_code=500)

    @app.get("/api/library")
    def library():
        return service.library()

    @app.get("/api/media/thumb/{guest_id}")
    def thumbnail(guest_id: str):
        data = jpeg_bytes(str(service.image_path(guest_id)), 480)
        return Response(data, media_type="image/jpeg", headers=CACHE_DAY)

    @app.get("/api/media/preview/{guest_id}")
    def preview(guest_id: str):
        sr, x = service.preview(guest_id)
        return Response(wav_bytes(x, sr), media_type="audio/wav", headers=CACHE_DAY)

    @app.get("/api/media/image/{name}")
    def about_image(name: str):
        filename = ABOUT_IMAGES.get(name)
        path = service.image_dir / filename if filename else None
        if path is None or not path.exists():
            raise ServiceError("Image not found.", status=404)
        return Response(jpeg_bytes(str(path), 1400), media_type="image/jpeg", headers=CACHE_DAY)

    @app.get("/api/media/showcase/{name}")
    def showcase(name: str):
        path = showcase_dir / f"{name}.wav"
        if not SHOWCASE_NAME.match(name) or not path.exists():
            raise ServiceError("Recording not found.", status=404)
        return FileResponse(path, media_type="audio/wav", headers=CACHE_DAY)

    @app.post("/api/sources")
    def add_source(file: UploadFile = File(...)):
        return service.add_source(file.filename or "Your sound", file.file.read())

    @app.post("/api/mix")
    def mix(body: MixIn):
        return service.mix(
            [guest.model_dump() for guest in body.guests],
            seed=body.seed,
            difficulty=body.difficulty,
            conditioning=body.conditioning,
            microphones=body.microphones,
            noise=body.noise,
        )

    @app.post("/api/unmix")
    def unmix(body: UnmixIn):
        return service.unmix(**body.model_dump())

    @app.get("/api/audio/{mix_id}/{clip}.wav")
    def audio(mix_id: str, clip: str):
        sr, x = service.clip(mix_id, clip)
        return Response(wav_bytes(x, sr), media_type="audio/wav", headers={"Cache-Control": "private, max-age=1800"})

    app.mount("/", StaticFiles(directory=str(web_dir), html=True), name="web")
    return app
```

- [ ] **Step 4: Rewrite `app.py`**

```python
"""Hugging Face Space entry point: serves the web app and its JSON API (port 7860 by default)."""
import os

import uvicorn

from server.api import create_app

app = create_app()

if __name__ == "__main__":
    uvicorn.run(app, host=os.environ.get("HOST", "0.0.0.0"), port=int(os.environ.get("PORT", "7860")))
```

Create the placeholder `web/index.html`:
```html
<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>The Cocktail Party</title></head>
<body><p>The Cocktail Party is being rebuilt.</p></body></html>
```

- [ ] **Step 5: Strip Gradio and plotting code from `utils.py`, keeping CRLF**

Run this script once:
```bash
.venv/bin/python - <<'EOF'
import ast
from pathlib import Path

path = Path("utils.py")
text = path.read_bytes().decode("utf-8")
assert "\r\n" in text, "utils.py is expected to use CRLF"
lines = text.splitlines(keepends=True)
remove = {
    "_write_temp_wav", "fig_waveforms", "fig_convergence", "parse_uploaded_paths", "parse_recorded_path",
    "list_library_files", "build_source_table", "build_tile_preview", "build_tile_thumbnail_data_uri",
    "build_tile_media_html", "build_tile_row_background_html", "build_tile_background_value",
    "_iter_source_rows", "build_pair_markdown", "_build_mixture_tile_html", "_build_mixture_gallery_html",
    "mix_sources_step", "run_demo",
}
spans = []
for node in ast.parse(text).body:
    if isinstance(node, ast.FunctionDef) and node.name in remove:
        start = (node.decorator_list[0].lineno if node.decorator_list else node.lineno) - 1
        spans.append((start, node.end_lineno))
assert len(spans) == len(remove), sorted(remove - {n.name for n in ast.parse(text).body if isinstance(n, ast.FunctionDef)})
for start, end in sorted(spans, reverse=True):
    while end < len(lines) and lines[end].strip() == "":
        end += 1
    del lines[start:end]
text = "".join(lines)
for line in [
    "import base64\r\n", "import functools\r\n", "import html\r\n", "import io\r\n", "import tempfile\r\n",
    "import gradio as gr\r\n", "import matplotlib.pyplot as plt\r\n", "from PIL import Image\r\n",
    "from ica_core import SVDinit, QRT_shifted\r\n", "from ica_evaluate import evaluate_ica\r\n",
]:
    assert line in text, line
    text = text.replace(line, "", 1)
text = text.replace(
    'raise gr.Error("Speed factor must be > 0.")',
    'raise ValueError("Speed must be greater than 0.")',
)
text = text.replace("raise gr.Error(", "raise ValueError(")
assert "gr." not in text and "plt." not in text
path.write_bytes(text.encode("utf-8"))
print("utils.py cleaned")
EOF
```
Expected: `utils.py cleaned`. Check that the file still uses CRLF and only lost what was intended:
```bash
.venv/bin/python -c "import utils; print(sorted(n for n in dir(utils) if not n.startswith('__')))"
git diff --stat utils.py
```
Expected: the names include `MAX_SOURCES`, `load_audio_from_path`, `mix_sources`, `random_mixing`, `safe_audio`, `select_components_by_knee`, `speed_resample`, `stack_sources`, `stft_wiener_denoise_matrix`, `to_mono`, `_random_orthogonal_matrix` and `_select_best_candidates_global`. They must not include `gr`, `plt` or `run_demo`. The diff shows only deletions plus the `ValueError` lines.

- [ ] **Step 6: Delete the old UI and update dependencies and docs**

```bash
git rm -q ui.py styles.css
```

Rewrite `requirements.txt`:
```
numpy
scipy
soundfile
librosa
pillow
fastapi
uvicorn
python-multipart
huggingface_hub==0.35.3
```
The `huggingface_hub` pin stays: it was added for the Gradio SDK runtime, which still installs Gradio.

Append to `README.md` after the existing text:
~~~markdown

## Run locally

```bash
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
git lfs pull                                 # the audio and images are stored in Git LFS
HOST=127.0.0.1 .venv/bin/python app.py      # http://127.0.0.1:7860
.venv/bin/python -m pytest -q               # backend tests
```
~~~

- [ ] **Step 7: Run all the tests and start the app**

Run: `.venv/bin/python -m pytest -q`
Expected: `51 passed`.

Then start the server in the background with `HOST=127.0.0.1 .venv/bin/python app.py`, and check it:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:7860/
curl -s http://127.0.0.1:7860/api/library | .venv/bin/python -c "import sys,json; print(len(json.load(sys.stdin)))"
```
Expected: `200`, then `8`. Stop the server.

- [ ] **Step 8: Commit**

```bash
git add -A server tests web app.py utils.py requirements.txt README.md
git commit -m "Serve a JSON API with FastAPI and remove the Gradio UI" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 6: Page shell, visual system and theme

**Files:**
- Rewrite: `web/index.html`
- Create: `web/app.css`, `web/js/theme.js`, `web/js/main.js`

**Interfaces:**
- Produces the DOM IDs that later tasks rely on:
  - Header: `#open-lab`, `#theme-toggle`
  - Guests: `#guests-meta`, `#guests`, `#guests-error`
  - Room: `#room-meta`, `#room`, `#main-action`, `#remix`, `#action-hint`, `#action-error`
  - Results: `#results-section`, `#results-summary`, `#results`, `#hood`, `#hood-body`, `#how`
  - Lab: `#lab-backdrop`, `#lab`, `#close-lab`, `#reseed`, `#lab-speeds`, `#reset-lab`
  - Lab inputs, all named: `difficulty`, `conditioning` (radios), `microphones`, `noise`, `seed`, `iterations`, `tolerance` (select), `auto_pca`, `denoise_mixtures`, `wiener_strength`, `denoise_estimates`, `restarts`. Each has an `<output data-for="name">` where noted in the markup.
- Produces the CSS classes later tasks render:
  - Guests: `.guest`, `.guest-toggle`, `.guest-art`, `.guest-shade`, `.guest-name`, `.guest-check`, `.is-in`, `.guest-own`, `.own-title`, `.own-actions`, `.own-btn`, `.is-recording`, `.own-status`, `.art-placeholder`, `.visually-hidden`
  - Shared: `.play`, `.is-playing`
  - Room: `.room-empty`, `.room-intro`, `.avatars`, `.avatar`, `.stale-note`, `.is-stale`, `.mics`, `.mic`, `.mic-h`
  - Waveforms: `.wave`, `.wave-fill`, `.wave-ghost`, `.chart`, `.chart-line`, `.chart-axis`
  - Main button: `.btn`, `.is-busy`
  - Results: `.res`, `.res-noise`, `.res-top`, `.res-art`, `.res-name`, `.res-score`, `.seg`, `.seg-btn`
  - Under the hood: `.hood-row`, `.hood-fig`, `.matrix` (cells read the `--a` custom property), `.stack`, `.table`, `.num`, `.details`, `.showcase`
- Theme: `<html data-theme="dark|light">`, saved under the `localStorage` key `cp-theme`, with `?theme=light|dark` taking precedence.

- [ ] **Step 1: Write `web/index.html`**

```html
<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>The Cocktail Party · Blind source separation</title>
  <meta name="description" content="Invite guests, let them all talk at once, then watch ICA pull every voice back out.">
  <script>
    // Choose the theme before first paint: ?theme= wins, then the saved choice, then the system preference.
    (function () {
      var query = new URLSearchParams(location.search).get("theme");
      var saved = null;
      try { saved = localStorage.getItem("cp-theme"); } catch (e) {}
      var system = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
      document.documentElement.dataset.theme = query === "light" || query === "dark" ? query : saved || system;
    })();
  </script>
  <link rel="stylesheet" href="app.css">
  <script type="module" src="js/main.js"></script>
  <!-- Lets the page scroll inside the huggingface.co iframe (recommended by the HF "Custom Python Spaces" docs). -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/iframe-resizer/4.3.2/iframeResizer.contentWindow.min.js" defer></script>
</head>
<body>
  <header class="bar">
    <span class="brand">padenarie / cocktail party</span>
    <nav class="bar-links" aria-label="Page">
      <a class="bar-link" href="#how">How it works</a>
      <button type="button" class="bar-link" id="open-lab" aria-controls="lab" aria-expanded="false">Lab</button>
      <button type="button" class="bar-link" id="theme-toggle" aria-label="Switch theme">☾</button>
    </nav>
  </header>

  <main class="wrap">
    <p class="label">Blind source separation</p>
    <h1>The Cocktail Party</h1>
    <p class="lede">Invite a few guests, let them all talk at once, and listen to what the microphones hear. Then let the algorithm pull every voice back out, with no idea what they sounded like.</p>

    <section aria-labelledby="guests-title">
      <div class="sec-h">
        <h2 class="label" id="guests-title"><span class="idx">01</span>Invite guests</h2>
        <span class="meta" id="guests-meta"></span>
      </div>
      <div class="guests" id="guests"></div>
      <p class="inline-error" id="guests-error" role="alert" hidden></p>
    </section>

    <section aria-labelledby="room-title">
      <div class="sec-h">
        <h2 class="label" id="room-title"><span class="idx">02</span>The room</h2>
        <span class="meta" id="room-meta"></span>
      </div>
      <div class="room" id="room"></div>
      <div class="action-bar">
        <button type="button" class="btn" id="main-action" disabled>Start the party</button>
        <button type="button" class="link" id="remix" hidden>↻ Remix</button>
        <span class="hint" id="action-hint"></span>
      </div>
      <p class="inline-error" id="action-error" role="alert" hidden></p>
    </section>

    <section id="results-section" aria-labelledby="results-title" hidden>
      <div class="sec-h">
        <h2 class="label" id="results-title"><span class="idx">03</span>Voices recovered</h2>
      </div>
      <p class="summary" id="results-summary"></p>
      <div class="results" id="results"></div>
      <details class="fold" id="hood">
        <summary>Under the hood</summary>
        <div class="hood" id="hood-body"></div>
      </details>
    </section>

    <details class="fold" id="how">
      <summary>How does this work?</summary>
      <div class="how">
        <img src="/api/media/image/bss-infographic" alt="Infographic: several people talk at once, several microphones record blends, and blind source separation recovers each voice" loading="lazy">
        <h3>What is happening?</h3>
        <p>Each microphone records a different blend of every guest. Blind source separation recovers the original voices from those blends alone: it never hears the guests on their own, and it doesn't know how the room mixed them.</p>
        <h3>The pipeline</h3>
        <ol>
          <li>The room blends the voices with a random mixing matrix.</li>
          <li>Optionally, a Wiener filter denoises the microphone recordings.</li>
          <li>PCA whitens the recordings and keeps the informative components.</li>
          <li>ICA with the QR-T algorithm rotates them until they are as statistically independent as possible.</li>
          <li>Optionally, the recovered voices are denoised again.</li>
        </ol>
        <img src="/api/media/image/ica-pipeline" alt="Diagram of the ICA pipeline" loading="lazy">
        <h3>The QR-T algorithm</h3>
        <p>QR-T decomposes the fourth-order cumulant tensor of the data implicitly, without ever building that tensor in memory. Each iteration applies a QR-based update, much like the classic QR algorithm for eigenvalues, refining an orthogonal rotation that makes the higher-order statistics diagonal. That drives the outputs towards statistically independent signals while staying cheap to compute.</p>
        <img src="/api/media/image/qr-t-algorithm" alt="The QR-T algorithm" loading="lazy">
        <h3>Speed versus quality</h3>
        <p>In several tests QR-T computed faster than FastICA, though not in every scenario. FastICA can still separate better in some cases, especially with contrast functions such as negentropy, because QR-T is currently kurtosis-based.</p>
        <p class="links">
          <a href="https://github.com/padenarie/Independent-component-analysis-through-implicit-cumulant-tensor-decomposition" target="_blank" rel="noopener">Code on GitHub</a> ·
          <a href="https://github.com/padenarie/Independent-component-analysis-through-implicit-cumulant-tensor-decomposition/blob/main/Pierre_Antoine_Denari___Thesis_FINAL.pdf" target="_blank" rel="noopener">Read the thesis (PDF)</a>
        </p>
      </div>
    </details>
  </main>

  <div class="backdrop" id="lab-backdrop" hidden></div>
  <aside class="drawer" id="lab" role="dialog" aria-modal="true" aria-labelledby="lab-title" hidden>
    <div class="drawer-h">
      <h2 id="lab-title">Lab</h2>
      <button type="button" class="icon-btn" id="close-lab" aria-label="Close the lab">✕</button>
    </div>
    <p class="muted">Good defaults are already set. Change these to stress-test the algorithm.</p>

    <h3 class="label">Mixing</h3>
    <label class="ctl"><span class="ctl-l">Difficulty <output data-for="difficulty"></output></span>
      <input type="range" name="difficulty" min="1" max="100" step="1"></label>
    <div class="ctl"><span class="ctl-l">Conditioning</span>
      <div class="seg" role="radiogroup" aria-label="Conditioning">
        <label><input type="radio" name="conditioning" value="linear"><span>Linear</span></label>
        <label><input type="radio" name="conditioning" value="geometric"><span>Geometric</span></label>
      </div>
    </div>
    <label class="ctl"><span class="ctl-l">Microphones <output data-for="microphones"></output></span>
      <input type="range" name="microphones" min="0" max="20" step="1"></label>
    <label class="ctl"><span class="ctl-l">Background noise <output data-for="noise"></output></span>
      <input type="range" name="noise" min="0" max="0.2" step="0.005"></label>
    <div class="ctl"><span class="ctl-l">Random seed</span>
      <div class="seed">
        <input type="number" name="seed" min="0" step="1" aria-label="Random seed">
        <button type="button" class="icon-btn" id="reseed" aria-label="New random seed">↻</button>
      </div>
    </div>

    <h3 class="label">Unmixing</h3>
    <label class="ctl"><span class="ctl-l">Iterations <output data-for="iterations"></output></span>
      <input type="range" name="iterations" min="10" max="500" step="10"></label>
    <label class="ctl"><span class="ctl-l">Tolerance</span>
      <select name="tolerance">
        <option value="1e-4">1e-4</option>
        <option value="1e-5">1e-5</option>
        <option value="1e-6">1e-6</option>
        <option value="1e-7">1e-7</option>
        <option value="1e-8">1e-8</option>
      </select></label>
    <label class="tog"><span>Auto PCA knee</span><input type="checkbox" name="auto_pca"></label>
    <label class="tog"><span>Denoise mixtures</span><input type="checkbox" name="denoise_mixtures"></label>
    <label class="ctl"><span class="ctl-l">Wiener strength <output data-for="wiener_strength"></output></span>
      <input type="range" name="wiener_strength" min="0" max="1" step="0.05"></label>
    <label class="tog"><span>Denoise estimates</span><input type="checkbox" name="denoise_estimates"></label>
    <label class="tog"><span>Random restarts (5×)</span><input type="checkbox" name="restarts"></label>

    <h3 class="label">Per guest</h3>
    <div id="lab-speeds"></div>
    <button type="button" class="link" id="reset-lab">Reset to defaults</button>
  </aside>
</body>
</html>
```

The original About text ended mid-sentence ("In raw computational performance the algorithm"); that fragment is dropped. The LinkedIn mirror link is also dropped, because it was a long tracking URL; the GitHub thesis link remains.

- [ ] **Step 2: Write `web/app.css`**

```css
/* ── tokens: dark is the default, light mirrors the blog's light theme ── */
:root {
  --accent: #22d3ee;
  --accent-rgb: 34, 211, 238;
  --on-accent: #04121a;
  --bg: #090e15;
  --surface: rgba(148, 163, 184, 0.04);
  --surface-2: rgba(148, 163, 184, 0.08);
  --line: rgba(148, 163, 184, 0.12);
  --grid: rgba(148, 163, 184, 0.035);
  --text: #e6edf3;
  --muted: #8b98a5;
  --faint: #4b5664;
  --wave: #4b5664;
  --wave-strong: #aab6c2;
  --wave-ghost: #1f2935;
  --error: #f0a3a3;
  --art-dim: grayscale(0.9) brightness(0.55);
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  --radius: 10px;
  color-scheme: dark;
}

[data-theme="light"] {
  --accent: #087c92;
  --accent-rgb: 8, 124, 146;
  --on-accent: #ffffff;
  --bg: #f7f9fb;
  --surface: rgba(15, 23, 42, 0.03);
  --surface-2: rgba(15, 23, 42, 0.07);
  --line: #dbe2ea;
  --grid: rgba(15, 23, 42, 0.05);
  --text: #0f172a;
  --muted: #5b6675;
  --faint: #94a3b8;
  --wave: #94a3b8;
  --wave-strong: #334155;
  --wave-ghost: #e2e8f0;
  --error: #b42318;
  --art-dim: grayscale(0.9) brightness(0.8) contrast(0.9);
  color-scheme: light;
}

/* ── base ── */
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background-color: var(--bg);
  background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: 40px 40px;
  color: var(--text);
  font: 15px/1.6 var(--sans);
  -webkit-font-smoothing: antialiased;
}
button { font: inherit; color: inherit; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }
[hidden] { display: none !important; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* ── page frame ── */
.bar { max-width: 1080px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 16px 32px; font-size: 13px; color: var(--muted); }
.bar-links { display: flex; gap: 4px; }
.bar-link { background: none; border: 0; padding: 6px 8px; border-radius: 6px; color: var(--muted); cursor: pointer; font-size: 13px; }
.bar-link:hover { color: var(--text); text-decoration: none; }
.wrap { max-width: 1080px; margin: 0 auto; padding: 24px 32px 64px; }
.label { margin: 0; font: 11px/1.4 var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.label .idx { color: var(--faint); margin-right: 8px; }
h1 { font-size: clamp(28px, 5vw, 38px); line-height: 1.1; margin: 8px 0 10px; font-weight: 700; letter-spacing: -0.015em; }
.lede { color: var(--muted); font-size: 15.5px; max-width: 58ch; margin: 0 0 48px; }
section { margin-bottom: 52px; }
.sec-h { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.meta, .hint, .muted { font-size: 13px; color: var(--muted); }
.hint:empty { display: none; }
.inline-error { color: var(--error); font-size: 13.5px; margin: 12px 0 0; }

/* ── shared play button ── */
.play { width: 28px; height: 28px; flex: none; border: 0; border-radius: 50%; display: inline-grid; place-items: center; background: var(--surface-2); color: var(--text); cursor: pointer; }
.play::before { content: "▶"; font-size: 9px; margin-left: 2px; }
.play.is-playing { background: var(--accent); color: var(--on-accent); }
.play.is-playing::before { content: "❚❚"; font-size: 8px; margin-left: 0; }

/* ── 01 guests ── */
.guests { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
.guest { position: relative; aspect-ratio: 4 / 3; border-radius: var(--radius); overflow: hidden; background: var(--surface-2); }
.guest-toggle { position: absolute; inset: 0; width: 100%; padding: 0; border: 0; border-radius: inherit; background: none; cursor: pointer; text-align: left; }
.guest-art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: var(--art-dim); transition: filter 0.3s ease; }
.art-placeholder { display: grid; place-items: center; font: 600 22px var(--sans); color: var(--muted); background: var(--surface-2); }
.guest-shade { position: absolute; inset: 0; background: linear-gradient(to top, rgba(9, 14, 21, 0.85), rgba(9, 14, 21, 0) 60%); }
.guest-name { position: absolute; left: 12px; right: 44px; bottom: 10px; font-size: 13px; font-weight: 500; line-height: 1.3; color: rgba(230, 237, 243, 0.78); }
.guest-check { position: absolute; top: 9px; right: 9px; width: 20px; height: 20px; border-radius: 50%; display: none; place-items: center; background: var(--accent); color: var(--on-accent); font-size: 11px; font-weight: 700; }
.guest .play { position: absolute; right: 10px; bottom: 9px; background: rgba(230, 237, 243, 0.14); color: #e6edf3; }
.guest .play.is-playing { background: var(--accent); color: var(--on-accent); }
.guest:not(.is-in) .guest-toggle:hover .guest-art { filter: grayscale(0.4) brightness(0.75); }
.guest.is-in { outline: 1.5px solid var(--accent); outline-offset: -1.5px; }
.guest.is-in .guest-art { filter: none; }
.guest.is-in .guest-name { color: #ffffff; }
.guest.is-in .guest-check { display: grid; }
.guest-own { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 12px; text-align: center; background: none; border: 1px dashed var(--line); }
.own-title { font-size: 13px; color: var(--muted); }
.own-actions { display: flex; gap: 8px; }
.own-btn { position: relative; padding: 5px 12px; border: 1px solid var(--line); border-radius: 999px; background: none; color: var(--text); font-size: 12.5px; cursor: pointer; }
.own-btn:hover { border-color: var(--muted); }
.own-btn:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
.own-btn.is-recording { border-color: var(--accent); color: var(--accent); }
.own-status { min-height: 1.2em; font-size: 12px; color: var(--muted); }

/* ── 02 room ── */
.room-empty { margin: 0; font-size: 14.5px; color: var(--muted); }
.room-intro { display: flex; align-items: center; gap: 24px; margin-bottom: 20px; font-size: 14.5px; color: var(--muted); }
.avatars { display: flex; flex: none; }
.avatar { width: 30px; height: 30px; margin-right: -8px; border: 2px solid var(--bg); border-radius: 50%; object-fit: cover; font-size: 11px; }
.stale-note { margin: 0 0 16px; font-size: 13.5px; color: var(--text); }
.room.is-stale .mics, .room.is-stale .room-intro { opacity: 0.4; }
.mics { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px 28px; }
.mic-h { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; font-size: 13px; color: var(--muted); }
.mic:has(.play.is-playing) .mic-h { color: var(--text); }
.wave { display: block; width: 100%; height: 40px; }
.wave-fill { fill: var(--wave); }
.mic:has(.play.is-playing) .wave-fill { fill: var(--accent); }
.wave-ghost { fill: var(--wave-ghost); stroke: var(--wave-ghost); stroke-width: 3; vector-effect: non-scaling-stroke; }
.res .wave-fill { fill: var(--wave-strong); }
.action-bar { display: flex; align-items: center; gap: 22px; margin-top: 28px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 44px; padding: 0 22px; border: 0; border-radius: 6px; background: var(--accent); color: var(--on-accent); font: 600 14px var(--sans); cursor: pointer; }
.btn:disabled { background: var(--surface-2); color: var(--faint); cursor: not-allowed; }
.btn.is-busy, .btn.is-busy:disabled { background: var(--accent); color: var(--on-accent); opacity: 0.85; cursor: progress; }
.btn.is-busy::before { content: ""; width: 14px; height: 14px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.link { padding: 4px 0; border: 0; background: none; color: var(--muted); font-size: 14px; cursor: pointer; }
.link:hover { color: var(--text); }

/* ── 03 results ── */
.summary { margin: 0 0 22px; font-size: 15px; color: var(--muted); }
.summary b { color: var(--text); font-weight: 600; }
.results { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
.res { padding: 16px; border-radius: var(--radius); background: var(--surface); }
.res-noise { opacity: 0.7; }
.res-top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.res-art { position: static; width: 36px; height: 36px; flex: none; border-radius: 8px; object-fit: cover; font-size: 12px; }
.res-name { font-size: 14px; font-weight: 500; line-height: 1.25; }
.res-score { margin-left: auto; font: 500 15px var(--mono); }
.res-score small { margin-left: 2px; font-size: 11px; color: var(--muted); }
.seg { display: flex; gap: 4px; margin-top: 12px; padding: 3px; border-radius: 6px; background: var(--surface-2); }
.seg-btn { flex: 1; padding: 6px 0; border: 0; border-radius: 4px; background: none; color: var(--muted); font-size: 12.5px; cursor: pointer; }
.seg-btn:hover { color: var(--text); }
.seg-btn.is-playing { background: var(--surface-2); color: var(--text); }
.seg-btn.is-playing::after { content: "  ❚❚"; font-size: 9px; }

/* ── folds: under the hood, how it works ── */
.fold { border-top: 1px solid var(--line); }
#how { border-bottom: 1px solid var(--line); }
#hood { margin-top: 40px; }
.fold > summary { display: flex; justify-content: space-between; padding: 16px 0; font-size: 14.5px; cursor: pointer; list-style: none; }
.fold > summary::-webkit-details-marker { display: none; }
.fold > summary::after { content: "+"; color: var(--muted); }
.fold[open] > summary::after { content: "−"; }
.hood { display: grid; gap: 32px; padding: 4px 0 28px; }
.hood-row { display: grid; grid-template-columns: 1.3fr 1fr; gap: 28px; }
.hood-fig { margin: 0; }
.hood-fig figcaption { margin-bottom: 10px; font-size: 12.5px; color: var(--muted); }
.chart { display: block; width: 100%; height: 96px; }
.chart-line { fill: none; stroke: var(--wave-strong); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
.chart-axis { stroke: var(--line); vector-effect: non-scaling-stroke; }
.matrix { display: grid; gap: 3px; }
.matrix span { display: grid; place-items: center; aspect-ratio: 2.2 / 1; border-radius: 3px; font: 11px var(--mono); background: rgba(var(--accent-rgb), var(--a, 0.1)); }
.stack { display: grid; gap: 4px; }
.stack .wave { height: 28px; }
.table { width: 100%; border-collapse: collapse; font-size: 13px; }
.table th, .table td { padding: 6px 8px; border-bottom: 1px solid var(--line); text-align: left; }
.table th { font-weight: 500; color: var(--muted); }
.table .num { font-family: var(--mono); }
.details { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px 24px; margin: 0; font-size: 13px; }
.details dt { color: var(--muted); }
.details dd { margin: 0; font-family: var(--mono); }
.showcase .muted { max-width: 70ch; margin: 0 0 12px; }
.how { max-width: 72ch; padding: 4px 0 28px; }
.how h3 { margin: 24px 0 6px; font-size: 15px; }
.how p, .how ol { color: var(--muted); }
.how img { display: block; width: 100%; height: auto; margin: 16px 0; border-radius: var(--radius); }
.links { font-size: 14px; }

/* ── lab drawer ── */
.backdrop { position: fixed; inset: 0; z-index: 20; background: rgba(0, 0, 0, 0.45); }
.drawer { position: fixed; top: 0; right: 0; bottom: 0; z-index: 21; width: min(340px, 100vw); overflow-y: auto; padding: 22px; background: var(--bg); border-left: 1px solid var(--line); box-shadow: -20px 0 40px rgba(0, 0, 0, 0.25); }
.drawer-h { display: flex; align-items: center; justify-content: space-between; }
.drawer-h h2 { margin: 0; font-size: 16px; font-weight: 600; }
.drawer .label { margin: 26px 0 12px; }
.icon-btn { width: 32px; height: 32px; flex: none; border: 0; border-radius: 6px; background: var(--surface-2); cursor: pointer; }
.ctl { display: block; margin-bottom: 16px; }
.ctl-l { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; font-size: 13.5px; }
.ctl-l output { font: 12.5px var(--mono); color: var(--muted); }
.ctl input[type="range"] { width: 100%; accent-color: var(--accent); }
.ctl select, .seed input { width: 100%; padding: 6px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--text); font: 13px var(--mono); }
.seed { display: flex; gap: 8px; }
.drawer .seg { margin-top: 0; }
.drawer .seg label { flex: 1; }
.drawer .seg input { position: absolute; opacity: 0; pointer-events: none; }
.drawer .seg span { display: block; padding: 6px 0; border-radius: 4px; text-align: center; font-size: 12.5px; color: var(--muted); cursor: pointer; }
.drawer .seg input:checked + span { background: var(--surface-2); color: var(--text); }
.drawer .seg input:focus-visible + span { outline: 2px solid var(--accent); }
.tog { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; font-size: 13.5px; cursor: pointer; }
.tog input { appearance: none; -webkit-appearance: none; position: relative; width: 30px; height: 18px; margin: 0; border-radius: 9px; background: var(--surface-2); cursor: pointer; }
.tog input::after { content: ""; position: absolute; top: 3px; left: 3px; width: 12px; height: 12px; border-radius: 50%; background: var(--muted); transition: left 0.2s ease; }
.tog input:checked { background: rgba(var(--accent-rgb), 0.35); }
.tog input:checked::after { left: 15px; background: var(--text); }
#reset-lab { margin-top: 12px; }

/* ── smaller screens ── */
@media (max-width: 900px) {
  .guests { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .hood-row { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .bar { padding: 14px 18px; }
  .brand { font-size: 12px; }
  .wrap { padding: 16px 18px 128px; }
  .lede { margin-bottom: 36px; font-size: 14px; }
  section { margin-bottom: 36px; }
  .guests { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .mics { grid-template-columns: 1fr; }
  .room-intro { gap: 18px; font-size: 13.5px; }
  .action-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 10; flex-wrap: wrap; gap: 8px 16px; margin: 0; padding: 14px 18px 18px; background: linear-gradient(to top, var(--bg) 70%, transparent); }
  .action-bar .btn { flex: 1; }
  .action-bar .hint { order: -1; width: 100%; text-align: center; }
  .drawer { width: 100vw; border-left: 0; }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { transition: none !important; animation: none !important; }
}
```

- [ ] **Step 3: Write `web/js/theme.js`**

```js
const STORAGE_KEY = "cp-theme";

export function initTheme() {
  const button = document.getElementById("theme-toggle");
  const root = document.documentElement;
  const sync = () => {
    const dark = root.dataset.theme === "dark";
    button.textContent = dark ? "☀" : "☾";
    button.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
  };
  button.addEventListener("click", () => {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(STORAGE_KEY, root.dataset.theme);
    } catch {
      // Storage can be blocked inside third-party iframes; the toggle still works for this visit.
    }
    sync();
  });
  sync();
}
```

- [ ] **Step 4: Write `web/js/main.js`.** Tasks 7–10 replace this file.

```js
import { initTheme } from "./theme.js";

initTheme();
document.querySelector('a[href="#how"]').addEventListener("click", () => {
  document.getElementById("how").open = true;
});
```

- [ ] **Step 5: Check it in the browser.** Start the server in the background with `HOST=127.0.0.1 .venv/bin/python app.py`, open `http://127.0.0.1:7860/`, and run with the browser tool (`runPlaywrightCode`):

```js
await page.goto("http://127.0.0.1:7860/");
const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
await page.click("#theme-toggle");
const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
await page.goto("http://127.0.0.1:7860/?theme=light");
const forced = await page.evaluate(() => document.documentElement.dataset.theme);
await page.evaluate(() => { document.getElementById("how").open = true; });
await page.waitForTimeout(1500);
const images = await page.evaluate(() => [...document.querySelectorAll(".how img")].map((img) => img.naturalWidth));
return { dark, light, forced, images };
```
Expected: `dark` = `rgb(9, 14, 21)`, `light` = `rgb(247, 249, 251)`, `forced` = `light`, and `images` contains three widths of at most 1400 and greater than 0. Reset the saved theme afterwards with `page.evaluate(() => localStorage.removeItem("cp-theme"))`, then stop the server.

- [ ] **Step 6: Commit**

```bash
git add web
git commit -m "Add page shell, visual system and theme toggle" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 7: Guest list, shared player and "Your own sound"

**Files:**
- Create: `web/js/state.js`, `web/js/api.js`, `web/js/dom.js`, `web/js/player.js`, `web/js/audio-input.js`, `web/js/guests.js`
- Rewrite: `web/js/main.js`

**Interfaces:**
- Consumes: the DOM and CSS from Task 6 and the API from Task 5.
- Produces:
  - `state.js`:
    - `MAX_GUESTS` (20) and `DEFAULTS` (frozen settings)
    - `getState()`, `subscribe(fn)` (calls `fn` immediately) and `update(mutator)`
    - `currentMixKey(state)`, `isStale(state)`, `mixRequest(state)` and `unmixRequest(state)`
    - The state shape: `{ guests: [], invited: Map<id, speed>, settings: {...DEFAULTS}, mix: null, mixKey: null, result: null, busy: null|"mix"|"unmix", error: null }`
  - `api.js`: `ApiError(message, status)` and `api.library()`, `api.mix(payload)`, `api.unmix(payload)`, `api.addSource(wavBlob, filename)`
  - `dom.js`: `el(tag, className="", text="")`, `audioButton(url, label, className="play", text="")`, `guestArt(guest, className)` and `prefersReducedMotion()`
  - `player.js`: `toggle(url, button)` and `stop()`. Exactly one sound plays at a time; the owning button gets `.is-playing` and `aria-pressed="true"`.
  - `audio-input.js`: `fileToWav(blob) -> Promise<Blob>`, `encodeWav(samples, rate) -> Blob` and `createYourOwnCard() -> HTMLElement`
  - `guests.js`: `initGuests()`, `loadGuests()` and `renderGuests(state)`
  - A global click handler in `main.js`: any `button[data-url]` toggles playback.

- [ ] **Step 1: Write `web/js/state.js`**

```js
export const MAX_GUESTS = 20;

export const DEFAULTS = Object.freeze({
  seed: 0,
  difficulty: 5,
  conditioning: "linear",
  microphones: 0, // 0 = automatic: one per guest, plus one when noise is on
  noise: 0,
  iterations: 150,
  tolerance: 1e-6,
  auto_pca: true,
  denoise_mixtures: true,
  wiener_strength: 0.55,
  denoise_estimates: false,
  restarts: false,
});

const MIXING_KEYS = ["seed", "difficulty", "conditioning", "microphones", "noise"];

const state = {
  guests: [],
  invited: new Map(),
  settings: { ...DEFAULTS },
  mix: null,
  mixKey: null,
  result: null,
  busy: null,
  error: null,
};

const listeners = new Set();

export function getState() {
  return state;
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(state);
}

export function update(mutator) {
  mutator(state);
  for (const listener of listeners) listener(state);
}

// Everything that changes what the microphones record. If it differs from the key saved at mix time, the room is stale.
export function currentMixKey(s) {
  return JSON.stringify({ guests: [...s.invited.entries()], mixing: MIXING_KEYS.map((key) => s.settings[key]) });
}

export function isStale(s) {
  return Boolean(s.mix) && s.mixKey !== currentMixKey(s);
}

export function mixRequest(s) {
  const t = s.settings;
  return {
    guests: [...s.invited.entries()].map(([id, speed]) => ({ id, speed })),
    seed: t.seed,
    difficulty: t.difficulty,
    conditioning: t.conditioning,
    microphones: t.microphones || null,
    noise: t.noise,
  };
}

export function unmixRequest(s) {
  const t = s.settings;
  return {
    mix_id: s.mix.mix_id,
    iterations: t.iterations,
    tolerance: t.tolerance,
    auto_pca: t.auto_pca,
    denoise_mixtures: t.denoise_mixtures,
    denoise_estimates: t.denoise_estimates,
    wiener_strength: t.wiener_strength,
    restarts: t.restarts,
  };
}
```

- [ ] **Step 2: Write `web/js/api.js`**

```js
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON, for example while the Space is still starting up.
  }
  if (!response.ok) throw new ApiError(body?.error || `Request failed (${response.status}).`, response.status);
  return body;
}

const postJson = (payload) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

export const api = {
  library: () => request("/api/library"),
  mix: (payload) => request("/api/mix", postJson(payload)),
  unmix: (payload) => request("/api/unmix", postJson(payload)),
  addSource(wavBlob, filename) {
    const form = new FormData();
    form.append("file", wavBlob, filename);
    return request("/api/sources", { method: "POST", body: form });
  },
};
```

- [ ] **Step 3: Write `web/js/dom.js`**

```js
export function el(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function audioButton(url, label, className = "play", text = "") {
  const button = el("button", className, text);
  button.type = "button";
  button.dataset.url = url;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", "false");
  return button;
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join("") || "?";
}

export function guestArt(guest, className) {
  if (guest?.image_url) {
    const image = el("img", className);
    image.src = guest.image_url;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    return image;
  }
  const placeholder = el("span", `${className} art-placeholder`, initials(guest?.name || "?"));
  placeholder.setAttribute("aria-hidden", "true");
  return placeholder;
}

export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
```

- [ ] **Step 4: Write `web/js/player.js`**

```js
// One shared player: starting a sound stops whatever was playing.
const audio = new Audio();
let owner = null;

function setOwner(button) {
  if (owner) {
    owner.classList.remove("is-playing");
    owner.setAttribute("aria-pressed", "false");
  }
  owner = button;
  if (owner) {
    owner.classList.add("is-playing");
    owner.setAttribute("aria-pressed", "true");
  }
}

audio.addEventListener("ended", () => setOwner(null));
audio.addEventListener("error", () => setOwner(null));

export function stop() {
  audio.pause();
  setOwner(null);
}

export function toggle(url, button) {
  if (owner === button && !audio.paused) {
    stop();
    return;
  }
  setOwner(button);
  audio.src = url;
  audio.play().catch(() => {
    if (owner === button) setOwner(null);
  });
}
```

- [ ] **Step 5: Write `web/js/audio-input.js`**

```js
import { api } from "./api.js";
import { el } from "./dom.js";
import { MAX_GUESTS, update } from "./state.js";

const TARGET_RATE = 16000;
const MAX_SECONDS = 30;

export function encodeWav(samples, rate) {
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const writeText = (offset, text) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((value, i) => {
    const s = Math.max(-1, Math.min(1, value));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  });
  return new Blob([view], { type: "audio/wav" });
}

// Decode any format the browser understands, resampled to 16 kHz mono, so the server only ever sees WAV.
export async function fileToWav(blob) {
  const OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const context = new OfflineContext(1, TARGET_RATE, TARGET_RATE);
  let buffer;
  try {
    buffer = await context.decodeAudioData(await blob.arrayBuffer());
  } catch {
    throw new Error("Couldn't read that file.");
  }
  const length = Math.min(buffer.length, buffer.sampleRate * MAX_SECONDS);
  const mono = new Float32Array(length);
  for (let c = 0; c < buffer.numberOfChannels; c += 1) {
    const channel = buffer.getChannelData(c);
    for (let i = 0; i < length; i += 1) mono[i] += channel[i] / buffer.numberOfChannels;
  }
  return encodeWav(mono, buffer.sampleRate);
}

async function addSound(blob, name, status) {
  status.textContent = "Adding…";
  try {
    const wav = await fileToWav(blob);
    const source = await api.addSource(wav, `${name.replace(/\.[^.]+$/, "")}.wav`);
    update((state) => {
      state.guests = [...state.guests, source];
      if (state.invited.size < MAX_GUESTS) state.invited.set(source.id, 1);
    });
    status.textContent = "";
  } catch (err) {
    status.textContent = err.message;
  }
}

export function createYourOwnCard() {
  const card = el("div", "guest guest-own");
  const actions = el("span", "own-actions");
  const upload = el("label", "own-btn", "Upload");
  const input = el("input", "visually-hidden");
  input.type = "file";
  input.accept = "audio/*";
  upload.append(input);
  const record = el("button", "own-btn", "Record");
  record.type = "button";
  record.hidden = !(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  const status = el("span", "own-status");
  status.setAttribute("role", "status");
  actions.append(upload, record);
  card.append(el("span", "own-title", "+ Your own sound"), actions, status);

  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    if (file) await addSound(file, file.name, status);
  });

  let recorder = null;
  let timer = null;
  record.addEventListener("click", async () => {
    if (recorder) {
      recorder.stop();
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      status.textContent = "Microphone access was blocked. You can still upload a file.";
      record.hidden = true;
      return;
    }
    const chunks = [];
    const started = Date.now();
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = async () => {
      clearInterval(timer);
      stream.getTracks().forEach((track) => track.stop());
      recorder = null;
      record.textContent = "Record";
      record.classList.remove("is-recording");
      const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      await addSound(new Blob(chunks, { type: chunks[0]?.type || "audio/webm" }), `Recording ${time}`, status);
    };
    recorder.start();
    record.classList.add("is-recording");
    record.textContent = "Stop (0:00)";
    timer = setInterval(() => {
      const seconds = Math.round((Date.now() - started) / 1000);
      record.textContent = `Stop (0:${String(seconds).padStart(2, "0")})`;
      if (seconds >= MAX_SECONDS) recorder?.stop();
    }, 250);
  });

  return card;
}
```

- [ ] **Step 6: Write `web/js/guests.js`**

```js
import { api } from "./api.js";
import { createYourOwnCard } from "./audio-input.js";
import { audioButton, el, guestArt } from "./dom.js";
import { MAX_GUESTS, update } from "./state.js";

let renderedGuests = null;
let ownCard = null;

export function initGuests() {
  ownCard = createYourOwnCard();
  document.getElementById("guests").addEventListener("click", (event) => {
    const toggleButton = event.target.closest(".guest-toggle");
    if (toggleButton) toggleInvite(toggleButton.dataset.id);
  });
}

export async function loadGuests() {
  const error = document.getElementById("guests-error");
  try {
    const guests = await api.library();
    error.hidden = true;
    update((state) => {
      state.guests = guests;
    });
  } catch (err) {
    error.textContent = `Couldn't load the guest list: ${err.message}`;
    error.hidden = false;
  }
}

function toggleInvite(id) {
  update((state) => {
    if (state.invited.has(id)) state.invited.delete(id);
    else if (state.invited.size < MAX_GUESTS) state.invited.set(id, 1);
  });
}

function guestCard(guest) {
  const card = el("div", "guest");
  card.dataset.id = guest.id;
  const toggleButton = el("button", "guest-toggle");
  toggleButton.type = "button";
  toggleButton.dataset.id = guest.id;
  toggleButton.setAttribute("aria-pressed", "false");
  toggleButton.setAttribute("aria-label", `Invite ${guest.name}`);
  toggleButton.append(
    guestArt(guest, "guest-art"),
    el("span", "guest-shade"),
    el("span", "guest-name", guest.name),
    el("span", "guest-check", "✓"),
  );
  card.append(toggleButton, audioButton(guest.preview_url, `Preview ${guest.name}`));
  return card;
}

export function renderGuests(state) {
  const grid = document.getElementById("guests");
  if (state.guests !== renderedGuests) {
    renderedGuests = state.guests;
    grid.replaceChildren(...state.guests.map(guestCard), ownCard);
  }
  for (const card of grid.querySelectorAll(".guest[data-id]")) {
    const invited = state.invited.has(card.dataset.id);
    card.classList.toggle("is-in", invited);
    card.querySelector(".guest-toggle").setAttribute("aria-pressed", String(invited));
  }
  document.getElementById("guests-meta").textContent = state.guests.length
    ? `${state.invited.size} invited · choose at least 2`
    : "";
}
```

- [ ] **Step 7: Rewrite `web/js/main.js`**

```js
import { initGuests, loadGuests, renderGuests } from "./guests.js";
import { toggle } from "./player.js";
import { subscribe } from "./state.js";
import { initTheme } from "./theme.js";

initTheme();
initGuests();

document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-url]");
  if (button) toggle(button.dataset.url, button);
});
document.querySelector('a[href="#how"]').addEventListener("click", () => {
  document.getElementById("how").open = true;
});

subscribe((state) => {
  renderGuests(state);
});
loadGuests();
```

- [ ] **Step 8: Check it in the browser.** Create a test tone:
```bash
.venv/bin/python -c "import numpy as np, soundfile as sf; t=np.arange(16000*4)/16000; sf.write('/tmp/cp-test-tone.wav', 0.4*np.sin(2*np.pi*440*t), 16000)"
```
Start the server (`HOST=127.0.0.1 .venv/bin/python app.py`, in the background), then run:
```js
await page.goto("http://127.0.0.1:7860/");
await page.waitForSelector(".guest[data-id]");
const before = await page.evaluate(() => ({
  cards: document.querySelectorAll(".guest[data-id]").length,
  own: Boolean(document.querySelector(".guest-own")),
  images: [...document.querySelectorAll("img.guest-art")].filter((img) => img.complete && img.naturalWidth > 0 && img.naturalWidth <= 480).length,
}));
await page.click('.guest[data-id="a-christmas-adventure"] .guest-toggle');
await page.click('.guest[data-id="a-christmas-adventure"] .play');
await page.waitForTimeout(300);
const invited = await page.evaluate(() => ({
  pressed: document.querySelector('.guest[data-id="a-christmas-adventure"] .guest-toggle').getAttribute("aria-pressed"),
  meta: document.getElementById("guests-meta").textContent,
  playing: document.querySelectorAll(".is-playing").length,
}));
await page.click('.guest[data-id="bad-guy-hq"] .play');
await page.waitForTimeout(300);
const onePlaying = await page.evaluate(() => document.querySelectorAll(".is-playing").length);
await page.setInputFiles(".guest-own input[type=file]", "/tmp/cp-test-tone.wav");
await page.waitForSelector('.guest[data-id^="upload-"]');
const uploaded = await page.evaluate(() => {
  const card = document.querySelector('.guest[data-id^="upload-"]');
  return { name: card.querySelector(".guest-name").textContent, invited: card.classList.contains("is-in") };
});
return { before, invited, onePlaying, uploaded };
```
Expected:
- `before`: `{cards: 8, own: true, images: 8}`
- `invited`: `{pressed: "true", meta: "1 invited · choose at least 2", playing: 1}`
- `onePlaying`: `1`
- `uploaded`: `{name: "cp-test-tone", invited: true}`

Stop the server.

- [ ] **Step 9: Commit**

```bash
git add web/js
git commit -m "Add guest list, shared player and your-own-sound card" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 8: The room — mixing, microphones and the main action

**Files:**
- Create: `web/js/waveform.js`, `web/js/room.js`
- Rewrite: `web/js/main.js`

**Interfaces:**
- Consumes (Task 7): `api.mix`, `api.unmix`, `ApiError.status`; `audioButton`, `el`, `guestArt`, `prefersReducedMotion`; `stop`; `currentMixKey`, `getState`, `isStale`, `mixRequest`, `unmixRequest`, `update`.
- Produces:
  - `waveform.js`:
    - `envelopePath(pairs, width, height) -> string`
    - `createWave(layers, { height = 40, label = "" }) -> SVGElement`, where `layers` is `[{ pairs, className }]`, drawn in order
    - `createLineChart(values, { height = 96, label = "" }) -> SVGElement`
  - `room.js`: `initRoom()` and `renderRoom(state)`. After a successful unmix it sets `state.result` and scrolls `#results-section` into view. A 410 error clears `mix` and `result`.

- [ ] **Step 1: Write `web/js/waveform.js`**

```js
const NS = "http://www.w3.org/2000/svg";
const WIDTH = 300;

// Filled min/max envelope: along the top edge left to right, then back along the bottom edge.
export function envelopePath(pairs, width, height) {
  const mid = height / 2;
  const step = width / Math.max(pairs.length - 1, 1);
  let top = "";
  let bottom = "";
  pairs.forEach(([low, high], i) => {
    const x = (i * step).toFixed(1);
    const peak = Math.max(high, low + 0.03); // keep silence visible as a thin line
    top += `${i ? "L" : "M"}${x} ${(mid - peak * mid).toFixed(1)}`;
    bottom = `L${x} ${(mid - low * mid).toFixed(1)}${bottom}`;
  });
  return `${top}${bottom}Z`;
}

function svg(width, height, label, className) {
  const node = document.createElementNS(NS, "svg");
  node.setAttribute("viewBox", `0 0 ${width} ${height}`);
  node.setAttribute("preserveAspectRatio", "none");
  node.setAttribute("class", className);
  if (label) {
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", label);
  } else {
    node.setAttribute("aria-hidden", "true");
  }
  return node;
}

function path(d, className) {
  const node = document.createElementNS(NS, "path");
  node.setAttribute("d", d);
  node.setAttribute("class", className);
  return node;
}

export function createWave(layers, { height = 40, label = "" } = {}) {
  const node = svg(WIDTH, height, label, "wave");
  for (const layer of layers) node.append(path(envelopePath(layer.pairs, WIDTH, height), layer.className));
  return node;
}

export function createLineChart(values, { height = 96, label = "" } = {}) {
  const width = 400;
  const pad = 6;
  const node = svg(width, height, label, "chart");
  const low = Math.min(...values);
  const span = Math.max(...values) - low || 1;
  const step = width / Math.max(values.length - 1, 1);
  const d = values
    .map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)} ${(pad + (height - 2 * pad) * (1 - (v - low) / span)).toFixed(1)}`)
    .join("");
  node.append(path(`M0 ${height - pad}L${width} ${height - pad}`, "chart-axis"), path(d, "chart-line"));
  return node;
}
```

- [ ] **Step 2: Write `web/js/room.js`**

```js
import { api } from "./api.js";
import { audioButton, el, guestArt, prefersReducedMotion } from "./dom.js";
import { stop } from "./player.js";
import { currentMixKey, getState, isStale, mixRequest, unmixRequest, update } from "./state.js";
import { createWave } from "./waveform.js";

let renderedMix; // undefined, so the first render always builds the room

export function initRoom() {
  document.getElementById("main-action").addEventListener("click", () => {
    const state = getState();
    if (state.busy) return;
    if (!state.mix || isStale(state)) startParty();
    else unmixRoom();
  });
  document.getElementById("remix").addEventListener("click", () => {
    if (getState().busy) return;
    update((state) => {
      state.settings.seed += 1;
    });
    startParty();
  });
}

async function startParty() {
  const state = getState();
  if (state.invited.size < 2) return;
  stop();
  const payload = mixRequest(state);
  const key = currentMixKey(state);
  update((s) => {
    s.busy = "mix";
    s.error = null;
  });
  try {
    const mix = await api.mix(payload);
    update((s) => {
      s.mix = mix;
      s.mixKey = key;
      s.result = null;
    });
  } catch (err) {
    update((s) => {
      s.error = err.message;
    });
  } finally {
    update((s) => {
      s.busy = null;
    });
  }
}

async function unmixRoom() {
  stop();
  const payload = unmixRequest(getState());
  update((s) => {
    s.busy = "unmix";
    s.error = null;
  });
  try {
    const result = await api.unmix(payload);
    update((s) => {
      s.result = result;
    });
    document.getElementById("results-section").scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  } catch (err) {
    update((s) => {
      s.error = err.message;
      if (err.status === 410) {
        s.mix = null;
        s.mixKey = null;
        s.result = null;
      }
    });
  } finally {
    update((s) => {
      s.busy = null;
    });
  }
}

function buildMix(state) {
  const { mix } = state;
  const avatars = el("span", "avatars");
  for (const guest of mix.guests) {
    avatars.append(guestArt(state.guests.find((g) => g.id === guest.id) || { name: guest.name }, "avatar"));
  }
  const intro = el("div", "room-intro");
  intro.append(avatars, el("span", "", "Everyone is talking at once. Each microphone hears a different blend."));
  const note = el("p", "stale-note", "Guests changed · Start the party again");
  note.hidden = true;
  const mics = el("div", "mics");
  for (const mic of mix.microphones) {
    const label = `Microphone ${mic.index + 1}`;
    const head = el("div", "mic-h");
    head.append(audioButton(mic.audio_url, `Play ${label}`), el("span", "", label));
    const item = el("div", "mic");
    item.append(head, createWave([{ pairs: mic.waveform, className: "wave-fill" }], { label: `${label} waveform` }));
    mics.append(item);
  }
  return [intro, note, mics];
}

function buttonLabel(state, ready) {
  if (state.busy === "mix") return "Mixing…";
  if (state.busy === "unmix") return state.settings.restarts ? "Unmixing… (5 runs)" : "Unmixing…";
  return ready ? "Unmix the room →" : "Start the party";
}

export function renderRoom(state) {
  const room = document.getElementById("room");
  if (state.mix !== renderedMix) {
    renderedMix = state.mix;
    room.replaceChildren(
      ...(state.mix
        ? buildMix(state)
        : [el("p", "room-empty", "Invite at least two guests, then start the party to hear what each microphone picks up.")]),
    );
  }
  const stale = isStale(state);
  room.classList.toggle("is-stale", stale);
  const note = room.querySelector(".stale-note");
  if (note) note.hidden = !stale;
  document.getElementById("room-meta").textContent = state.mix ? `${state.mix.microphones.length} microphones` : "";

  const tooFew = state.invited.size < 2;
  const button = document.getElementById("main-action");
  button.disabled = Boolean(state.busy) || tooFew;
  button.classList.toggle("is-busy", Boolean(state.busy));
  button.textContent = buttonLabel(state, Boolean(state.mix) && !stale);
  document.getElementById("action-hint").textContent = tooFew && !state.busy ? "Invite at least 2 guests" : "";
  document.getElementById("remix").hidden = !state.mix || Boolean(state.busy) || tooFew;
  const error = document.getElementById("action-error");
  error.textContent = state.error || "";
  error.hidden = !state.error;
}
```

- [ ] **Step 3: Rewrite `web/js/main.js`**

```js
import { initGuests, loadGuests, renderGuests } from "./guests.js";
import { toggle } from "./player.js";
import { initRoom, renderRoom } from "./room.js";
import { subscribe } from "./state.js";
import { initTheme } from "./theme.js";

initTheme();
initGuests();
initRoom();

document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-url]");
  if (button) toggle(button.dataset.url, button);
});
document.querySelector('a[href="#how"]').addEventListener("click", () => {
  document.getElementById("how").open = true;
});

subscribe((state) => {
  renderGuests(state);
  renderRoom(state);
});
loadGuests();
```

- [ ] **Step 4: Check it in the browser.** With the server running, run:
```js
await page.goto("http://127.0.0.1:7860/");
await page.waitForSelector(".guest[data-id]");
const start = await page.evaluate(() => ({
  disabled: document.getElementById("main-action").disabled,
  hint: document.getElementById("action-hint").textContent,
}));
for (const id of ["a-christmas-adventure", "a-monster-in-the-swamp", "airport-announcement"]) {
  await page.click(`.guest[data-id="${id}"] .guest-toggle`);
}
await page.click("#main-action");
await page.waitForSelector(".mic", { timeout: 30000 });
await page.click(".mic .play");
await page.waitForTimeout(300);
const mixed = await page.evaluate(() => ({
  mics: document.querySelectorAll(".mic").length,
  label: document.getElementById("main-action").textContent,
  playing: Boolean(document.querySelector(".mic .play.is-playing")),
  meta: document.getElementById("room-meta").textContent,
}));
await page.click('.guest[data-id="bad-guy-hq"] .guest-toggle');
const stale = await page.evaluate(() => ({
  note: !document.querySelector(".stale-note").hidden,
  label: document.getElementById("main-action").textContent,
}));
await page.click('.guest[data-id="bad-guy-hq"] .guest-toggle');
await page.click("#main-action");
await page.waitForFunction(() => !document.getElementById("main-action").classList.contains("is-busy"), null, { timeout: 60000 });
const unmixed = await page.evaluate(() => ({ error: document.getElementById("action-error").textContent }));
return { start, mixed, stale, unmixed };
```
Expected:
- `start`: `{disabled: true, hint: "Invite at least 2 guests"}`
- `mixed`: `{mics: 3, label: "Unmix the room →", playing: true, meta: "3 microphones"}`
- `stale`: `{note: true, label: "Start the party"}`. Un-inviting the fourth guest restores the original key, so the next click unmixes.
- `unmixed.error`: `""`

- [ ] **Step 5: Commit**

```bash
git add web/js
git commit -m "Add the room: mixing, microphone playback and main action" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 9: Voices recovered and "Under the hood"

**Files:**
- Create: `web/js/results.js`
- Rewrite: `web/js/main.js`

**Interfaces:**
- Consumes: `audioButton`, `el`, `guestArt` (Task 7); `isStale` (Task 7); `createLineChart`, `createWave` (Task 8); the unmix response shape (Task 4).
- Produces: `renderResults(state)`. It shows `#results-section` only when there is a result and the room isn't stale, and rebuilds the content only when `state.result` changes.

- [ ] **Step 1: Write `web/js/results.js`**

```js
import { audioButton, el, guestArt } from "./dom.js";
import { isStale } from "./state.js";
import { createLineChart, createWave } from "./waveform.js";

const SHOWCASE = [
  ["mixture", "Microphones"],
  ["pca", "PCA (decorrelated)"],
  ["ica", "ICA (independent)"],
];

let renderedResult;

export function renderResults(state) {
  document.getElementById("results-section").hidden = !state.result || isStale(state);
  if (state.result === renderedResult) return;
  renderedResult = state.result;
  if (!state.result) return;
  const result = state.result;
  renderSummary(result.summary);
  document.getElementById("results").replaceChildren(
    ...result.voices.map((voice) => voiceCard(voice, state.guests)),
    ...result.unmatched.map(noiseCard),
  );
  document.getElementById("hood-body").replaceChildren(...underTheHood(result));
}

function renderSummary(summary) {
  const p = document.getElementById("results-summary");
  p.replaceChildren();
  const text = (value) => p.append(document.createTextNode(value));
  const strong = (value) => p.append(el("b", "", value));
  strong(`${summary.found} of ${summary.total}`);
  text(" voices recovered · ");
  strong(`${Math.round(summary.mean_match * 100)}%`);
  text(" average match");
  if (summary.amari !== null) {
    text(" · Amari index ");
    strong(summary.amari.toFixed(2));
  }
  text(` · ${summary.seconds.toFixed(1)} s`);
}

function voiceCard(voice, guests) {
  const guest = guests.find((g) => g.id === voice.guest_id) || { name: voice.name };
  const score = el("span", "res-score", String(Math.round(voice.match * 100)));
  score.append(el("small", "", "% match"));
  const top = el("div", "res-top");
  top.append(guestArt(guest, "res-art"), el("span", "res-name", voice.name), score);
  const wave = createWave(
    [
      { pairs: voice.waveform_original, className: "wave-ghost" },
      { pairs: voice.waveform_recovered, className: "wave-fill" },
    ],
    { label: `${voice.name}: recovered voice drawn over the original` },
  );
  const seg = el("div", "seg");
  seg.append(
    audioButton(voice.original_url, `Play the original ${voice.name}`, "seg-btn", "Original"),
    audioButton(voice.recovered_url, `Play the recovered ${voice.name}`, "seg-btn", "Recovered"),
  );
  const card = el("article", "res");
  card.append(top, wave, seg);
  return card;
}

function noiseCard(item) {
  const label = `Background / noise · component ${item.index + 1}`;
  const top = el("div", "res-top");
  top.append(guestArt({ name: "~" }, "res-art"), el("span", "res-name", label));
  const seg = el("div", "seg");
  seg.append(audioButton(item.recovered_url, `Play ${label}`, "seg-btn", "Play"));
  const card = el("article", "res res-noise");
  card.append(top, createWave([{ pairs: item.waveform, className: "wave-fill" }], { label: `${label} waveform` }), seg);
  return card;
}

function figure(caption, content) {
  const node = el("figure", "hood-fig");
  node.append(el("figcaption", "", caption), content);
  return node;
}

function matrixGrid(matrix) {
  const peak = Math.max(...matrix.flat().map(Math.abs), 1e-9);
  const grid = el("div", "matrix");
  grid.style.gridTemplateColumns = `repeat(${matrix[0].length}, minmax(0, 1fr))`;
  grid.setAttribute("role", "img");
  grid.setAttribute("aria-label", `Mixing matrix: ${matrix.length} microphones by ${matrix[0].length} guests`);
  for (const value of matrix.flat()) {
    const cell = el("span", "", value.toFixed(2));
    cell.style.setProperty("--a", (0.06 + (0.4 * Math.abs(value)) / peak).toFixed(3));
    grid.append(cell);
  }
  return grid;
}

function waveStack(list) {
  const stack = el("div", "stack");
  for (const pairs of list) stack.append(createWave([{ pairs, className: "wave-fill" }], { height: 28 }));
  return stack;
}

function pairsTable(pairs) {
  const table = el("table", "table");
  const head = el("thead");
  const headRow = el("tr");
  for (const title of ["Estimate", "Guest", "Match"]) headRow.append(el("th", "", title));
  head.append(headRow);
  const body = el("tbody");
  for (const pair of pairs) {
    const row = el("tr");
    row.append(
      el("td", "num", String(pair.estimate + 1)),
      el("td", "", pair.guest ?? "Background / noise"),
      el("td", "num", pair.match === null ? "–" : `${Math.round(pair.match * 100)}%`),
    );
    body.append(row);
  }
  table.append(head, body);
  return table;
}

const onOff = (value) => (value ? "on" : "off");

function runDetails(summary, settings) {
  const items = [
    ["Iterations", summary.iterations],
    ["Components used", summary.components_used],
    ["Tolerance", settings.tolerance.toExponential()],
    ["Auto PCA knee", onOff(settings.auto_pca)],
    ["Denoise mixtures", onOff(settings.denoise_mixtures)],
    ["Denoise estimates", onOff(settings.denoise_estimates)],
    ["Wiener strength", settings.wiener_strength.toFixed(2)],
    ["Random restarts", onOff(settings.restarts)],
    ["Background noise", onOff(settings.noise)],
  ];
  const list = el("dl", "details");
  for (const [term, value] of items) {
    const item = el("div");
    item.append(el("dt", "", term), el("dd", "", String(value)));
    list.append(item);
  }
  return list;
}

function showcase() {
  const wrap = el("div", "showcase");
  wrap.append(
    el(
      "p",
      "muted",
      "PCA makes the microphones uncorrelated, but they still sound like blends. ICA goes further and finds the rotation that makes them statistically independent, which recovers the voices. All three rows use the same fixed mix of three guests with a little noise.",
    ),
  );
  const table = el("table", "table");
  const body = el("tbody");
  for (const [kind, label] of SHOWCASE) {
    const row = el("tr");
    row.append(el("th", "", label));
    for (let channel = 1; channel <= 3; channel += 1) {
      const cell = el("td");
      cell.append(audioButton(`/api/media/showcase/${kind}_${channel}`, `${label}, channel ${channel}`));
      row.append(cell);
    }
    body.append(row);
  }
  table.append(body);
  wrap.append(table);
  return wrap;
}

function underTheHood(result) {
  const { diagnostics, summary } = result;
  const row = el("div", "hood-row");
  row.append(
    figure("Convergence of the QR-T iterations", createLineChart(diagnostics.convergence, { label: "Convergence curve" })),
    figure("Mixing matrix A: how the room blended the voices", matrixGrid(diagnostics.matrix_A)),
  );
  return [
    row,
    figure("Original voices", waveStack(diagnostics.waveforms.sources)),
    figure(diagnostics.settings.denoise_mixtures ? "Microphones after denoising" : "Microphones", waveStack(diagnostics.waveforms.mixtures)),
    figure("Estimated components", waveStack(diagnostics.waveforms.estimates)),
    figure("Which estimate matched which guest", pairsTable(diagnostics.pairs)),
    figure("Run details", runDetails(summary, diagnostics.settings)),
    figure("Decorrelated is not independent: PCA versus ICA", showcase()),
  ];
}
```

- [ ] **Step 2: Rewrite `web/js/main.js`**

```js
import { initGuests, loadGuests, renderGuests } from "./guests.js";
import { toggle } from "./player.js";
import { renderResults } from "./results.js";
import { initRoom, renderRoom } from "./room.js";
import { subscribe } from "./state.js";
import { initTheme } from "./theme.js";

initTheme();
initGuests();
initRoom();

document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-url]");
  if (button) toggle(button.dataset.url, button);
});
document.querySelector('a[href="#how"]').addEventListener("click", () => {
  document.getElementById("how").open = true;
});

subscribe((state) => {
  renderGuests(state);
  renderRoom(state);
  renderResults(state);
});
loadGuests();
```

- [ ] **Step 3: Check it in the browser.** With the server running, run:
```js
await page.goto("http://127.0.0.1:7860/");
await page.waitForSelector(".guest[data-id]");
for (const id of ["a-christmas-adventure", "a-monster-in-the-swamp", "airport-announcement"]) {
  await page.click(`.guest[data-id="${id}"] .guest-toggle`);
}
await page.click("#main-action");
await page.waitForSelector(".mic", { timeout: 30000 });
await page.click("#main-action");
await page.waitForSelector("#results-section:not([hidden]) .res", { timeout: 60000 });
await page.click(".res .seg-btn:nth-child(2)");
await page.waitForTimeout(300);
await page.evaluate(() => { document.getElementById("hood").open = true; });
const results = await page.evaluate(() => ({
  voices: document.querySelectorAll(".res:not(.res-noise)").length,
  summary: document.getElementById("results-summary").textContent,
  playing: document.querySelector(".is-playing")?.textContent,
  chart: Boolean(document.querySelector("#hood-body .chart path.chart-line")),
  matrixCells: document.querySelectorAll(".matrix span").length,
  stacks: document.querySelectorAll(".stack").length,
  showcaseButtons: document.querySelectorAll(".showcase .play").length,
}));
await page.click('.guest[data-id="bad-guy-hq"] .guest-toggle');
const hiddenWhenStale = await page.evaluate(() => document.getElementById("results-section").hidden);
return { results, hiddenWhenStale };
```
Expected:
- `voices`: 3
- `summary`: matches `/^\d of 3 voices recovered · \d+% average match/`
- `playing`: `"Recovered"`
- `chart`: true
- `matrixCells`: 9
- `stacks`: 3
- `showcaseButtons`: 9
- `hiddenWhenStale`: true

- [ ] **Step 4: Commit**

```bash
git add web/js
git commit -m "Add recovered voices and under-the-hood diagnostics" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 10: The Lab drawer

**Files:**
- Create: `web/js/lab.js`
- Rewrite: `web/js/main.js`

**Interfaces:**
- Consumes: `DEFAULTS`, `update`, and the `settings` and `invited` state (Task 7); the Lab markup (Task 6).
- Produces: `initLab()` and `renderLab(state)`.
  - Changing a mixing setting (`seed`, `difficulty`, `conditioning`, `microphones`, `noise`) or a guest's speed makes the room stale, through `currentMixKey`.
  - Unmixing settings don't make it stale.

- [ ] **Step 1: Write `web/js/lab.js`**

```js
import { DEFAULTS, update } from "./state.js";

let speedsKey = null;

function readValue(input) {
  if (input.type === "checkbox") return input.checked;
  if (input.type === "range" || input.type === "number" || input.tagName === "SELECT") return Number(input.value);
  return input.value;
}

function format(key, value) {
  switch (key) {
    case "microphones":
      return value ? String(value) : "auto";
    case "noise":
      return value.toFixed(3);
    case "wiener_strength":
      return value.toFixed(2);
    default:
      return String(value);
  }
}

export function initLab() {
  const drawer = document.getElementById("lab");
  const backdrop = document.getElementById("lab-backdrop");
  const opener = document.getElementById("open-lab");
  const open = () => {
    drawer.hidden = false;
    backdrop.hidden = false;
    opener.setAttribute("aria-expanded", "true");
    document.getElementById("close-lab").focus();
  };
  const close = () => {
    drawer.hidden = true;
    backdrop.hidden = true;
    opener.setAttribute("aria-expanded", "false");
    opener.focus();
  };
  opener.addEventListener("click", open);
  document.getElementById("close-lab").addEventListener("click", close);
  backdrop.addEventListener("click", close);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !drawer.hidden) close();
  });

  drawer.addEventListener("input", (event) => {
    const input = event.target;
    if (input.dataset.guest) {
      update((state) => {
        state.invited.set(input.dataset.guest, Number(input.value));
      });
    } else if (input.name && input.name in DEFAULTS) {
      update((state) => {
        state.settings[input.name] = readValue(input);
      });
    }
  });
  document.getElementById("reseed").addEventListener("click", () => {
    update((state) => {
      state.settings.seed = Math.floor(Math.random() * 10000);
    });
  });
  document.getElementById("reset-lab").addEventListener("click", () => {
    update((state) => {
      state.settings = { ...DEFAULTS };
      for (const id of state.invited.keys()) state.invited.set(id, 1);
    });
  });
}

function renderSpeeds(state) {
  const box = document.getElementById("lab-speeds");
  const key = [...state.invited.keys()].join("|");
  if (key !== speedsKey) {
    speedsKey = key;
    box.replaceChildren();
    if (!state.invited.size) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Invite guests to change their speed.";
      box.append(empty);
    }
    for (const id of state.invited.keys()) {
      const guest = state.guests.find((g) => g.id === id);
      const label = document.createElement("label");
      label.className = "ctl";
      const line = document.createElement("span");
      line.className = "ctl-l";
      const name = document.createElement("span");
      name.textContent = `Speed · ${guest ? guest.name : id}`;
      line.append(name, document.createElement("output"));
      const input = document.createElement("input");
      Object.assign(input, { type: "range", min: "0.5", max: "2", step: "0.05" });
      input.dataset.guest = id;
      input.id = `speed-${id}`;
      label.htmlFor = input.id; // explicit target: the <output> inside the label would otherwise take the label
      label.append(line, input);
      box.append(label);
    }
  }
  for (const input of box.querySelectorAll("input[data-guest]")) {
    const speed = state.invited.get(input.dataset.guest);
    if (document.activeElement !== input) input.value = String(speed);
    input.closest("label").querySelector("output").textContent = `${speed.toFixed(2)}×`;
  }
}

export function renderLab(state) {
  const drawer = document.getElementById("lab");
  for (const [key, value] of Object.entries(state.settings)) {
    for (const input of drawer.querySelectorAll(`[name="${key}"]`)) {
      if (input.type === "radio") input.checked = input.value === value;
      else if (input.type === "checkbox") input.checked = Boolean(value);
      else if (input.tagName === "SELECT") input.value = Number(value).toExponential();
      else if (document.activeElement !== input) input.value = String(value);
    }
    const output = drawer.querySelector(`output[data-for="${key}"]`);
    if (output) output.textContent = format(key, value);
  }
  renderSpeeds(state);
}
```

- [ ] **Step 2: Rewrite `web/js/main.js`.** This is the final version.

```js
import { initGuests, loadGuests, renderGuests } from "./guests.js";
import { initLab, renderLab } from "./lab.js";
import { toggle } from "./player.js";
import { renderResults } from "./results.js";
import { initRoom, renderRoom } from "./room.js";
import { subscribe } from "./state.js";
import { initTheme } from "./theme.js";

initTheme();
initGuests();
initRoom();
initLab();

document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-url]");
  if (button) toggle(button.dataset.url, button);
});
document.querySelector('a[href="#how"]').addEventListener("click", () => {
  document.getElementById("how").open = true;
});

subscribe((state) => {
  renderGuests(state);
  renderRoom(state);
  renderResults(state);
  renderLab(state);
});
loadGuests();
```

- [ ] **Step 3: Check it in the browser.** With the server running, run:
```js
await page.goto("http://127.0.0.1:7860/");
await page.waitForSelector(".guest[data-id]");
for (const id of ["a-christmas-adventure", "a-monster-in-the-swamp", "airport-announcement"]) {
  await page.click(`.guest[data-id="${id}"] .guest-toggle`);
}
await page.click("#open-lab");
const defaults = await page.evaluate(() => ({
  open: !document.getElementById("lab").hidden,
  difficulty: document.querySelector('output[data-for="difficulty"]').textContent,
  microphones: document.querySelector('output[data-for="microphones"]').textContent,
  tolerance: document.querySelector('[name="tolerance"]').value,
  linear: document.querySelector('[name="conditioning"][value="linear"]').checked,
  speeds: document.querySelectorAll("#lab-speeds input[data-guest]").length,
}));
await page.locator('[name="microphones"]').fill("2");
await page.keyboard.press("Escape");
await page.click("#main-action");
await page.waitForFunction(() => !document.getElementById("action-error").hidden, null, { timeout: 30000 });
const tooFewMics = await page.evaluate(() => document.getElementById("action-error").textContent);
await page.click("#open-lab");
await page.click("#reset-lab");
await page.keyboard.press("Escape");
await page.click("#main-action");
await page.waitForSelector(".mic", { timeout: 30000 });
await page.click("#open-lab");
await page.locator('[name="difficulty"]').fill("20");
const staleAfterDifficulty = await page.evaluate(() => !document.querySelector(".stale-note").hidden);
await page.locator('[name="difficulty"]').fill("5");
await page.locator('[name="iterations"]').fill("200");
const staleAfterIterations = await page.evaluate(() => !document.querySelector(".stale-note").hidden);
await page.keyboard.press("Escape");
const closed = await page.evaluate(() => document.getElementById("lab").hidden);
return { defaults, tooFewMics, staleAfterDifficulty, staleAfterIterations, closed };
```
Expected:
- `defaults`: `{open: true, difficulty: "5", microphones: "auto", tolerance: "1e-6", linear: true, speeds: 3}`
- `tooFewMics`: `"Use at least as many microphones as guests (3)."`
- `staleAfterDifficulty`: true
- `staleAfterIterations`: false
- `closed`: true

- [ ] **Step 4: Commit**

```bash
git add web/js
git commit -m "Add the Lab drawer" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 11: Full local verification

**Files:** none, unless a check fails. Fix any failure in the file that owns the behaviour, re-run the check, and commit with a message that describes the fix.

- [ ] **Step 1: Run the backend tests**

Run: `.venv/bin/python -m pytest -q`
Expected: `51 passed`.

- [ ] **Step 2: Check the phone layout at 390 px.** With the server running:
```js
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://127.0.0.1:7860/");
await page.waitForSelector(".guest[data-id]");
const phone = await page.evaluate(() => {
  const bar = getComputedStyle(document.querySelector(".action-bar"));
  const first = document.querySelector(".guest").getBoundingClientRect();
  return {
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    columns: getComputedStyle(document.getElementById("guests")).gridTemplateColumns.split(" ").length,
    actionBar: bar.position,
    cardWidth: Math.round(first.width),
  };
});
await page.click("#open-lab");
const drawerWidth = await page.evaluate(() => Math.round(document.getElementById("lab").getBoundingClientRect().width));
return { phone, drawerWidth };
```
Expected: `overflowX: false`, `columns: 2`, `actionBar: "fixed"`, `cardWidth` between 160 and 185, and `drawerWidth: 390`.

- [ ] **Step 3: Check light mode and the iframe.** Load `http://127.0.0.1:7860/?theme=light` at 1280×900, run the full flow (invite 3 → Start the party → Unmix the room), and take a screenshot of the results section. Check that the text is readable, there's one accent colour, and the artwork is dimmed until invited. Then confirm the app works inside an iframe, as on the blog:
```js
await page.setContent('<iframe id="f" src="http://127.0.0.1:7860/" allow="microphone" style="width:1000px;height:800px"></iframe>');
const frame = page.frameLocator("#f");
await frame.locator(".guest[data-id]").first().waitFor({ timeout: 30000 });
return await frame.locator(".guest[data-id]").count();
```
Expected: `8`.

- [ ] **Step 4: Check the unexpected-error path.** Stop the server, click **Start the party** on the already-open page with 2 guests invited, and confirm `#action-error` reads "Can't reach the server. Check your connection and try again." Restart the server.

- [ ] **Step 5: Review against the spec.** Take full-page screenshots of the desktop page in dark and light mode after unmixing, and compare them with the approved mockup (`.superpowers/brainstorm/5956-1794346454/content/full-page-v3.html`) and the spec's visual rules. Fix any deviations, then commit if anything changed:
```bash
git add -A web
git commit -m "Polish layout after full verification" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

- [ ] **Step 6: Clean up.** Stop the server and delete `/tmp/cp-test-tone.wav`.

---

### Task 12: Release — staging, then the live Space

**Files:**
- Modify (only if Task 1 chose **docker**): `README.md` front matter. Create `Dockerfile`.
- Parent repo: the `cocktail_party_problem` gitlink.

- [ ] **Step 1 (docker only): Switch the Space to Docker.** Replace the front matter lines `sdk: gradio` and `sdk_version: 6.10.0` in `README.md` with `sdk: docker` and `app_port: 7860`, keeping the other keys. Create `Dockerfile`:
```dockerfile
FROM python:3.11-slim
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"
WORKDIR /home/user/app
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt
COPY --chown=user . .
EXPOSE 7860
CMD ["python", "app.py"]
```
Commit with: `git add README.md Dockerfile && git commit -m "Run the Space as a Docker app" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"`.

- [ ] **Step 2: Push to staging.** Staging only contains the Task 1 probe, so overwriting it is intended.
```bash
git remote add staging https://huggingface.co/spaces/Padenarie/The_Cocktail_Party_Problem-staging 2>/dev/null || true
GIT_TERMINAL_PROMPT=0 git push --force staging HEAD:main
```
Then poll `https://huggingface.co/api/spaces/Padenarie/The_Cocktail_Party_Problem-staging/runtime`, using the Task 1 command with the token, until `RUNNING`.

- [ ] **Step 3: Smoke-test staging through the API.** Staging is private, so use the token:
```bash
TOKEN=$(.venv/bin/python -c "from huggingface_hub import get_token; print(get_token() or '')")
BASE=https://padenarie-the-cocktail-party-problem-staging.hf.space
curl -s -H "Authorization: Bearer $TOKEN" $BASE/ | grep -c "The Cocktail Party"
curl -s -H "Authorization: Bearer $TOKEN" $BASE/api/library | .venv/bin/python -c "import sys,json; print(len(json.load(sys.stdin)))"
MIX=$(curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"guests":[{"id":"a-christmas-adventure"},{"id":"a-monster-in-the-swamp"},{"id":"airport-announcement"}]}' $BASE/api/mix | .venv/bin/python -c "import sys,json; print(json.load(sys.stdin)['mix_id'])")
curl -s -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{\"mix_id\":\"$MIX\"}" $BASE/api/unmix | .venv/bin/python -c "import sys,json; d=json.load(sys.stdin); print(d['summary'])"
```
Expected: a count of at least `1`, then `8`, then a summary dict with `"total": 3`.

- [ ] **Step 4: Ask the user for the go-ahead to replace the live demo.** Use the ask_user tool. Summarise the staging results and ask: "Replace the live Space with the redesign now?" Stop here unless the answer is yes.

- [ ] **Step 5: Push to the live Space**
```bash
GIT_TERMINAL_PROMPT=0 git push origin HEAD:main
```
Poll `https://huggingface.co/api/spaces/Padenarie/The_Cocktail_Party_Problem/runtime` until the stage is `RUNNING` and `sha` equals `git rev-parse HEAD`.

- [ ] **Step 6: Run the browser checks against the live URL.** Repeat the Task 9 Step 3 and Task 11 Step 2 scripts with `https://padenarie-the-cocktail-party-problem.hf.space/` in place of `http://127.0.0.1:7860/`. Expected: the same results.

- [ ] **Step 7: Bump the submodule pointer in the parent repo (local commit only)**
```bash
cd /Users/pdenarie/Developer/Personal/Blog_posts
git add cocktail_party_problem
git commit -m "chore: update cocktail party Space to the redesigned app" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

- [ ] **Step 8: Ask about the staging Space.** Use the ask_user tool to ask whether to delete `Padenarie/The_Cocktail_Party_Problem-staging` or keep it for future changes. Delete it only with explicit approval, using `HfApi().delete_repo("Padenarie/The_Cocktail_Party_Problem-staging", repo_type="space")`.

## Spec coverage

| Spec requirement | Task |
| --- | --- |
| Hosting check and private staging Space | 1, 12 |
| Store with 30 min idle expiry and a cap of 50 | 2 |
| Resized JPEGs (480 / 1400 px), never the original PNGs | 2, 5 |
| `service.mix` / `service.unmix` with the pipeline unchanged | 3, 4 |
| Unmatched components, Amari only for square A without restarts | 4 |
| API routes, JSON errors 400/404/410/500 | 5 |
| Gradio UI removed, `utils.py` free of Gradio, requirements | 5 |
| Uploads decoded in the browser, WAV only on the server, 10 MB / 30 s | 2, 3, 7 |
| Recording with MediaRecorder; hidden when unsupported or blocked | 7 |
| Visual rules, dark and light themes, `?theme=`, reduced motion | 6 |
| Header, guests, room, results, Under the hood, How does this work? | 6–9 |
| One sound at a time | 7 |
| Too-few-guests hint, busy states, stale room, inline errors | 8, 10 |
| Lab drawer with every control and per-guest speed | 10 |
| Phone layout with a sticky action bar and full-width drawer | 6, 11 |
| Works inside the blog's iframe | 11 |
| Backend tests and browser checks | 2–5, 6–11 |
| Release, then bump the submodule pointer | 12 |

