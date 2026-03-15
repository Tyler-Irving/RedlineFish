# STRIP Inventory

Complete inventory of all STRIP targets identified during Phase 1 audit.
Organized by target. Each entry notes the file path, what it does, and any
dependencies on KEEP components that will need updating after removal.

Last audited: 2026-03-15 on branch `chore/initial-strip`.

---

## Target 1: Reddit Simulation Platform

### Files to delete entirely

#### `backend/scripts/run_reddit_simulation.py`
770-line standalone Reddit simulation runner. Handles the full Reddit simulation
lifecycle: spawns OASIS Reddit agents via `generate_reddit_agent_graph()`,
manages IPC command handling, orchestrates agent graph state, and writes
`reddit/actions.jsonl`. Direct parallel of `run_twitter_simulation.py` for the
Reddit platform.

**Dependencies on KEEP components**: calls `SimulationIPCClient` for file-based
IPC. The IPC system stays; only this script is deleted.

---

### Backend — sections to remove (files are KEEP, content is STRIP)

#### `backend/app/config.py`
- **What to remove**: `OASIS_REDDIT_ACTIONS` list (~lines 55–69). 13 Reddit-specific
  action type constants: `LIKE_POST`, `DISLIKE_POST`, `CREATE_POST`,
  `CREATE_COMMENT`, `LIKE_COMMENT`, `DISLIKE_COMMENT`, `SEARCH_POSTS`,
  `SEARCH_USER`, `TREND`, `REFRESH`, `DO_NOTHING`, `FOLLOW`, `MUTE`.
- **Keep**: `OASIS_TWITTER_ACTIONS` list immediately above it.
- **Dependencies on KEEP**: `OASIS_REDDIT_ACTIONS` is read by
  `simulation_config_generator.py`. Remove usages there first (see that entry below).

#### `backend/app/services/oasis_profile_generator.py`
- **What to remove**:
  - `karma: int = 1000` field in `OasisAgentProfile` dataclass — Reddit-only field
    (Twitter profiles use `follower_count`, `friend_count`, `statuses_count`).
  - `to_reddit_format()` method — converts agent profiles to Reddit JSON format.
  - Any `reddit_profiles.json` write path in the save logic.
  - `from openai import OpenAI` direct import — **LLM client violation** (use
    `LLMClient` instead); fix this while in the file.
- **Keep**: `OasisAgentProfile` dataclass itself, `to_twitter_format()` / CSV save
  logic, all Zep enrichment logic.
- **Dependencies on KEEP**: `SimulationManager` imports `OasisProfileGenerator`
  and `OasisAgentProfile` by name — neither is renamed, no import update needed.

#### `backend/app/services/simulation_config_generator.py`
- **What to remove**:
  - `reddit_config: Optional[PlatformConfig] = None` field in `SimulationParameters`
    dataclass (line 165) and its `to_dict()` entry (line 187).
  - `enable_reddit: bool = True` parameter in `generate_config()` signature
    (line 251) and its docstring entry (line 265).
  - `if enable_reddit:` block that builds `PlatformConfig(platform="reddit", ...)`
    (~lines 350–358).
  - `reddit_config=reddit_config` argument in the `SimulationParameters()`
    constructor call (line 370).
  - `from openai import OpenAI` direct import — **LLM client violation**; migrate
    all `client.chat.completions.create(...)` calls to `LLMClient.chat()` /
    `LLMClient.chat_json()` while in the file. The existing `<think>` tag stripping
    and markdown fence cleanup already in those calls can then be deleted —
    `LLMClient` handles both.
- **Keep**: `SimulationParameters` dataclass, `PlatformConfig` dataclass,
  `generate_config()` method body (all non-Reddit logic), `CHINA_TIMEZONE_CONFIG`.
- **Dependencies on KEEP**: `SimulationManager` passes `enable_reddit=` to
  `generate_config()` — remove that kwarg from the call site in
  `simulation_manager.py` (Step 7 in the plan).

#### `backend/app/services/simulation_manager.py`
- **What to remove**:
  - `PlatformType.REDDIT = "reddit"` from the `PlatformType` enum (line 39).
    If `PlatformType` has no remaining callers after removal, delete the whole enum.
  - `enable_reddit: bool = True` field in `SimulationState` dataclass (line 51).
  - `"enable_reddit": self.enable_reddit` in `SimulationState.to_dict()` (line 84).
  - `enable_reddit=data.get("enable_reddit", True)` in `_load_simulation_state()`
    (line 175).
  - `enable_reddit: bool = True` parameter in `create_simulation()` (line 198).
  - `enable_reddit=enable_reddit` pass-through in `create_simulation()` body
    (line 220).
  - Conditional block setting `reddit_profiles.json` as `realtime_output_path`
    (lines 332–333).
  - `enable_reddit=state.enable_reddit` argument in the `generate_config()` call
    (line 410).
  - `"reddit": f"python {scripts_dir}/run_reddit_simulation.py --config {config_path}"`
    entry in the scripts dict (line 518) and surrounding comment (line 525).
