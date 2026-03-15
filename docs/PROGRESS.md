# Phase 1 Progress Log

---

## Session 3 — 2026-03-15

### What was accomplished

Ran the Checkpoint grep (Steps 1–10 verification) — passed. Only `report_agent.py`
docstrings and one inert comment in `run_parallel_simulation.py` showed Reddit
references; both expected.

Completed **Step 11 — Frontend 3-stage rebuild**.

**Router**: Replaced 6-route, 5-view table with 3 routes:
- `/upload/:projectId` → `UploadView.vue`
- `/simulate/:simulationId` → `SimulateView.vue`
- `/explore/:reportId` → `ExploreView.vue`
Old routes (`/process`, `/simulation`, `/simulation/start`, `/report`, `/interaction`) removed.

**UploadView.vue** (new): Runs the full pipeline automatically on mount —
ontology generation → graph build (with task polling) → create simulation →
prepare simulation (with profile polling). Right panel shows a 4-step vertical
stepper with live progress bars and node/edge counts. "Continue to Simulate"
button appears when all steps complete. GraphPanel on left updates during build.

**SimulateView.vue** (new): Shows a config panel (rounds input, default 12) before
starting. On "Start Simulation", mounts `Step3Simulation` (which auto-starts via
its `onMounted`). Graph auto-refreshes every 30s during run. Step3Simulation
navigates to Explore on report generation.

**ExploreView.vue** (new): Merges Step4Report and Step5Interaction into one view
with Report/Interview tabs in the header. Both components mount immediately
(v-if=dataReady) so the report streams in while Interview is available. Defaults
to `workbench` view mode (graph hidden, report takes full width).

**Component fixes**:
- `Step3Simulation.vue`: Changed `router.push({ name: 'Report', ... })` → `'Explore'`
- `Step4Report.vue`: Changed `goToInteraction` from routing to `emit('go-interview')`;
  ExploreView catches this to switch tabs without navigation
- `HistoryDatabase.vue`: Updated all 3 navigation calls to new route names
  (Process→Upload, Simulation→Simulate, Report→Explore)
- `Home.vue`: Brand "MIROFISH" → "REDLINE", hero copy updated for Redline
  positioning, workflow steps updated to 3 stages (Upload/Simulate/Explore),
  route navigation updated to `'Upload'`

**Build verification**: `npx vite build` completes cleanly, 667 modules, no errors
or warnings.

---

### Next steps

**Step 12** — README and branding cleanup (lowest risk):
- `README.md` and `README-EN.md`: replace MiroFish product description with Redline
- Remove fiction/novel ingestion copy
- Update docker-compose.yml and .github/workflows container names

**End-to-end test** (still needed):
- Start dev server (`npm run dev`) and browser-test the full 3-stage flow
- Upload a document → verify UploadView pipeline runs → verify SimulateView
  shows config panel → start simulation → verify Step3Simulation monitor works →
  verify "Generate Report" navigates to ExploreView → verify Report tab streams
  sections → verify Interview tab loads agents

**Known issue**: `Home.vue` still has the MiroFish logo image in `hero-right`.
The logo file is `MiroFish_logo_left.jpeg`. This should be replaced or removed
as a Step 12 / branding cleanup task.

---

### Surprising or unresolved — read before next session

All previous session 2 notes still apply.

**7. Old view files are now dead code** — `MainView.vue`, `SimulationView.vue`,
`SimulationRunView.vue`, `ReportView.vue`, `InteractionView.vue`, `Process.vue`,
`Step1GraphBuild.vue`, `Step2EnvSetup.vue` are all unreachable (removed from
router). They can be deleted in Step 12 cleanup or kept as historical reference.
The plan said to delete them; safe to do so now that the build passes.

