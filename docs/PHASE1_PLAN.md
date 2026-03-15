# Phase 1 Plan — Strip, Restructure, Redline

**Goal**: Remove all STRIP targets, make the LLM client provider-agnostic, and
collapse the 5-step frontend into a 3-stage layout (Upload → Simulate → Explore).
Phase 1 is complete when the app starts without import errors and a full
Upload → Simulate → Explore workflow completes end-to-end.

**Working branch**: `redline/phase1-strip` (create from `chore/initial-strip`)

---

## Risk Ordering Rationale

Steps are ordered safest → riskiest based on:
- **Dependency surface**: files with no importers first
- **State impact**: changes to shared dataclasses and enums come after leaf changes
- **Blast radius**: the API layer and simulation subprocess script touch the most
  running-system state and come last among the backend changes

The frontend 3-stage rebuild is deferred until all backend Reddit code is removed,
so the new UI is never wired to dead backend flags.

---

## Step 1 — Delete `run_reddit_simulation.py` (safest) ✓ COMPLETE

**Why first**: standalone script, nothing in the codebase imports it. Zero risk.

**Files changed**:
- DELETE `backend/scripts/run_reddit_simulation.py`

**Verify**: `git diff --stat` shows only the deletion. Run `npm run backend` and
confirm Flask starts cleanly (`Loaded config` log line appears, no ImportError).

**KEEP imports to update**: none.

---

## Step 2 — Remove `OASIS_REDDIT_ACTIONS` from config ✓ COMPLETE

**Why here**: `Config.OASIS_REDDIT_ACTIONS` is consumed in one place
(`simulation_config_generator.py`). Removing it first makes the next step's
diff unambiguous — you'll get a clear `AttributeError` if any consumer was missed.

**Files changed**:
- `backend/app/config.py`: delete the `OASIS_REDDIT_ACTIONS` list (lines 55–69).
  The analogous `OASIS_TWITTER_ACTIONS` list stays.

**Verify**: `grep -r "OASIS_REDDIT_ACTIONS" backend/` returns no results.
Start Flask, confirm no `AttributeError` on startup.

**KEEP imports to update**: none.

---

## Step 3 — Fix frontend API platform defaults ✓ COMPLETE

**Why here**: purely cosmetic, no backend logic involved, and getting the frontend
defaults correct now prevents misleading API calls during the rest of development.

**Files changed**:
- `frontend/src/api/simulation.js`:
  - Line 40: change `platform = 'reddit'` → `platform = 'twitter'` in
    `getSimulationProfiles()`
  - Line 49: same change in `getSimulationProfilesRealtime()`
  - Line 118: same change in `getSimulationPosts()`
  - Line 5: remove `enable_reddit?` from JSDoc of `createSimulation()`

**Verify**: `grep -r "reddit" frontend/src/api/` returns no results.

**KEEP imports to update**: none.

---

## Step 4 — Strip Reddit sections from frontend components ✓ COMPLETE

**Why here**: these are display-only changes. The backend still has Reddit flags;
removing the frontend panels first means they simply stop being rendered, with no
broken logic in the running app.

Do these components in order — each is independent.

### 4a — `Step1GraphBuild.vue`
- Remove `enable_reddit: true` from the `createSimulation()` call (~line 225).
  The call becomes Twitter-only; the backend default will be updated in Step 7.

### 4b — `Step2EnvSetup.vue`
- Remove any Reddit config display card and the `has_reddit_config` log-check branch.

### 4c — `Step3Simulation.vue`
- Delete the entire "Reddit 平台进度" panel block (lines 48–90): the
  `class="platform-status reddit"` div, "Topic Community" label, round/elapsed/action-count
  bindings, and the Reddit actions tooltip.
- Remove the `redditActionsCount`, `redditElapsedTime`, `prevRedditRound` reactive
  state variables and their update logic in the polling handler.
- Remove Reddit CSS classes (`.reddit`, `.platform-status.reddit`, etc.) from
  `<style scoped>`.

### 4d — `Step4Report.vue`
- Remove `redditAnswer` field handling and any Reddit-platform regex parsing.
- Remove the Reddit platform tab if one exists.

### 4e — `Step5Interaction.vue`
- Remove the `reddit_${agentId}` key preference in interview result handling.
- Remove any `platform='reddit'` profile fetch call.

