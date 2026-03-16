# Task 004 — Replace Chinese UI Labels with English

**Status**: complete
**Phase**: 2
**Priority**: medium

## Objective

Replace remaining Chinese strings in frontend components with English equivalents.
Phase 1 left functional Chinese strings in place; Phase 2 should English-first the UI.

## Known Locations

- [ ] `Step3Simulation.vue`: log strings like `'正在启动双平台并行模拟...'`, `'✓ 模拟引擎启动成功'`
- [ ] Scan all `.vue` files for remaining Chinese text: `grep -rn '[\u4e00-\u9fff]' frontend/src/ --include="*.vue"`

## Notes

- Keep `JSON_AS_ASCII=False` in Flask config — backend still needs Chinese language support for LLM responses
- Only replace UI-facing labels, not data or LLM prompts

## References

- `docs/PROGRESS.md` Session 3, note 8
- `CLAUDE.md` Phase 1 Done Criteria re: Chinese labels
