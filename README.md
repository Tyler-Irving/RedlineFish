<div align="center">

# Redline

**Strategy red-teaming for startups and campaigns.**

Upload your pitch deck. See how the crowd reacts.

[![GitHub Stars](https://img.shields.io/github/stars/Tyler-Irving/RedlineFish?style=flat-square)](https://github.com/Tyler-Irving/RedlineFish/stargazers)
[![Docker](https://img.shields.io/badge/Docker-Build-2496ED?style=flat-square&logo=docker&logoColor=white)](https://hub.docker.com/)

</div>

## Overview

Redline simulates how diverse audiences — early adopters, skeptics, journalists, investors — respond to your startup launch or marketing campaign on social media. It builds a knowledge graph from your uploaded documents, generates 50–80 diverse agent personas, and runs a Twitter-style multi-agent simulation. Then it produces a strategy report and lets you interview any agent directly.

**Three stages:**

1. **Upload** — Drop in your pitch deck, landing page, or campaign brief. Redline builds a knowledge graph and generates agent personas automatically.
2. **Simulate** — Agents interact on a Twitter-style feed, forming opinions, sharing content, and influencing each other over 10–15 simulated rounds.
3. **Explore** — Read the AI-generated strategy report, then interview any agent to understand the reasoning behind their reaction.

## Quick Start

### Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| **Node.js** | 18+ | `node -v` |
| **Python** | ≥3.11, ≤3.12 | `python --version` |
| **uv** | Latest | `uv --version` |

### 1. Configure Environment

```bash
cp .env.example .env
```

**Required variables:**

```env
# Any OpenAI-compatible LLM API
LLM_API_KEY=your_api_key
LLM_BASE_URL=https://your-provider.com/v1
LLM_MODEL_NAME=your-model

# Zep Cloud (free tier works for basic use)
# https://app.getzep.com/
ZEP_API_KEY=your_zep_api_key
```

### 2. Install Dependencies

```bash
# All at once
npm run setup:all

# Or step by step
npm run setup          # Node dependencies
npm run setup:backend  # Python dependencies
```

### 3. Start

```bash
npm run dev
```

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5001`

```bash
npm run backend   # Backend only
npm run frontend  # Frontend only
```

### Docker

```bash
cp .env.example .env
docker compose up -d
```

## Architecture

- **Backend**: Flask (Python 3.11+), service layer pattern, OpenAI-compatible LLM calls via `LLMClient`
- **Frontend**: Vue 3 + Vite, D3.js for knowledge graph visualization
- **Simulation engine**: [OASIS](https://github.com/camel-ai/oasis) (camel-ai)
- **Knowledge graph**: [Zep Cloud](https://www.getzep.com/) for storage, search, and agent memory

## Acknowledgements

Redline is a fork of [MiroFish](https://github.com/666ghj/MiroFish), built by the MiroFish team with strategic support from Shanda Group. The simulation engine is powered by [OASIS](https://github.com/camel-ai/oasis) from the CAMEL-AI team.
