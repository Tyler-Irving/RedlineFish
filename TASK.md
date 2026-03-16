# TASK: Translate `to_text()` methods to match frontend parsers

## Description

Fix the critical backend/frontend mismatch introduced during Phase 2 polish:
the frontend `Step4Report.vue` parsers were updated to expect English section
headers, but the four `to_text()` methods in `zep_tools.py` still emit Chinese.
This silently breaks every tool-call result card in the Report step — `InsightForge`,
`PanoramaSearch`, `InterviewAgents`, and `AgentInterview` all parse as empty objects.

## Context

**Branch**: `redline/phase2-polish`

**Root cause**: Phase 2 translated UI labels and comments but missed the backend
dataclass `to_text()` methods, which generate structured text consumed by the
frontend regex parsers.

**Affected files**:
- `backend/app/services/zep_tools.py` — four `to_text()` methods emit Chinese headers
- `frontend/src/components/Step4Report.vue` — parsers expect English headers (already correct, do not change)

**Frontend parser regexes (source of truth — do not change these)**:

| Parser | Expected pattern |
|--------|-----------------|
| `parseInsightForge` | `### Sub-Queries`, `### [Key Facts]`, `### [Core Entities]`, `### [Relationship Chains]` |
| `parsePanorama` | `### [Active Facts]` |
| `parseInterview` | `**Interview Topic:**`, `**Interviewees:**`, `### Selection Rationale`, `### Interview Transcripts`, `#### Interview #\d+:`, `### Interview Summary & Key Insights` |
| `AgentInterview.to_text` | `_Bio: ..._`, `**Key Quotes:**` |

**Counter/stat regexes** (also in frontend, must match):
- `parseInsightForge`: `Relationship Chains:\s*(\d+)`
- `parsePanorama`: `Active Facts:\s*(\d+)`
- `parseInterview` count: `\*\*Interviewees:\*\*\s*(\d+)\s*\/\s*(\d+)`

## Requirements

1. Translate `InsightForgeResult.to_text()` (lines ~171–211) to emit English headers
   that exactly match the frontend regexes listed above.

2. Translate `PanoramaResult.to_text()` (lines ~250–278) to emit English headers.

3. Translate `AgentInterview.to_text()` (lines ~304–337) to emit `_Bio:` and
   `**Key Quotes:**` instead of `_简介:` and `**关键引言:**`.

4. Translate `InterviewResult.to_text()` (lines ~375–396) to emit English section
   headers and labels matching the frontend regexes.

5. Do **not** modify `Step4Report.vue` — the frontend parsers are already correct.

6. Do **not** change the Chinese LLM system prompts inside `zep_tools.py` (lines
   ~1108, ~1362, ~1589, ~1653, ~1707) — those are out of scope for this task.

7. Do **not** change `NodeInfo.to_text()` or `EdgeInfo.to_text()` — those are used
   for LLM context, not frontend parsing, and are out of scope.

## Technical Approach

### Step 1 — `InsightForgeResult.to_text()` (~line 171)

Replace Chinese with English equivalents:

| Current (Chinese) | Replace with (English) |
|-------------------|------------------------|
| `## 未来预测深度分析` | `## Deep Predictive Analysis` |
| `分析问题: {self.query}` | `Query: {self.query}` |
| `预测场景: {self.simulation_requirement}` | `Simulation Context: {self.simulation_requirement}` |
| `### 预测数据统计` | `### Statistics` |
| `- 关系链: {n}条` | `- Relationship Chains: {n}` |
| `### 分析的子问题` | `### Sub-Queries` |
| `### 【关键事实】(请在报告中引用这些原文)` | `### [Key Facts]` |
| `### 【核心实体】` | `### [Core Entities]` |
| `  摘要: "{...}"` | `  Summary: "{...}"` |
| `### 【关系链】` | `### [Relationship Chains]` |

### Step 2 — `PanoramaResult.to_text()` (~line 250)

| Current (Chinese) | Replace with (English) |
|-------------------|------------------------|
| `## 广度搜索结果（未来全景视图）` | `## Panorama Search Results` |
| `### 统计信息` | `### Statistics` |
| `- 当前有效事实: {n}条` | `- Active Facts: {n}` |
| `- 历史/过期事实: {n}条` | `- Historical/Expired Facts: {n}` |
| `### 【当前有效事实】(模拟结果原文)` | `### [Active Facts]` |
| `### 【历史/过期事实】(演变过程记录)` | `### [Historical/Expired Facts]` |
| `### 【涉及实体】` | `### [Entities Involved]` |

### Step 3 — `AgentInterview.to_text()` (~line 304)

| Current (Chinese) | Replace with (English) |
|-------------------|------------------------|
| `_简介: {self.agent_bio}_` | `_Bio: {self.agent_bio}_` |
| `**关键引言:**` | `**Key Quotes:**` |

### Step 4 — `InterviewResult.to_text()` (~line 375)

| Current (Chinese) | Replace with (English) |
|-------------------|------------------------|
| `## 深度采访报告` | `## Deep Interview Report` |
| `**采访主题:** {self.interview_topic}` | `**Interview Topic:** {self.interview_topic}` |
| `**采访人数:** {n} / {m} 位模拟Agent` | `**Interviewees:** {n} / {m}` |
| `### 采访对象选择理由` | `### Selection Rationale` |
| `### 采访实录` | `### Interview Transcripts` |
| `#### 采访 #{i}: {name}` | `#### Interview #{i}: {name}` |
| `（无采访记录）` | `(No interview records)` |
| `### 采访摘要与核心观点` | `### Interview Summary & Key Insights` |
| `（无摘要）` | `(No summary)` |

### Step 5 — Verify

Confirm each regex in `Step4Report.vue` matches the updated output strings. Run a
full backend import check (`cd backend && uv run python -c "from app import create_app; create_app()"`)
and a frontend build (`cd frontend && npm run build`).

## Acceptance Criteria

- [ ] `InsightForgeResult.to_text()` emits `### Sub-Queries`, `### [Key Facts]`,
      `### [Core Entities]`, `### [Relationship Chains]`, and `Relationship Chains: N`
      (matching `parseInsightForge` regexes exactly)
- [ ] `PanoramaResult.to_text()` emits `### [Active Facts]` and `Active Facts: N`
      (matching `parsePanorama` regexes exactly)
- [ ] `AgentInterview.to_text()` emits `_Bio:` and `**Key Quotes:**`
      (matching `parseInterview` block regex exactly)
- [ ] `InterviewResult.to_text()` emits `**Interview Topic:**`, `**Interviewees:** N / M`,
      `### Selection Rationale`, `### Interview Transcripts`, `#### Interview #N:`,
      and `### Interview Summary & Key Insights`
- [ ] No other logic in `zep_tools.py` is changed (LLM prompts, IPC, API calls)
- [ ] `Step4Report.vue` is not modified
- [ ] Backend imports cleanly with no errors
- [ ] Frontend build completes with no errors

## Definition of Done

- [ ] All acceptance criteria met
- [ ] Lint passes
- [ ] TypeScript compiles (`cd frontend && npm run build`)
- [ ] Backend imports without errors
- [ ] No console errors
- [ ] `claude-progress.txt` updated
