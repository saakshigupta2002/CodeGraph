"""Abstract AI provider interface."""

from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator


class AIProvider(ABC):
    """Base class for AI providers."""

    @abstractmethod
    async def explain(self, code: str, name: str, context: str) -> AsyncGenerator[str, None]:
        """Generate a streaming explanation for a code snippet.

        Args:
            code: The function/class source code
            name: The function/class name
            context: Brief context (file path, connections summary)

        Yields:
            Chunks of the explanation text
        """
        ...

    @abstractmethod
    async def search(self, query: str, graph_metadata: dict) -> list[dict]:
        """Search the graph using natural language.

        Args:
            query: Natural language search query
            graph_metadata: Dict with node names, types, edges (NOT code)

        Returns:
            List of matching nodes with scores/reasons
        """
        ...

    @abstractmethod
    async def analyze_file(self, file_metadata: dict) -> str:
        """Analyze a file's graph metadata and return insights.

        Args:
            file_metadata: Dict with file structure, dependencies, metrics

        Returns:
            Analysis text with insights and suggestions
        """
        ...

    @abstractmethod
    async def validate_key(self) -> bool:
        """Validate the API key with a lightweight test call."""
        ...
