# CodeGraph

**A living X-ray of your codebase** — interactive dependency graph visualization & analysis platform.

## Quick Start

```bash
pip install -e .
codegraph start
```

This boots the FastAPI backend on `localhost:8000` and opens the browser to the frontend.

## Features

- **Multi-language AST parsing** — Python, JavaScript/TypeScript, Java, Go, Rust, C/C++, Ruby, PHP
- **Interactive dependency graph** — React Flow-based visualization with hierarchical layout
- **Impact analysis** — Visual blast radius showing what breaks if you change something
- **AI-powered explanations** — On-demand function explanations via OpenAI (BYOK)
- **Smart search** — Exact name match (instant, free) + natural language queries (AI)
- **Branch management** — Switch branches, compare diffs, incremental sync
- **Privacy-first** — Code never leaves your machine. Only individual function snippets sent to AI on explicit request.

## Supported Languages

Python, JavaScript, TypeScript, Java, Go, Rust, C, C++, Ruby, PHP
