# CLAUDE.md — frontend/

This file provides guidance to Claude Code when working inside `frontend/`.
Cross-reference the root `CLAUDE.md` for the fork strategy and the Phase 1
goal: rebuild from 5-step to 3-panel layout.

## Tech Stack

- **Vue 3** with Composition API (`<script setup>` SFCs throughout)
- **Vite 7** — dev server on port 3000, proxies `/api/*` to `http://localhost:5001`
- **Vue Router 4** — HTML5 history mode (`createWebHistory`)
- **Axios** — wrapped in `src/api/index.js` with a `requestWithRetry` helper
- **D3.js v7** — force-directed graph visualization
- No TypeScript. No Vuex or Pinia.

## File Organization

```
src/
├── main.js              # App init, mounts to #app
├── App.vue              # Root component, router-view only
├── router/index.js      # Route table
├── store/pendingUpload.js  # Only store module (reactive singleton)
├── api/
│   ├── index.js         # Axios instance, requestWithRetry, interceptors
│   ├── graph.js         # /api/graph/* calls
│   ├── simulation.js    # /api/simulation/* calls
│   └── report.js        # /api/report/* calls
├── views/               # Route-level components (one per URL)
└── components/          # Reusable / step-level components
```

## Current Route Table (pre-strip)

| Route | View | Step |
|-------|------|------|
| `/` | `Home.vue` | Landing, upload form, history |
| `/process/:projectId` | `MainView.vue` | Steps 1–2 (graph + env setup) |
| `/simulation/:simulationId` | `SimulationView.vue` | Step 3 config |
| `/simulation/:simulationId/start` | `SimulationRunView.vue` | Step 3 run |
| `/report/:reportId` | `ReportView.vue` | Step 4 report |
| `/interaction/:reportId` | `InteractionView.vue` | Step 5 interview |

`MainView.vue`, `SimulationRunView.vue`, and `ReportView.vue` all share the same
layout shell: a fixed header with a view-mode switcher (`graph` / `split` / `workbench`),
a left panel containing `GraphPanel.vue`, and a right panel containing the step
component. This layout pattern is the one to carry forward into Redline.

## Phase 1 Rebuild Target

The 5-step flow maps to 6 routes and 5 step components. The Redline target is
**3 stages: Upload → Simulate → Explore**. The approach:

1. **Upload stage** — replace Steps 1 + 2 + ontology/graph building with a single
   upload view. Graph building and agent generation run automatically after upload
   with a progress indicator. No user interaction needed between upload and
   simulation.

2. **Simulate stage** — replace Steps 3 (config + run) with a single view. Show
   simulation progress (Twitter only; remove Reddit panel). Sensible defaults
   for agent count (50–80) and rounds (10–15), with optional overrides.

3. **Explore stage** — merge Steps 4 (report) and 5 (interview) into one panel.
   Report streams in section by section; interview is a sidebar or tab within the
   same view.

When rebuilding, start with the route table first, then the view shells, then
wire in the existing components or write replacements. Do not try to
incrementally modify the 5-step components — gut and replace.

## Current Step Components (STRIP targets for Phase 1)

| Component | Function | Fate |
|-----------|----------|------|
| `Step1GraphBuild.vue` | Ontology + graph build UI | Strip — logic becomes automatic |
| `Step2EnvSetup.vue` | Agent profile generation UI | Strip — logic becomes automatic |
| `Step3Simulation.vue` | Dual-platform run monitor | Modify — keep Twitter panel, remove Reddit panel |
| `Step4Report.vue` | Report section viewer + interview | Merge into Explore stage |
| `Step5Interaction.vue` | Agent chat + report agent chat | Merge into Explore stage |
| `GraphPanel.vue` | D3 force-directed graph | **KEEP** — reuse in new layout |
| `HistoryDatabase.vue` | Project history list on Home | **KEEP** or adapt |

## State Management

There is no Vuex or Pinia. State is handled at two levels:

**Route-level state**: Each view owns its state via `ref()` / `reactive()` in
`<script setup>`. State is not shared between views — when the user navigates to
the next stage, the next view fetches fresh data from the API using the IDs passed
as route params (`:projectId`, `:simulationId`, `:reportId`).

**Cross-route transient state**: `src/store/pendingUpload.js` is the only shared
store. It holds files + simulation requirement between the Home page upload form and
the first process view. Pattern:
```js
import { setPendingUpload, getPendingUpload, clearPendingUpload } from '../store/pendingUpload'
// Home.vue sets it, MainView.vue reads and clears it on mount
```