**Verify**: Run `npm run frontend`. Load the app through Steps 1–5 in the browser.
The right panel should show only the Twitter monitoring section. No console errors
about missing `redditAnswer` or undefined Reddit state.

**KEEP imports to update**: none. GraphPanel and HistoryDatabase are not touched.

---

## Step 5 — Strip Reddit from `oasis_profile_generator.py` ✓ COMPLETE

**Why here**: this service is a leaf — `SimulationManager` calls it, but it has
no downstream callers that depend on the Reddit output path.

**Files changed**:
- `backend/app/services/oasis_profile_generator.py`:
  - Remove `to_reddit_format()` method.
  - Remove `karma: int = 1000` field from `OasisAgentProfile` dataclass (Reddit-only field).
  - Remove any `reddit_profiles.json` write path.
  - The file imports `from openai import OpenAI` directly — **migrate all LLM calls
    to `LLMClient`** while you are in this file:
    - Replace `OpenAI(api_key=..., base_url=...)` instantiation with
      `LLMClient()` (reads from `Config` automatically).
    - Replace direct `client.chat.completions.create(...)` calls with
      `self.llm_client.chat(messages)` or `self.llm_client.chat_json(messages)`.
    - Remove the `from openai import OpenAI` import.

**Verify**: `grep -n "reddit\|Reddit\|karma\|from openai" backend/app/services/oasis_profile_generator.py`
returns no results. Run `npm run backend`; trigger agent profile generation through
the UI and confirm `twitter_profiles.csv` is still created correctly.

**KEEP imports to update**: none — `SimulationManager` imports `OasisProfileGenerator`
and `OasisAgentProfile` by name; neither is being renamed.

---

## Step 6 — Strip Reddit from `simulation_config_generator.py` and migrate to `LLMClient` ✓ COMPLETE

**Why here**: isolated service with one caller (`SimulationManager`). This is also
the **known LLM client violation** — `from openai import OpenAI` is used directly
instead of `LLMClient`. Fix both in one pass.

**Files changed**:
- `backend/app/services/simulation_config_generator.py`:
  - Remove `enable_reddit: bool = True` parameter from `generate_config()` signature
    and its docstring entry.
  - Remove `reddit_config: Optional[PlatformConfig] = None` field from
    `SimulationParameters` dataclass and its `to_dict()` entry.
  - Delete the `if enable_reddit:` block that builds `PlatformConfig(platform="reddit", ...)`.
  - Remove the `reddit_config=reddit_config` line from the `SimulationParameters()`
    constructor call.
  - Migrate `from openai import OpenAI` → `from ..utils.llm_client import LLMClient`.
    Replace all `OpenAI(...)` instantiation and `client.chat.completions.create(...)`
    calls with `LLMClient().chat(messages)` / `LLMClient().chat_json(messages)`.
    The existing `<think>` tag stripping and markdown fence cleanup in those calls can
    then be **deleted** — `LLMClient` already handles both.
  - Remove the `from openai import OpenAI` import.

**Verify**: `grep -n "reddit\|Reddit\|from openai" backend/app/services/simulation_config_generator.py`
returns no results. Run a full graph-build + prepare-simulation flow; confirm
`simulation_config.json` is generated and contains only `twitter_config`, no
`reddit_config` key.

**KEEP imports to update**: `SimulationManager` passes `enable_reddit=` to
`generate_config()` — that argument will be removed in Step 7.

---

## Step 7 — Strip Reddit from `simulation_manager.py` ✓ COMPLETE

**Why here**: this is the orchestration layer that wires together Steps 5 and 6.
Touching it before those leaf services are clean would leave dangling references.

**Files changed**:
- `backend/app/services/simulation_manager.py`:
  - Remove `PlatformType.REDDIT = "reddit"` from the `PlatformType` enum. If `PlatformType`
    is only used to distinguish Twitter vs Reddit, delete the whole enum; otherwise keep
    `TWITTER` only.
  - Remove `enable_reddit: bool = True` from the `SimulationState` dataclass (line 51),
    its `to_dict()` entry (line 84), and its `_load_simulation_state()` read (line 175).
  - Remove `enable_reddit: bool = True` from `create_simulation()` signature (line 198)
    and the `enable_reddit=enable_reddit` pass-through (line 220).
  - Remove the conditional block that sets `reddit_profiles.json` as
    `realtime_output_path` (lines 332–333).
  - Remove `enable_reddit=state.enable_reddit` from the `generate_config()` call
    (line 410) — this argument was removed from `SimulationConfigGenerator` in Step 6.
  - Remove the `"reddit": f"python {scripts_dir}/run_reddit_simulation.py ..."` entry
    from the scripts dict (line 518) and its surrounding comment (line 525).
  - Update the module docstring — change "Twitter和Reddit双平台并行模拟" to
    "Twitter单平台模拟".

