# CLAUDE.md — Redline

## What This Project Is

Redline is a strategy red-teaming tool that simulates how diverse audiences react
to startup launches and marketing campaigns. It is an active fork of MiroFish
(a general-purpose swarm prediction engine) being stripped down and reshaped into
a focused, single-purpose product.

**The transformation is in progress.** Much of the codebase still reflects MiroFish's
original general-purpose design. When you encounter code that doesn't match the
Redline vision described below, that's expected — it's legacy code awaiting removal
or modification, not something to build on.

## Current Phase

**Phase 1: Fork, strip, and restructure.**

We are removing unused MiroFish components and collapsing the original 5-stage
pipeline into 3 stages: Upload → Simulate → Explore. Do not build new features
yet. The goal is a clean, working subset of MiroFish that can run a Twitter-only
simulation from uploaded documents and display results.

Phase 1 is complete when:
- All STRIP targets below are removed and the app still runs
- The LLM client accepts any OpenAI-compatible API key (not hardcoded Qwen)
- The frontend has three stages instead of five

## Development Commands

```bash
# Full stack (frontend port 3000, backend port 5001)
npm run dev

# Backend only
npm run backend
cd backend && uv run python run.py

# Frontend only
npm run frontend
cd frontend && npm run dev

# Install all dependencies
npm run setup

# Backend Python dependencies
cd backend && uv sync
```

Vite proxies `/api/*` to `http://localhost:5001` in dev mode.

There are no automated tests. Validate changes by running the dev server and
testing through the UI. When removing components, verify the app starts without
import errors and the remaining workflow completes end-to-end.

## Environment Setup

Copy `.env.example` to `.env` in the project root. Required:
- `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL_NAME` — any OpenAI-compatible LLM
- `ZEP_API_KEY` — Zep Cloud for knowledge graph and agent memory

Optional:
- `LLM_BOOST_*` — second LLM for performance-critical paths (report generation)

## Fork Strategy: What to KEEP, STRIP, and MODIFY

### KEEP (core engine, do not remove)
- `OntologyGenerator` — extracts entities/relations from uploaded documents
- `GraphBuilderService` — builds knowledge graph in Zep Cloud
- `OasisProfileGenerator` — generates diverse agent personas from the knowledge graph
- `SimulationRunner` — runs OASIS Twitter simulation as isolated subprocess
- `ReportAgent` — ReACT-pattern agent that analyzes simulation results
- `ZepToolsService` — tools the ReportAgent calls (insight_forge, panorama_search, quick_search, interview_agents)
- Zep Cloud integration throughout
- File-based IPC for agent interviews (command.json / response.json)
- JSONL action logs and SQLite trace databases

### STRIP (remove in Phase 1)
- Reddit simulation platform — all Reddit-specific agent actions, profiles, config
- Fiction/novel ingestion paths — creative-text-specific processing
- God's-eye-view re-run system — scenario re-injection with altered variables
- Docker Compose multi-service setup — simplify to single-service deployment
- General-purpose "prediction engine" framing — UI copy, variable names, comments
- `LLM_BOOST_*` hardcoded Qwen references — replace with provider-agnostic config

### MODIFY (reshape for Redline)
- **Pipeline**: collapse 5 stages → 3 stages (Upload → Simulate → Explore).
  Knowledge graph building and agent generation become automatic internal steps
  triggered after upload, not separate user-facing stages.
- **LLM client** (`app/utils/llm_client.py`): replace hardcoded Qwen endpoint with
  a provider-agnostic wrapper accepting any OpenAI-compatible API key. Keep the
  existing `<think>` tag stripping and markdown fence cleanup logic.
- **Frontend**: gut the 5-step Vue components and rebuild as a 3-panel layout
  with Notion/Stripe-inspired styling (light, clean, generous whitespace).
- **Agent count defaults**: MiroFish targets 100+ agents. Redline MVP defaults to
  50–80 for cost reasons. Make this configurable.
- **Simulation rounds**: default to 10–15 rounds (MiroFish recommends under 40).

## Do Not Touch (until later phases)

These files are complex and critical. Read them to understand the system, but do
not modify them until Phase 1 stripping is complete and the reduced app works:

- `run_parallel_simulation.py` — core OASIS simulation orchestration (Phase 3)
- `report_agent.py` — 600-line ReACT loop with tool calls (Phase 3)
- OASIS/CAMEL-AI dependencies — use as-is until MVP is validated

## Architecture (current state, pre-strip)

### Backend (`backend/`)

Flask app (Python 3.11+) with three blueprints in `app/api/`:
- `graph.py` — project creation, file upload, ontology generation, graph building
- `simulation.py` — agent preparation, simulation start/stop/status
- `report.py` — report generation and agent interview

Key services in `app/services/` follow a single-responsibility pattern. Each
blueprint routes to one or more dedicated service classes.

**State management**: server-side `Project` and `SimulationManager` singletons
persist state across API calls. The frontend sends `project_id` and the backend
fetches context from memory. Avoid passing large payloads through the API.

**Async tasks**: graph building uses a task-based pattern — start a task via POST,
poll `GET /api/graph/task/{task_id}` for status. See `app/models/task.py`.

**Simulation isolation**: `SimulationRunner` spawns a child process via
`subprocess.Popen` to isolate OASIS memory usage. Never inline simulation
execution into the Flask process. IPC uses file-based command/response JSON.

### Frontend (`frontend/src/`)

Vue 3 SPA built with Vite:
- `views/MainView.vue` — top-level workflow coordinator (currently 5-step)
- `components/` — one component per step (Step1 through Step5)
- `api/` — Axios modules mirroring backend blueprints
- `store/` — shared state between components
- D3.js v7 for knowledge graph visualization

### External Dependencies
- **OASIS (camel-ai v0.2.78 + camel-oasis v0.2.5)** — multi-agent simulation
- **Zep Cloud (SDK 3.13.0)** — knowledge graph storage, search, agent memory
- **OpenAI SDK** — all LLM API calls (provider-agnostic via base_url config)
- **D3.js v7** — force-directed graph rendering

## Code Style and Conventions

- Backend: Python 3.11+, Flask, service layer pattern. Use type hints.
- Frontend: Vue 3 Composition API, Vite, Tailwind-adjacent utility styling.
- LLM calls: always go through `app/utils/llm_client.py`, never call OpenAI SDK directly.
- Always strip `<think>...</think>` blocks and markdown code fences before parsing LLM JSON responses (the LLM client already handles this — don't duplicate the logic).
- `JSON_AS_ASCII=False` in Flask config is intentional (Chinese language support).
- File uploads: max 50MB, allowed types: pdf, md, txt, markdown. Stored in `backend/uploads/`.
- Graph pagination: use utility helpers in `app/utils/` for Zep node/edge fetches, never fetch all at once.

## Git Workflow

- Branch naming: `redline/<description>` (e.g., `redline/strip-reddit`, `redline/llm-abstraction`)
- Commit frequently during strip work so changes are reviewable and reversible
- After each STRIP target is removed, verify the app starts and the remaining workflow runs