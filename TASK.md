# TASK: Fix pre-PR review findings on redline/phase1-strip

## Description

Address all warnings found during `/review` of the `redline/phase1-strip` branch
before merging to main. One blocker (timer leak), three functional warnings, and
one backend robustness issue.

## Context

Branch: `redline/phase1-strip` (6 commits ahead of main)
Review verdict: **FIX FIRST** — timer leak blocks merge.

Key files:
- `frontend/src/views/UploadView.vue` — new 4-phase pipeline view
- `frontend/src/views/ExploreView.vue` — merged report+interview view
- `backend/app/utils/llm_client.py` — provider-agnostic LLM wrapper
- `backend/app/services/oasis_profile_generator.py` — agent persona generator

## Requirements

### 1. Fix `waitForPrepareTask` timer leak (BLOCKER)

**File:** `frontend/src/views/UploadView.vue:409`

`waitForPrepareTask` creates a `setInterval` stored in a local `const timer`
inside a Promise constructor. If the user navigates away during agent generation,
this interval fires indefinitely — no reference exists to clear it.

**Fix:** Store the interval ID in a module-level variable (`preparePollTimer`)
and clear it in `onUnmounted`, matching the existing pattern used by
`taskPollTimer` and `profilePollTimer`.

### 2. Fix broken graph refresh in ExploreView

**File:** `frontend/src/views/ExploreView.vue:~699`

`refreshGraph` reads `graphData.value?.graph_id` but graph data has shape
`{ nodes, edges }` — no `graph_id` key. The manual refresh button silently
does nothing.

**Fix:** Store `graphId` in a separate `ref` when first resolved during
`loadData`, and use that ref in `refreshGraph`.

### 3. Guard `dataReady` against failed report fetch in ExploreView

**File:** `frontend/src/views/ExploreView.vue:~663`

`loadData` sets `dataReady = true` in a `finally` block even when `getReport`
fails, causing child components to mount with `simulationId=null`.

**Fix:** Only set `dataReady = true` on success. On failure, set an error state
that prevents child component mounting.

### 4. Narrow exception catch in `chat_json` fallback

**File:** `backend/app/utils/llm_client.py:96`

The `except Exception` catch on the first `chat()` call swallows auth failures,
network errors, and misconfiguration — all silently retry without
`response_format`. The intent is to handle providers that don't support
`json_object` format.

**Fix:** Narrow the catch. Import `openai.BadRequestError` and catch only that
(plus `openai.APIError` with status 400). Re-raise all other exceptions.

### 5. Use `chat_json()` in profile generator instead of manual parse

**File:** `backend/app/services/oasis_profile_generator.py:494`

`_generate_profile_with_llm` calls `self.llm_client.chat()` with
`response_format={"type": "json_object"}` then manually calls `json.loads()`.
This bypasses `chat_json()`'s markdown fence stripping and provider fallback.

**Fix:** Replace the `chat()` + manual `json.loads()` with `chat_json()`.
Remove the manual `response_format` kwarg (handled internally by `chat_json`).
Keep the existing `_try_fix_json` fallback for `JSONDecodeError` since
`chat_json` returns a string, not a dict — parse the returned string and
fall back on failure.

## Technical Approach

1. Start with requirement 1 (blocker). Add `let preparePollTimer = null` at
   module level. Replace local `const timer` with assignment to
   `preparePollTimer`. Add cleanup in `onUnmounted`.

2. Fix requirement 2. Add `const graphId = ref(null)` to ExploreView. Populate
   it from report data in `loadData`. Use it in `refreshGraph`.

3. Fix requirement 3. Move `dataReady.value = true` inside the success path.
   Add a `loadError` ref. Show error state in template when set.

4. Fix requirement 4. Import `BadRequestError` from `openai`. Narrow the
   catch clause. Add a comment explaining why.

5. Fix requirement 5. Change `self.llm_client.chat(messages, ...)` to
   `self.llm_client.chat_json(messages, ...)` in `_generate_profile_with_llm`.
   Adjust the response handling since `chat_json` returns a string (the cleaned
   content), not a dict.

6. Run `npm run dev` smoke test — verify UploadView pipeline and ExploreView
   load without console errors.

## Acceptance Criteria

- [ ] `waitForPrepareTask` interval is cleared on component unmount
- [ ] ExploreView graph refresh button works (uses stored `graphId`)
- [ ] ExploreView does not mount children with null IDs on report fetch failure
- [ ] `chat_json` only catches provider-format errors, not auth/network errors
- [ ] Profile generator uses `chat_json()` with fence stripping
- [ ] No new console errors in browser dev tools during Upload and Explore flows

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Lint passes (`cd frontend && npx vue-tsc --noEmit 2>/dev/null; npx eslint src/`)
- [ ] No console errors in browser during smoke test
- [ ] claude-progress.txt updated