**Verify**: `grep -n "reddit\|Reddit\|PlatformType.REDDIT" backend/app/services/simulation_manager.py`
returns no results. Run prepare-simulation end-to-end; confirm `state.json` no longer
contains an `enable_reddit` key.

**KEEP imports to update**:
- `backend/app/api/simulation.py` passes `enable_reddit=data.get('enable_reddit', True)`
  to `create_simulation()` — remove that kwarg in Step 9.

---

## Step 8 — Strip Reddit from `simulation_runner.py` ✓ COMPLETE

**Why here**: runtime data structures. `SimulationManager` calls the runner; the
runner's internal state (dataclasses, action dispatcher) must be consistent with the
manager having no Reddit concept. Do this before the API layer so status responses
are already clean when API cleanup happens.

**Files changed**:
- `backend/app/services/simulation_runner.py`:
  - Remove `platform: str  # twitter / reddit` field from `AgentAction` dataclass
    (line 52) and its `to_dict()` entry. Platform is now always Twitter.
  - Remove `reddit_actions: int = 0` from `RoundSummary` dataclass (line 82) and its
    `to_dict()` entry. Keep `twitter_actions`.
  - Delete the `elif platform == "reddit": ... state.reddit_running = True` branch in
    the action dispatcher (~lines 388–390).
  - Remove `"reddit_simulation.db"` from the file-list constant (~lines 1109, 1137).
  - Remove any `reddit_running`, `reddit_completed`, `reddit_actions_count` fields from
    the run state snapshot dict that is written to `run_state.json`.
  - Update the module docstring to remove Reddit references.

**Verify**: `grep -n "reddit\|Reddit" backend/app/services/simulation_runner.py`
returns no results. Start a simulation; confirm `run_state.json` contains only
Twitter fields and `actions.jsonl` entries have no `platform` field or have
`platform: "twitter"` consistently.

**KEEP imports to update**: none within services. The API layer reads run state —
verified in Step 9.

---

## Step 9 — Clean up Reddit references in `simulation.py` API ✓ COMPLETE

**Why last among backend files**: the API layer is the widest blast radius.
It has 20+ scattered Reddit references across multiple route handlers. Cleaning
leaf services first means that by this step, every `reddit_*` reference in the
API is provably dead — none of them call live code anymore.

**Files changed**:
- `backend/app/api/simulation.py`:
  - Remove `enable_reddit=data.get('enable_reddit', True)` from the
    `create_simulation()` route handler (line 222).
  - Remove the `"has_reddit_config": "reddit_config" in config` key from the
    config-check response (line 1234).
  - Remove `"run_reddit_simulation.py"` from the `allowed_scripts` list (line 1336).
  - Remove all platform docstrings that reference `reddit` as an option
    (lines 991, 1034).
  - In interview route handlers: remove Reddit DB path lookups, `reddit_answer`
    field extractions, and `platform='reddit'` filter branches (lines 1840, 2080,
    2165, 2301–2303, 2415, 2429, 2517–2518, 2630).
  - Change any remaining `platform` default of `'reddit'` to `'twitter'`.

**Verify**: `grep -n "reddit\|Reddit" backend/app/api/simulation.py` returns no results.
Run the full workflow: upload → simulate → interview an agent. Confirm the interview
returns Twitter-only responses with no key errors.

**KEEP imports to update**: none.

---

## Step 10 — Extract Twitter runner from `run_parallel_simulation.py` ✓ COMPLETE

**Why last among STRIP work**: this is the most complex file — async OASIS
orchestration, not a simple service class. The CLAUDE.md instruction is explicit:
**do not modify the Twitter-side logic**. This step is surgical.

**Files changed**:
- `backend/scripts/run_parallel_simulation.py`:
  - Identify the Reddit simulation class/function (likely a class parallel to the
    Twitter runner). **Read the file carefully before touching anything.**
  - Delete only the Reddit-specific class and its instantiation in `main()`.
  - Remove the `enable_reddit` / `run_reddit` conditional branches in `main()`.
  - Leave the Twitter runner class and all its logic completely unchanged.
  - The `LLM_BOOST_*` env var reads at lines 999–1001 are already provider-agnostic
    (no hardcoded Qwen values) — leave them as-is.

