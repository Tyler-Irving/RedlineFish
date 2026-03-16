# Task 006 — Configure Agent Count Defaults

**Status**: not started
**Phase**: 2
**Priority**: low

## Objective

MiroFish targeted 100+ agents. Redline MVP should default to 50-80 agents for
cost reasons, with the count being user-configurable.

## Subtasks

- [ ] Audit where agent count is set (profile generator, simulation config, frontend inputs)
- [ ] Set default to 60 agents
- [ ] Ensure UploadView or SimulateView exposes the agent count input
- [ ] Verify the count flows through to `oasis_profile_generator.py` → `run_parallel_simulation.py`

## References

- `CLAUDE.md` MODIFY section: "Agent count defaults"
