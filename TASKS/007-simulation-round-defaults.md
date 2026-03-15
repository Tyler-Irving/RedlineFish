# Task 007 — Simulation Round Defaults

**Status**: partially done
**Phase**: 2
**Priority**: low

## Objective

Default simulation rounds to 10-15 (MiroFish recommended under 40).
SimulateView already defaults to 12 rounds (set during Step 11).

## Subtasks

- [x] SimulateView rounds input defaults to 12
- [ ] Verify the rounds value flows through to backend simulation config
- [ ] Verify `run_parallel_simulation.py` respects the configured round count
- [ ] Confirm round count appears in `simulation_config.json`

## References

- `CLAUDE.md` MODIFY section: "Simulation rounds"