**Verify**: `grep -n "reddit\|Reddit" backend/scripts/run_parallel_simulation.py`
returns no results. Start a simulation end-to-end through the UI. Watch
`twitter/actions.jsonl` grow during the run. Confirm the subprocess exits cleanly.

**KEEP imports to update**: none. `SimulationRunner` calls this script via
`subprocess.Popen` using a command string; no Python import involved.

---

## Checkpoint — Reddit fully removed ✓ COMPLETE

After Step 10, run the complete verification:

```bash
grep -rn "reddit\|Reddit" backend/ --include="*.py"
grep -rn "reddit\|Reddit" frontend/src/ --include="*.vue" --include="*.js"
```

Both should return zero results (excluding `README.md` and `CLAUDE.md`). Run `npm run dev`
and do a full end-to-end pass: upload a document, wait for graph build, run a Twitter
simulation, generate a report, interview agents. Fix anything that breaks before
proceeding.

---

## Step 11 — Frontend 3-stage rebuild ✓ COMPLETE

**Why deferred until here**: building the new UI on top of clean backend contracts
(no Reddit flags anywhere) prevents the new components from ever needing Reddit
awareness.

The 5-stage flow (6 routes, 5 step components) collapses to 3 stages:

```
Upload  →  Simulate  →  Explore
```

### Route table changes (`frontend/src/router/index.js`)

| Old route | Old view | New route | New view |
|-----------|----------|-----------|----------|
| `/` | `Home.vue` | `/` | `Home.vue` (keep, light redesign) |
| `/process/:projectId` | `MainView.vue` | `/upload/:projectId` | `UploadView.vue` (new) |
| `/simulation/:simulationId` | `SimulationView.vue` | `/simulate/:simulationId` | `SimulateView.vue` (new) |
| `/simulation/:simulationId/start` | `SimulationRunView.vue` | (merged into SimulateView) | — |
| `/report/:reportId` | `ReportView.vue` | `/explore/:reportId` | `ExploreView.vue` (new) |
| `/interaction/:reportId` | `InteractionView.vue` | (merged into ExploreView) | — |

Delete `Process.vue` (unused, no route).

### Stage 1 — Upload (`UploadView.vue`)

Replaces `MainView.vue` with Steps 1 + 2 collapsed into automatic background
processing. The user sees:
- Left panel: `GraphPanel.vue` (reuse as-is)
- Right panel: progress indicator only (ontology generation → graph build →
  agent profile generation run sequentially without user interaction)
- "Continue to Simulate" button appears when preparation is complete

Implementation notes:
- Trigger ontology generation immediately on mount (the project already has uploaded
  files from `Home.vue` via `pendingUpload.js` or the `:projectId` param)
- Chain graph build task polling → profile generation automatically on completion
- Use the existing `getTaskStatus()` polling pattern from `graph.js`
- Default agent count: 50–80 (add a configurable input, defaulting to 60)

### Stage 2 — Simulate (`SimulateView.vue`)

Replaces `SimulationView.vue` + `SimulationRunView.vue`. The user sees:
- Left panel: `GraphPanel.vue`
- Right panel: simulation config (minimal — rounds and agent count only) that
  transitions into the Twitter monitoring panel once the run starts

Implementation notes:
- Default simulation rounds: 10–15 (add a configurable input, defaulting to 12)
- Reuse the Twitter monitoring section from `Step3Simulation.vue` (after Reddit
  panel has been removed in Step 4)
- "Continue to Explore" button appears when simulation completes

### Stage 3 — Explore (`ExploreView.vue`)

Replaces `ReportView.vue` + `InteractionView.vue`. The user sees:
- Left panel: `GraphPanel.vue`
- Right panel: two tabs — **Report** and **Interview**
  - Report tab: section-by-section streaming viewer (from `Step4Report.vue`)
  - Interview tab: multi-agent interview chat (from `Step5Interaction.vue`)

Implementation notes:
- Start report generation automatically on mount
- Both tabs are available immediately; Interview tab works even while report is
  still generating
- Reuse the existing API calls from `report.js` unchanged

### Styling (all three views)

