"""OpenAI API implementation of the AI provider."""

import json
import logging
from collections.abc import AsyncGenerator

from openai import AsyncOpenAI

from backend.ai.provider import AIProvider

logger = logging.getLogger(__name__)


class OpenAIProvider(AIProvider):
    """OpenAI-backed AI provider."""

    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        self.client = AsyncOpenAI(api_key=api_key)
        self.model = model

    async def explain(self, code: str, name: str, context: str) -> AsyncGenerator[str, None]:
        prompt = f"""Explain the following code element in three parts:

1. **Summary**: One-line plain-English description.
2. **Why It Exists**: Context sentence explaining its role in the system.
3. **Connections Summary**: Key relationships (what it depends on, what uses it).

Code element: `{name}`
Context: {context}

```
{code}
```

Provide a clear, concise explanation following the three-part format above."""

        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a code explanation assistant. Be concise and precise."},
                {"role": "user", "content": prompt},
            ],
            stream=True,
            max_tokens=500,
            temperature=0.3,
        )

        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def search(self, query: str, graph_metadata: dict) -> list[dict]:
        # Build a compact representation of the graph
        nodes_summary = []
        for node in graph_metadata.get("nodes", [])[:500]:  # Limit to keep tokens low
            nodes_summary.append(f"- {node['type']}: {node['name']} ({node['file_path']})")

        prompt = f"""Given this codebase structure, find the most relevant items matching the query.

Query: "{query}"

Codebase elements:
{chr(10).join(nodes_summary)}

Return a JSON array of matching items. Each item should have:
- "name": the element name
- "type": the element type
- "file_path": the file path
- "reason": brief explanation of why it matches

Return only the JSON array, no other text. Return at most 10 results, ordered by relevance."""

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a code search assistant. Return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=800,
            temperature=0.1,
        )

        try:
            text = response.choices[0].message.content.strip()
            # Strip markdown code fences if present
            if text.startswith("```"):
                text = text.split("\n", 1)[1]
                text = text.rsplit("```", 1)[0]
            return json.loads(text)
        except (json.JSONDecodeError, IndexError):
            return []

    async def analyze_file(self, file_metadata: dict) -> str:
        prompt = f"""Analyze this file's structure and provide insights:

File: {file_metadata.get('file_path', 'unknown')}
Language: {file_metadata.get('language', 'unknown')}
Functions: {file_metadata.get('function_count', 0)}
Classes: {file_metadata.get('class_count', 0)}
External dependencies: {file_metadata.get('external_deps', 0)}
Internal dependencies: {file_metadata.get('internal_deps', 0)}
Dependent files (files that import this): {file_metadata.get('dependents', 0)}
Lines: {file_metadata.get('line_count', 0)}

Provide 2-3 actionable insights about:
- Coupling level (too many dependencies?)
- Single points of failure (heavily depended on, no tests?)
- Suggestions for improvement

Be concise and specific."""

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are a code architecture advisor. Be concise."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=400,
            temperature=0.3,
        )

        return response.choices[0].message.content.strip()

    async def validate_key(self) -> bool:
        try:
            await self.client.models.list()
            return True
        except Exception:
            return False