- **Keep**: All Twitter-equivalent logic, `SimulationState` dataclass itself,
  `create_simulation()`, `prepare_simulation()`, `_load_simulation_state()`.
- **Dependencies on KEEP**: `simulation.py` API passes `enable_reddit=` to
  `create_simulation()` — remove that kwarg in `simulation.py` (Step 9).

#### `backend/app/services/simulation_runner.py`
- **What to remove**:
  - `platform: str  # twitter / reddit` field in `AgentAction` dataclass (line 52)
    and its `to_dict()` entry. Platform is always Twitter after the strip.
  - `reddit_actions: int = 0` field in `RoundSummary` dataclass (line 82) and its
    `to_dict()` entry.
  - `elif platform == "reddit": ... state.reddit_running = True` branch in the
    action dispatcher (~lines 388–390).
  - `"reddit_simulation.db"` from the database file list (~lines 1109, 1137).
  - Any `reddit_running`, `reddit_completed`, `reddit_actions_count` fields written
    to `run_state.json`.
- **Keep**: `AgentAction`, `RoundSummary`, and all their Twitter-side fields.
  `SimulationRunner` class and subprocess orchestration. `run_state.json` write logic
  (Twitter fields only).
- **Dependencies on KEEP**: `simulation.py` API reads `run_state.json` fields for
  status responses — verify Twitter field names are unchanged after the strip.

#### `backend/app/api/simulation.py`
- **What to remove** (20+ scattered locations):
  - `enable_reddit=data.get('enable_reddit', True)` in the `create_simulation()`
    route handler (line 222).
  - `"has_reddit_config": "reddit_config" in config` key in config-check response
    (line 1234).
  - `"run_reddit_simulation.py"` from the `allowed_scripts` list (line 1336).
  - Platform docstrings referencing `reddit` as an option (lines 991, 1034).
  - Reddit DB path lookups, `reddit_answer` field extractions, and
    `platform='reddit'` filter branches in interview route handlers
    (lines 1840, 2080, 2165, 2301–2303, 2415, 2429, 2517–2518, 2630).
  - Any remaining `platform` default of `'reddit'` — change to `'twitter'`.
- **Keep**: All route handlers themselves. Twitter-equivalent logic in every handler.
- **Dependencies on KEEP**: none — the API layer is the top of the call stack.

#### `backend/scripts/run_parallel_simulation.py`
- **What to remove**: The Reddit simulation class (parallel to the Twitter runner
  class) and its instantiation/invocation in `main()`. The `enable_reddit` /
  `run_reddit` conditional branches in `main()`.
- **Keep**: The Twitter runner class and **all its logic completely unchanged**.
  The `LLM_BOOST_*` env var reads (lines 999–1001) are already provider-agnostic —
  leave them as-is.
- **WARNING**: This is the most complex file in the codebase — async OASIS
  orchestration. Read it fully before touching anything. Only delete Reddit-specific
  classes and branches; do not alter Twitter logic at all.
- **Dependencies on KEEP**: `SimulationRunner` spawns this script via
  `subprocess.Popen` using a command string (no Python import). The Twitter
  subprocess entry point must remain unchanged.

---

### Frontend — sections to remove

#### `frontend/src/api/simulation.js`
- **What to remove**:
  - `enable_reddit?` from JSDoc of `createSimulation()` (line 5).
  - `platform = 'reddit'` default parameter in `getSimulationProfiles()` (line 40) —
    change to `'twitter'`.
  - `platform = 'reddit'` default parameter in `getSimulationProfilesRealtime()`
    (line 49) — change to `'twitter'`.
  - `platform = 'reddit'` default parameter in `getSimulationPosts()` (line 118) —
    change to `'twitter'`.
- **Keep**: All function signatures and API call logic.
- **Dependencies on KEEP**: none — callers in components do not pass an explicit
  platform argument; they rely on the default.

#### `frontend/src/components/Step1GraphBuild.vue`
- **What to remove**: `enable_reddit: true` in the `createSimulation()` call
  (~line 225). The backend no longer accepts this field after Step 7.
- **Keep**: All other simulation creation logic.
- **Dependencies on KEEP**: none.

#### `frontend/src/components/Step2EnvSetup.vue`
- **What to remove**: Reddit config display card, `has_reddit_config` log-check
  branch.
- **Keep**: Twitter config display, all agent profile generation logic.
- **Dependencies on KEEP**: none.

#### `frontend/src/components/Step3Simulation.vue`
- **What to remove**:
  - Entire "Reddit 平台进度" panel block (lines 48–90): `class="platform-status reddit"`
    div, "Topic Community" label, round/elapsed/action-count bindings, Reddit action
    types tooltip.
  - `redditActionsCount`, `redditElapsedTime`, `prevRedditRound` reactive state
    variables and their update logic in the polling handler.
  - Reddit CSS classes (`.reddit`, `.platform-status.reddit`, etc.) in
    `<style scoped>`.