Apply the Notion/Stripe direction from `frontend/CLAUDE.md`:
- `background: #fff` or `#fafafa` (not dark)
- Section padding: 24–40px
- Font: system-ui or Inter for body; `monospace` only for IDs and data values
- Remove all Chinese UI labels — English-first
- Remove MIROFISH branding; use "Redline" in the header

**Verify**: Navigate all three routes. Confirm each auto-advance trigger fires.
Confirm `GraphPanel.vue` renders correctly in all three view shells. Confirm the
Interview tab can reach agents while the Report tab is still loading.

---

## Step 12 — README and branding cleanup  ← START HERE NEXT SESSION

The final step with the lowest risk and lowest urgency — no code changes.

**Files changed**:
- `README.md` and `README-EN.md`: replace MiroFish product description with Redline
  description. Remove fiction/novel ingestion copy (e.g. "deducing a novel's ending").
  Update live demo links if they change.
- `.github/workflows/docker-image.yml`: update image name from
  `ghcr.io/666ghj/mirofish` to the Redline equivalent (coordinate with whoever
  owns the container registry).
- `docker-compose.yml`: update `container_name` and image reference from `mirofish`
  to `redline`.

**Verify**: `grep -rn "mirofish\|MiroFish\|MIROFISH" . --include="*.md" --include="*.yml"`
should return only historical/changelog references, not UI-facing copy.

---

## Phase 1 Done Criteria

- [x] `grep -rn "reddit\|Reddit" backend/ --include="*.py"` → only KEEP files
  (`zep_tools.py`, `zep_graph_memory_updater.py`) — dormant, never invoked
- [x] `grep -rn "reddit\|Reddit" frontend/src/` → zero results
- [x] `grep -n "from openai import OpenAI" backend/app/services/` → zero results
  (all LLM calls go through `LLMClient`)
- [x] `npm run backend` starts cleanly (verified: `App created OK`)
- [x] `npx vite build` completes cleanly — 667 modules, no errors
- [ ] Full workflow completes end-to-end via browser (not yet tested this session)
- [x] Frontend has exactly 3 route-level views: Upload, Simulate, Explore
- [ ] No Chinese labels visible in the UI (Step3Simulation still has Chinese log strings — Phase 2)
- [x] No MiroFish branding in Home.vue (logo image still present — Step 12 cleanup)

---

## Files Reference

### Delete entirely
- `backend/scripts/run_reddit_simulation.py`
- `frontend/src/views/Process.vue`
- `frontend/src/views/MainView.vue` (replaced by `UploadView.vue`)
- `frontend/src/views/SimulationView.vue` (merged into `SimulateView.vue`)
- `frontend/src/views/SimulationRunView.vue` (merged into `SimulateView.vue`)
- `frontend/src/views/ReportView.vue` (merged into `ExploreView.vue`)
- `frontend/src/views/InteractionView.vue` (merged into `ExploreView.vue`)
- `frontend/src/components/Step1GraphBuild.vue`
- `frontend/src/components/Step2EnvSetup.vue`

### Modify (backend)
- `backend/app/config.py`
- `backend/app/services/oasis_profile_generator.py`
- `backend/app/services/simulation_config_generator.py`
- `backend/app/services/simulation_manager.py`
- `backend/app/services/simulation_runner.py`
- `backend/app/api/simulation.py`
- `backend/scripts/run_parallel_simulation.py`

### Modify (frontend)
- `frontend/src/router/index.js`
- `frontend/src/api/simulation.js`
- `frontend/src/components/Step3Simulation.vue`
- `frontend/src/components/Step4Report.vue`
- `frontend/src/components/Step5Interaction.vue`
- `frontend/src/views/Home.vue`

### Do not touch (until Phase 3)
- `backend/app/services/report_agent.py`
- `backend/app/services/ontology_generator.py`
- `backend/app/services/graph_builder.py`
- `backend/app/services/text_processor.py`
- `backend/app/services/zep_entity_reader.py`
- `backend/app/services/simulation_ipc.py` (docstrings cleaned; logic untouched)
- `backend/app/services/zep_graph_memory_updater.py` (still has dormant reddit refs)
- `backend/app/services/zep_tools.py` (still has dormant reddit refs)
- `backend/app/utils/llm_client.py`
- `backend/app/utils/file_parser.py`
- `backend/app/utils/zep_paging.py`
- `backend/app/utils/retry.py`
- `frontend/src/components/GraphPanel.vue`
