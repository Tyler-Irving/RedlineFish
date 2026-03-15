# CLAUDE.md — backend/

This file provides guidance to Claude Code when working inside `backend/`.
Cross-reference the root `CLAUDE.md` for the fork strategy, KEEP/STRIP targets,
and Phase 1 goals.

## Entry Point and App Factory

`run.py` → calls `app/__init__.py:create_app()` → registers three Flask blueprints
and the `SimulationRunner` cleanup hook, then returns the app.

The app factory is the only place that registers blueprints and global middleware.
Do not import blueprints anywhere else.

## Blueprint Layout

Blueprints are defined in `app/api/__init__.py` and their routes live in three files:

| Blueprint | Prefix | File | Responsibility |
|-----------|--------|------|----------------|
| `graph_bp` | `/api/graph` | `app/api/graph.py` | Project CRUD, file upload, ontology generation, graph building, task polling |
| `simulation_bp` | `/api/simulation` | `app/api/simulation.py` | Simulation lifecycle, entity reads, agent profiles, run status, interview |
| `report_bp` | `/api/report` | `app/api/report.py` | Report generation, section polling, chat, agent/console logs |

Each blueprint file imports service classes and model managers directly — no
cross-blueprint imports. Routes do not contain business logic; they validate
input, call a service, and return `jsonify({"success": True/False, ...})`.

All API responses follow this shape:
```python
{"success": True, "data": {...}}          # success
{"success": False, "error": "...", ...}   # failure (with optional "traceback")
```

## Service Layer

`app/services/` contains one class per concern. A route handler instantiates
the relevant service class directly — there is no dependency injection framework.

### KEEP (Phase 1 must not touch)

| Service | What it does |
|---------|-------------|
| `ontology_generator.py` | `OntologyGenerator` — LLM call to extract entity/relation types from document text |
| `graph_builder.py` | `GraphBuilderService` — creates Zep graph, sets ontology, uploads text batches, waits for episode processing |
| `text_processor.py` | `TextProcessor` — thin wrapper around `FileParser` and `split_text_into_chunks` |
| `zep_entity_reader.py` | `ZepEntityReader` — queries Zep by entity type, enriches with edge context |
| `oasis_profile_generator.py` | `OasisProfileGenerator` — converts Zep entities into OASIS agent profiles; saves as `twitter_profiles.csv` or `reddit_profiles.json` |
| `simulation_config_generator.py` | `SimulationConfigGenerator` — LLM-driven config generation for agent activity, timing, initial events |
| `simulation_manager.py` | `SimulationManager` — creates/prepares/saves simulation state; orchestrates profile + config generation |
| `simulation_runner.py` | `SimulationRunner` — spawns `run_parallel_simulation.py` as a subprocess; monitors `actions.jsonl` and `run_state.json` for status |
| `simulation_ipc.py` | `SimulationIPCClient` — writes command JSON to `ipc/commands/`, polls `ipc/responses/` for results |
| `zep_graph_memory_updater.py` | `ZepGraphMemoryManager` — writes simulation action summaries back into Zep after a run |
| `report_agent.py` | `ReportAgent` — 600-line ReACT loop: plans outline, iterates sections, calls ZepTools, writes section files incrementally |
| `zep_tools.py` | `ZepToolsService` — tools the ReportAgent calls: `insight_forge`, `panorama_search`, `quick_search`, `interview_agents` |

### STRIP (Phase 1)

- Reddit-specific branches throughout `simulation_manager.py`, `simulation_runner.py`,
  `oasis_profile_generator.py`, `simulation_config_generator.py` — see root CLAUDE.md
  inventory for exact line references.
- `scripts/run_reddit_simulation.py` — delete entirely.
- Reddit class inside `scripts/run_parallel_simulation.py` — extract Twitter runner
  only; do not modify the Twitter logic itself.

### DO NOT TOUCH (until Phase 3)

- `scripts/run_parallel_simulation.py` — complex async OASIS orchestration. Read it
  to understand, but leave the Twitter-side code unchanged.
- `services/report_agent.py` — 600-line ReACT loop with tool calls.

## Models

`app/models/project.py` — `Project` dataclass + `ProjectManager` (class methods only).
Persistence: JSON files under `backend/uploads/projects/<project_id>/project.json`.
`ProjectManager` is **not** a singleton — instantiate it freely, it reads from disk.

`app/models/task.py` — `Task` dataclass + `TaskManager`. Persistence: **in-memory only**
(singleton via `__new__`). Tasks are lost on server restart. This is intentional —
tasks are only needed while an async operation is in flight.

## LLM Client Rules

All LLM calls must go through `app/utils/llm_client.py:LLMClient`.

```python
from ..utils.llm_client import LLMClient

client = LLMClient()                     # reads from Config
text = client.chat(messages)             # returns str, <think> tags already stripped
data = client.chat_json(messages)        # returns dict, code fences already stripped
```