- **Keep**: Twitter monitoring panel and all its reactive state. Polling logic.
  Elapsed time display. Action count display.
- **Dependencies on KEEP**: none — the Twitter panel is self-contained.

#### `frontend/src/components/Step4Report.vue`
- **What to remove**: `redditAnswer` field handling, any Reddit-platform regex
  parsing, Reddit platform tab (if present).
- **Keep**: Report section streaming viewer, report agent chat.
- **Dependencies on KEEP**: none.

#### `frontend/src/components/Step5Interaction.vue`
- **What to remove**: `reddit_${agentId}` key preference in interview result
  handling, any `platform='reddit'` profile fetch call.
- **Keep**: Multi-agent interview chat, all Twitter interview logic.
- **Dependencies on KEEP**: none.

#### `frontend/src/views/SimulationView.vue`
- **What to remove**: Reddit platform config card/toggle in the simulation setup UI.
- **Keep**: Twitter platform config, simulation parameter inputs.
- **Dependencies on KEEP**: none.

#### `frontend/src/views/SimulationRunView.vue`
- **What to remove**: Reddit monitoring panel (mirrors content removed from
  `Step3Simulation.vue`).
- **Keep**: Twitter monitoring panel.
- **Dependencies on KEEP**: none.

---

### Artifact paths that will stop being generated (no code change needed)
- `backend/uploads/simulations/<id>/reddit_profiles.json`
- `backend/uploads/simulations/<id>/reddit/actions.jsonl`
- `backend/uploads/simulations/<id>/reddit_simulation.db`

---

## Target 2: Fiction/Novel Ingestion

**Status: not present in code.**

References to "fiction", "novel", and "deducing a novel's ending" appear only in
`README.md` and `README-EN.md` as MiroFish-era marketing copy describing the
original product's use cases. No fiction-specific ingestion paths, content-type
branches, creative-text processing, or genre detection exist in any Python service,
utility, API route, or frontend component.

**Action**: The README files contain upstream MiroFish marketing copy. Update that
copy as part of the branding cleanup in Step 12 of the Phase 1 plan — no code to
strip.

**Files containing only doc/marketing references** (no code change):
- `README.md` — "interesting fictional story", "deducing a novel's ending"
- `README-EN.md` — same phrases in English translation

---

## Target 3: God's-Eye Re-run System

**Status: not present in code.**

No `rerun`, `re_run`, `re-run`, `gods_eye`, `god_eye`, `scenario.*inject`,
`reinject`, or `replay.*scenario` patterns were found in any Python, Vue, or
JavaScript file. The only match for these search terms is `CLAUDE.md` itself
(describing what to strip).

This feature likely existed in an upstream MiroFish branch not included in this
fork baseline, or was removed before the repository was shared.

**Action**: nothing to do.

---

## Target 4: Docker Compose Multi-Service Setup

**Status: already simplified — nothing to strip.**

The Docker setup in this repo is a single-service deployment. No multi-service
Compose file, no nginx, no Redis, no Celery worker containers were found.

### Current Docker files (all KEEP)

#### `docker-compose.yml`
Single service named `mirofish`. Exposes ports 3000 (frontend) and 5001 (backend)
from one container. Uses `env_file: .env` and mounts `./backend/uploads`.
No linked services.

**Note**: image name `ghcr.io/666ghj/mirofish:latest` is a legacy MiroFish
reference. Update to a Redline image name as part of Step 12 branding cleanup.
Not a structural STRIP target.

#### `Dockerfile`
Single-stage build. Python 3.11 base, installs Node.js and uv, copies application
code, runs `npm run dev`. No multi-stage build, no separate nginx or worker stage.

**Dependencies on KEEP**: reads from root `.env` at runtime via `env_file` in
`docker-compose.yml`.

#### `.dockerignore`
Standard exclusions: `.git`, `node_modules`, `__pycache__`, `.venv`, `dist`.
No changes needed.

#### `.github/workflows/docker-image.yml`
GitHub Actions CI workflow. Builds the Docker image and pushes to
`ghcr.io/666ghj/mirofish:latest`. The image name is a branding artifact —
update in Step 12 alongside README cleanup.

**Action**: nothing to strip. Update the image name in `docker-compose.yml` and
`.github/workflows/docker-image.yml` during the branding pass.

---

## Summary Table

| Target | In codebase? | Files to delete | Files with sections to remove | Notes |
|--------|-------------|-----------------|-------------------------------|-------|
| Reddit simulation | Yes | 1 (`run_reddit_simulation.py`) | 9 backend + 8 frontend | See Phase 1 plan steps 1–10 |
| Fiction/novel ingestion | No | 0 | 0 | README copy only |
| God's-eye re-run | No | 0 | 0 | Not present |
| Docker multi-service | No | 0 | 0 | Already single-service |
