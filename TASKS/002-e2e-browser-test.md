# Task 002 — End-to-End Browser Test

**Status**: not started
**Phase**: 1 (verification)
**Branch**: `redline/phase1-strip`
**Priority**: high (blocks Phase 1 sign-off)

## Objective

Manually verify the full 3-stage workflow works end-to-end in the browser after
all Phase 1 strip and rebuild work.

## Test Steps

- [ ] `npm run dev` — both frontend (3000) and backend (5001) start cleanly
- [ ] Home page loads with Redline branding, no console errors
- [ ] Upload a document → redirected to `/upload/:projectId`
- [ ] UploadView pipeline runs automatically (ontology → graph build → create sim → prepare)
- [ ] GraphPanel renders on the left during build
- [ ] "Continue to Simulate" button appears on completion
- [ ] SimulateView shows config panel (rounds input, default 12)
- [ ] Start simulation → Step3Simulation monitor works, `twitter/actions.jsonl` grows
- [ ] "Generate Report" navigates to `/explore/:reportId`
- [ ] ExploreView Report tab streams report sections
- [ ] ExploreView Interview tab loads agents and accepts questions
- [ ] HistoryDatabase navigation works (all 3 route transitions)

## References

- `docs/PROGRESS.md` Session 3 "Next steps"
- Phase 1 Done Criteria in `docs/PHASE1_PLAN.md`