`LLMClient.chat()` strips `<think>...</think>` blocks (for reasoning models like
MiniMax/GLM) before returning. `LLMClient.chat_json()` additionally strips markdown
code fences before `json.loads()`. Never replicate this logic elsewhere.

**Known violation**: `simulation_config_generator.py` instantiates `OpenAI` directly
instead of using `LLMClient`. When touching that file during Reddit stripping, migrate
its LLM calls to `LLMClient`.

## Utility Modules

`app/utils/file_parser.py` — `FileParser.extract_text(path)` dispatches to PDF
(PyMuPDF/fitz), MD, or TXT handlers. Text files use multi-level encoding detection
(UTF-8 → charset_normalizer → chardet → UTF-8/replace). `split_text_into_chunks()`
splits on Chinese sentence endings first, then falls back to char count.

`app/utils/zep_paging.py` — `fetch_all_nodes(client, graph_id)` and
`fetch_all_edges(client, graph_id)`. Zep uses UUID cursor pagination. Never call
`client.graph.node.get_by_graph_id` or `client.graph.edge.get_by_graph_id` directly
in a loop — use these helpers. Nodes are capped at 2000 per fetch.

`app/utils/retry.py` — `@retry_with_backoff(max_retries=3)` decorator with exponential
backoff and jitter. `RetryableAPIClient` for batch retries. Use for any external API
call that isn't already wrapped in `LLMClient`.

`app/utils/logger.py` — `get_logger('mirofish.subsystem')` returns a logger that
writes to both rotating file (`backend/logs/YYYY-MM-DD.log`) and stdout. Use the
dotted hierarchy: `mirofish.api`, `mirofish.simulation`, `mirofish.zep_paging`, etc.
Never use `print()` in service code — use the logger.

## Config

`app/config.py` — `Config` class reads from the root `.env` via `python-dotenv`.
All service classes read from `Config` — never read `os.environ` directly in a
service. Key values:

- `Config.LLM_API_KEY`, `Config.LLM_BASE_URL`, `Config.LLM_MODEL_NAME`
- `Config.ZEP_API_KEY`
- `Config.UPLOAD_FOLDER` → `backend/uploads/`
- `Config.OASIS_SIMULATION_DATA_DIR` → `backend/uploads/simulations/`
- `Config.OASIS_REDDIT_ACTIONS` — **STRIP TARGET**, remove this list

## Async Pattern

Long-running operations (graph building, report generation) use `threading.Thread`
with a daemon thread spawned from a route handler. The route returns a `task_id`
immediately. The frontend polls `GET /api/graph/task/<task_id>` or
`POST /api/report/generate/status` for progress.

Simulation execution uses `subprocess.Popen` (not a thread) via `SimulationRunner`.
This is intentional — OASIS holds GPU/memory resources that must be isolated.
IPC between Flask and the subprocess is file-based: `ipc/commands/*.json` and
`ipc/responses/*.json` inside the simulation directory.

Never inline OASIS execution into the Flask process.

## Persistence Layout

```
backend/uploads/
├── projects/
│   └── proj_<id>/
│       ├── project.json          # Project metadata (ProjectManager)
│       ├── extracted_text.txt    # Concatenated upload text
│       └── files/                # Raw uploaded files (UUID-renamed)
└── simulations/
    └── sim_<id>/
        ├── state.json            # SimulationState (SimulationManager)
        ├── simulation_config.json
        ├── twitter_profiles.csv  # KEEP
        ├── reddit_profiles.json  # STRIP
        ├── twitter/actions.jsonl # KEEP
        ├── reddit/actions.jsonl  # STRIP
        ├── reports/
        │   ├── report_<id>.json
        │   ├── report_<id>.md
        │   ├── section_01.md ... # Incremental section files
        │   ├── agent_log.jsonl   # Structured ReACT step log
        │   └── console_log.txt
        └── ipc/
            ├── commands/         # Flask writes here
            └── responses/        # Subprocess writes here
```

## Python Conventions

- Python 3.11+. Use type hints on all function signatures in service classes.
- Dataclasses (`@dataclass`) for data models. Use `field(default_factory=...)` for
  mutable defaults. Always implement `to_dict()` and `from_dict()` / `from_object()`.
- Enums: inherit from `(str, Enum)` so enum values serialize cleanly to JSON.
- No global mutable state except `TaskManager` (singleton by design) and
  `SimulationRunner._processes` (subprocess registry).
- Exception handling in route handlers: catch broadly, return
  `{"success": False, "error": str(e), "traceback": traceback.format_exc()}` with
  status 500. In service classes: let exceptions propagate up, log with
  `logger.error(...)` before re-raising.
- `JSON_AS_ASCII = False` is intentional. Chinese strings must round-trip correctly.
