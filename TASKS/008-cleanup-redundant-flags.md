# Task 008 — Clean Up Redundant CLI Flags and Dead Code

**Status**: complete
**Phase**: 3
**Priority**: low

## Objective

Post-strip cleanup of artifacts left intentionally during Phase 1 to avoid risk.

## Subtasks

- [x] Remove `--twitter-only` flag from `run_parallel_simulation.py` — already gone (removed in Phase 1)
- [x] Clean dormant Reddit code from `zep_tools.py` — simplified `interview_agents` to Twitter-only, removed reddit_profiles.json fallback in `_load_agent_profiles`
- [x] Clean dormant Reddit code from `zep_graph_memory_updater.py` — removed `'reddit'` from PLATFORM_DISPLAY_NAMES and `_platform_buffers` init
- [x] `platform` field on `AgentAction` — kept; frontend uses it for CSS class and icon display

## References

- `docs/PROGRESS.md` Session 2, notes 1-5
- `CLAUDE.md` "Do Not Touch" section (wait until Phase 3)
