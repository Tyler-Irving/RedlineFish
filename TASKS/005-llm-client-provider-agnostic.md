# Task 005 — LLM Client Provider-Agnostic Cleanup

**Status**: complete
**Phase**: 1-2 bridge

## Verified

- [x] `oasis_profile_generator.py` migrated to LLMClient (Step 5)
- [x] `simulation_config_generator.py` migrated to LLMClient (Step 6)
- [x] `grep -n "from openai import OpenAI" backend/app/services/` → zero results
- [x] `grep -rn "qwen|Qwen|QWEN" backend/ --include="*.py"` → zero results
- [x] `LLM_BOOST_*` env vars in `run_parallel_simulation.py` are provider-agnostic
