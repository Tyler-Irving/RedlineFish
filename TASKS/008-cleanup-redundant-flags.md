# Task 008 — Clean Up Redundant CLI Flags and Dead Code

**Status**: not started
**Phase**: 3
**Priority**: low

## Objective

Post-strip cleanup of artifacts left intentionally during Phase 1 to avoid risk.

## Subtasks

- [ ] Remove `--twitter-only` flag from `run_parallel_simulation.py` (now redundant — all runs are Twitter-only)
- [ ] Clean dormant Reddit code from `zep_tools.py` (dual-platform interview parsing, reddit_profiles.json fallback)
- [ ] Clean dormant Reddit code from `zep_graph_memory_updater.py` (`'reddit': '世界2'`, `'reddit': []`)
- [ ] Remove `platform` field from `AgentAction` if frontend no longer needs it for CSS

## References

- `docs/PROGRESS.md` Session 2, notes 1-5
- `CLAUDE.md` "Do Not Touch" section (wait until Phase 3)