Do not add more global stores without a clear reason. Keep state local to views.

## API Layer Conventions

`src/api/index.js` exports a pre-configured Axios instance (`service`) and
`requestWithRetry(fn, maxRetries, delay)`.

- Use bare `service.get/post` for fast, non-critical reads.
- Use `requestWithRetry(() => service.post(...), 3, 1000)` for operations that
  start long-running backend tasks (ontology generation, simulation start, report
  generation). The retry uses exponential backoff.
- The response interceptor unwraps `response.data` and throws if `res.success` is
  falsy. Callers receive the `data` object directly, not the full response.
- All API functions are named exports in their respective module — no default export.
- The Axios timeout is 300 seconds (5 minutes) — intentional for LLM-backed calls.

**Polling pattern** (used for task status, simulation status, report sections):
```js
const pollInterval = setInterval(async () => {
  const res = await getTaskStatus(taskId)
  if (res.data.status === 'completed') {
    clearInterval(pollInterval)
    // handle completion
  }
}, 2000)
// Always clear the interval in onUnmounted()
```

## D3.js Usage

D3 is used for force-directed knowledge graph visualization. The canonical
implementation is in `GraphPanel.vue` (lines 240–760). `Process.vue` has a
simpler duplicate. For any new graph visualization, extend `GraphPanel.vue`
rather than writing a new D3 component.

Key patterns used:
- `d3.forceSimulation` with `forceLink`, `forceManyBody`, `forceCenter`,
  `forceCollide`, `forceX/Y`
- `d3.zoom()` for pan/zoom on the SVG
- `d3.drag()` on node elements
- `d3.scaleOrdinal()` for entity-type color coding
- Direct DOM mutation via `d3.select(ref.value)` and `.append()` chains —
  this is intentional; do not try to use Vue reactivity for SVG updates

The graph data shape the backend returns:
```js
{
  nodes: [{ id, name, uuid, entity_type, summary, attributes, ... }],
  edges: [{ source_id, target_id, relation_type, ... }]
}
```

Always call `simulation.stop()` and clear SVG contents before re-rendering
if graph data changes, or you will get duplicate nodes.

## Vue 3 Conventions

- Use `<script setup>` in all components. No Options API.
- Props: declare with `defineProps({...})`. Emits: declare with `defineEmits([...])`.
- Inter-component communication: props down, `$emit` up. Parent views hold state;
  step components are display + interaction only.
- `onMounted` / `onUnmounted` for setup/teardown. Always clean up `setInterval`
  and event listeners in `onUnmounted`.
- `computed()` for derived values (e.g., filtered lists, display strings).
  Do not compute in templates.
- Async data loading: `async function load() {...}` called in `onMounted`. Show
  a loading state ref (`loading = ref(true)`) while waiting.
- Styles are scoped (`<style scoped>`) in all components. Use `:deep()` only when
  targeting child component internals (e.g., D3-generated SVG elements).

## Styling Direction (Redline)

The current MiroFish UI uses a dark terminal aesthetic (black/white/orange,
monospace fonts, Chinese-language labels). For Redline, the CLAUDE.md target is
**Notion/Stripe-inspired: light background, generous whitespace, clean sans-serif**.

When rebuilding views:
- Light background (`#fff` or `#fafafa`), not dark
- Generous padding (24–40px sections)
- Clean sans-serif for body; monospace only for IDs, code, and data values
- Remove all Chinese UI labels; Redline is English-first
- Remove MiroFish branding (logos, name, orange tags)

## Reddit-Specific Frontend Code to Remove

Before rebuilding the Simulate stage, remove these Reddit references from the
existing components (or just delete the components wholesale during rebuild):

- `Step3Simulation.vue` — entire Reddit platform panel, `redditActionsCount`,
  `redditElapsedTime`, `prevRedditRound`, Reddit CSS classes
- `Step4Report.vue` — `redditAnswer` field, Reddit regex parsing, Reddit platform tab
- `Step5Interaction.vue` — `reddit_${agentId}` key preference in interview results,
  `platform='reddit'` profile fetch
- `Step1GraphBuild.vue` — `enable_reddit: true` in create simulation call
- `Step2EnvSetup.vue` — Reddit config display card, `has_reddit_config` log check
- `src/api/simulation.js` — change `platform = 'reddit'` defaults to `'twitter'`