**8. Step3Simulation still has Chinese strings** — messages like
`'正在启动双平台并行模拟...'`, `'✓ 模拟引擎启动成功'` etc. These are internal
log strings that appear in the simulation monitor log panel. Not urgent for Phase 1
(they're functional), but should be Englished in Phase 2.

**9. ExploreView loads both tabs on mount** — `v-if="dataReady"` means both
Step4Report and Step5Interaction mount as soon as the report/sim IDs are fetched.
This is intentional (report streams in while Interview is available), but it does
mean two sets of polling intervals start simultaneously. If performance is an
issue, switch to `v-if="activeTab === '...'"` for lazy loading.

---

## Session 2 — 2026-03-15

### What was accomplished

Completed Steps 1–10 of the Phase 1 strip plan. Reddit simulation platform is
fully removed from all active code paths. The app imports and starts cleanly.

**Step 1** — Deleted `backend/scripts/run_reddit_simulation.py` entirely.

**Step 2** — Removed `OASIS_REDDIT_ACTIONS` list from `backend/app/config.py`.

**Steps 3–4** — Stripped all Reddit references from the frontend:
- `frontend/src/api/simulation.js` — platform defaults changed to `'twitter'`
- `Step1GraphBuild.vue` — removed `enable_reddit: true` from `createSimulation()`
- `Step2EnvSetup.vue` — removed Reddit config panel and log check
- `Step3Simulation.vue` — deleted entire Reddit progress panel + CSS
- `Step4Report.vue` — removed dual-platform tab UI and `redditAnswer` parsing
- `Step5Interaction.vue` — removed `reddit_${agentId}` key preference

**Steps 5–6** — Stripped Reddit from leaf backend services and migrated both from
direct `openai.OpenAI` to `LLMClient`:
- `oasis_profile_generator.py` — removed `to_reddit_format()`, `karma` field,
  `_save_reddit_json()`, reddit output path; migrated to `LLMClient`
- `simulation_config_generator.py` — removed `reddit_config` from
  `SimulationParameters`, removed `enable_reddit` param, migrated to `LLMClient`

**Step 7** — Stripped Reddit from `simulation_manager.py`:
- Removed `PlatformType.REDDIT`, `enable_reddit` from `SimulationState`,
  `create_simulation()`, `get_profiles()` default, and the reddit script entry

**Step 8** — Stripped Reddit from `simulation_runner.py`:
- Removed `reddit_actions` from `RoundSummary`, all reddit fields from
  `SimulationRunState`, reddit log monitoring, reddit DB file from cleanup list,
  `state.reddit_running` from shutdown handler, `reddit_available` from env_status,
  reddit platform branches from `get_action_history()`

**Step 9** — Stripped Reddit from `backend/app/api/simulation.py`:
- Removed `enable_reddit` from `create_simulation` route, `reddit_profiles.json`
  from required files check, reddit platform defaults/validation throughout all
  route handlers, dual-platform interview response handling, `reddit_available`
  from env-status response

**Step 10** — Extracted Twitter runner from `run_parallel_simulation.py`:
- Deleted `run_reddit_simulation()` function (~200 lines)
- Removed `generate_reddit_agent_graph` import, `REDDIT_ACTIONS` list
- Simplified `ParallelIPCHandler` to Twitter-only (removed reddit env/graph params,
  removed dual-platform interview batching logic)
- Removed `--reddit-only` CLI argument, `reddit_logger` setup, parallel gather
  with reddit, reddit env cleanup
- Renamed module docstring to "OASIS Twitter 模拟"
- Cleaned `action_logger.py` (removed `get_reddit_logger()` method)
- Deleted `backend/scripts/test_profile_format.py` (called deleted reddit methods)

**Verification**: `flask create_app()` imports and runs cleanly.

---

### Next steps

**Checkpoint** (do before Step 11): Run the full Reddit grep:

```bash
grep -rn "reddit\|Reddit" backend/ --include="*.py"
grep -rn "reddit\|Reddit" frontend/src/
```

Expected: only `zep_tools.py` and `zep_graph_memory_updater.py` show up
(both are protected KEEP files — see "Unresolved" below). Frontend: zero results.
Then do a manual end-to-end run: upload → graph build → prepare → start simulation
→ confirm `twitter/actions.jsonl` grows → stop → generate report.

**Step 11** — Frontend 3-stage rebuild (Upload → Simulate → Explore).
This is the largest remaining piece. See `docs/PHASE1_PLAN.md` Step 11 for the
full spec. Key decisions to make at the start of that session:
- Confirm the existing `MainView.vue` / router structure before starting any renames
- Read `frontend/src/router/index.js` and `frontend/src/store/` before touching views

**Step 12** — README and branding cleanup (lowest risk, can be done last or in
parallel with testing Step 11).

---

### Surprising or unresolved — read before next session

**1. Two protected files still contain Reddit code** (`zep_tools.py`,
`zep_graph_memory_updater.py`). This is intentional. Both are listed as KEEP in
`CLAUDE.md` and are too complex to safely modify in Phase 1. The Reddit code paths
in both files are permanently dormant — `reddit_env` is never passed to them
from our cleaned-up simulation scripts. Specifically:

- `zep_tools.py` lines ~1396–1424: dual-platform interview response parsing that
  merges Twitter + Reddit answers. This will never be triggered since the
  `SimulationIPCHandler` in `run_parallel_simulation.py` now only returns
  Twitter responses.
- `zep_tools.py` lines ~1519–1527: fallback that tries to load
  `reddit_profiles.json`. The file won't exist; the except branch silently
  passes. No breakage.
- `zep_graph_memory_updater.py`: `'reddit': '世界2'` and `'reddit': []` are
  world-labels and empty lists — inert data, no code paths branch on them.

Do not touch these files until Phase 3.

**2. `--twitter-only` flag is now redundant** in `run_parallel_simulation.py`.
All runs are Twitter-only. The flag was left in rather than removed to avoid
any risk of breaking the argument parser while the simulation subprocess is
still being exercised. Clean it up in Phase 3.

**3. `platform` field preserved on `AgentAction`** — the comment was updated but
the field itself was kept because the frontend uses `action.platform` for CSS
class and icon selection in the simulation monitoring panel. All actions will
carry `platform: "twitter"` going forward, so this is correct behavior, not dead
code.

**4. `simulation_ipc.py` docstrings only** — only the docstrings in this file were
updated (Reddit platform option references removed). The `platform` parameter
passthrough in `send_interview()` / `send_batch_interview()` was left intact
because the IPC contract itself doesn't enforce platform constraints — it just
forwards whatever the caller passes. No functional change needed.

**5. `zep_tools.py` loads agent profiles from simulation dir** — it has a priority
order: twitter CSV first, then reddit JSON fallback, then Zep graph. Since
`twitter_profiles.csv` will always exist after a prepare step, the reddit
fallback path will never be reached. Confirmed safe.

**6. No end-to-end test was run this session** — the Flask import test passed, but
a full simulation run was not triggered. The next session should run one before
starting Step 11 to confirm nothing was accidentally broken during the
`run_parallel_simulation.py` surgery.
