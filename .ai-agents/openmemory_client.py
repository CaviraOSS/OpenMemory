#!/usr/bin/env python3
"""
OpenMemory Client for AI Agents System

This client library provides a simple interface for AI agents to interact
with OpenMemory's long-term memory system, enabling persistent state management,
context retrieval, and development history tracking.
"""

import requests
import json
from typing import Optional, Dict, List, Any
from datetime import datetime


class OpenMemoryClient:
    """Client for interacting with OpenMemory API"""

    def __init__(
        self,
        base_url: str = "http://localhost:8080",
        api_key: Optional[str] = None,
        user_id: str = "ai-agent-system",
        project_name: Optional[str] = None,
    ):
        """
        Initialize OpenMemory client

        Args:
            base_url: Base URL of OpenMemory server
            api_key: Optional API key for authentication
            user_id: User ID for memory isolation
            project_name: Default project name for operations
        """
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.user_id = user_id
        self.project_name = project_name
        self.session = requests.Session()

        if api_key:
            self.session.headers.update({"Authorization": f"Bearer {api_key}"})

    def health_check(self) -> Dict[str, Any]:
        """Check if OpenMemory server is available"""
        try:
            response = self.session.get(f"{self.base_url}/health")
            return response.json() if response.status_code == 200 else {}
        except Exception as e:
            print(f"[OpenMemory] Health check failed: {e}")
            return {}

    def save_project_state(
        self,
        state: Dict[str, Any],
        project_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Save project state to OpenMemory

        Args:
            state: Project state dictionary
            project_name: Project name (uses default if not provided)

        Returns:
            Response dict with memory_id
        """
        project_name = project_name or self.project_name
        if not project_name:
            raise ValueError("project_name must be provided")

        payload = {
            "project_name": project_name,
            "state": state,
            "user_id": self.user_id,
        }

        response = self.session.post(
            f"{self.base_url}/ai-agents/state",
            json=payload,
        )
        response.raise_for_status()
        return response.json()

    def load_project_state(
        self,
        project_name: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        Load project state from OpenMemory

        Args:
            project_name: Project name (uses default if not provided)

        Returns:
            Project state dict or None if not found
        """
        project_name = project_name or self.project_name
        if not project_name:
            raise ValueError("project_name must be provided")

        try:
            response = self.session.get(
                f"{self.base_url}/ai-agents/state/{project_name}",
                params={"user_id": self.user_id},
            )

            if response.status_code == 404:
                return None

            response.raise_for_status()
            data = response.json()
            return data.get("state")
        except Exception as e:
            print(f"[OpenMemory] Error loading project state: {e}")
            return None

    def detect_mode(
        self,
        project_name: Optional[str] = None,
    ) -> str:
        """
        Detect if project should run in INITIALIZE or RESUME mode

        Args:
            project_name: Project name (uses default if not provided)

        Returns:
            'INITIALIZE' or 'RESUME'
        """
        state = self.load_project_state(project_name)
        return "RESUME" if state else "INITIALIZE"

    def record_action(
        self,
        agent_name: str,
        action: str,
        context: Optional[str] = None,
        outcome: Optional[str] = None,
        project_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Record an agent action in episodic memory

        Args:
            agent_name: Name of the agent performing the action
            action: Description of the action
            context: Additional context
            outcome: Outcome of the action
            project_name: Project name (uses default if not provided)

        Returns:
            Response dict with memory_id
        """
        project_name = project_name or self.project_name
        if not project_name:
            raise ValueError("project_name must be provided")

        payload = {
            "project_name": project_name,
            "agent_name": agent_name,
            "action": action,
            "context": context,
            "outcome": outcome,
            "user_id": self.user_id,
        }

        response = self.session.post(
            f"{self.base_url}/ai-agents/action",
            json=payload,
        )
        response.raise_for_status()
        return response.json()

    def store_pattern(
        self,
        pattern_name: str,
        description: str,
        example: Optional[str] = None,
        tags: Optional[List[str]] = None,
        project_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Store a coding pattern in procedural memory

        Args:
            pattern_name: Name of the pattern
            description: Description of the pattern
            example: Code example
            tags: Additional tags
            project_name: Project name (uses default if not provided)

        Returns:
            Response dict with memory_id
        """
        project_name = project_name or self.project_name
        if not project_name:
            raise ValueError("project_name must be provided")

        payload = {
            "project_name": project_name,
            "pattern_name": pattern_name,
            "description": description,
            "example": example,
            "tags": tags or [],
            "user_id": self.user_id,
        }

        response = self.session.post(
            f"{self.base_url}/ai-agents/pattern",
            json=payload,
        )
        response.raise_for_status()
        return response.json()

    def record_decision(
        self,
        decision: str,
        rationale: str,
        alternatives: Optional[str] = None,
        consequences: Optional[str] = None,
        project_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Record an architectural decision in reflective memory

        Args:
            decision: The decision made
            rationale: Why this decision was made
            alternatives: Alternatives considered
            consequences: Expected consequences
            project_name: Project name (uses default if not provided)

        Returns:
            Response dict with memory_id
        """
        project_name = project_name or self.project_name
        if not project_name:
            raise ValueError("project_name must be provided")

        payload = {
            "project_name": project_name,
            "decision": decision,
            "rationale": rationale,
            "alternatives": alternatives,
            "consequences": consequences,
            "user_id": self.user_id,
        }

        response = self.session.post(
            f"{self.base_url}/ai-agents/decision",
            json=payload,
        )
        response.raise_for_status()
        return response.json()

    def query_memories(
        self,
        query: str,
        memory_type: str = "all",
        k: int = 10,
        project_name: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Query project memories

        Args:
            query: Query string
            memory_type: Type of memories ('state', 'actions', 'patterns', 'decisions', 'all')
            k: Number of results to return
            project_name: Project name (uses default if not provided)

        Returns:
            List of matching memories
        """
        project_name = project_name or self.project_name
        if not project_name:
            raise ValueError("project_name must be provided")

        payload = {
            "project_name": project_name,
            "query": query,
            "memory_type": memory_type,
            "k": k,
            "user_id": self.user_id,
        }

        response = self.session.post(
            f"{self.base_url}/ai-agents/query",
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("results", [])

    def get_history(
        self,
        limit: int = 50,
        project_name: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get development history

        Args:
            limit: Maximum number of entries to return
            project_name: Project name (uses default if not provided)

        Returns:
            List of historical actions
        """
        project_name = project_name or self.project_name
        if not project_name:
            raise ValueError("project_name must be provided")

        response = self.session.get(
            f"{self.base_url}/ai-agents/history/{project_name}",
            params={"limit": limit, "user_id": self.user_id},
        )
        response.raise_for_status()
        data = response.json()
        return data.get("history", [])

    def get_patterns(
        self,
        project_name: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get all coding patterns for the project

        Args:
            project_name: Project name (uses default if not provided)

        Returns:
            List of patterns
        """
        project_name = project_name or self.project_name
        if not project_name:
            raise ValueError("project_name must be provided")

        response = self.session.get(
            f"{self.base_url}/ai-agents/patterns/{project_name}",
            params={"user_id": self.user_id},
        )
        response.raise_for_status()
        data = response.json()
        return data.get("patterns", [])

    def get_decisions(
        self,
        project_name: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get all architectural decisions for the project

        Args:
            project_name: Project name (uses default if not provided)

        Returns:
            List of decisions
        """
        project_name = project_name or self.project_name
        if not project_name:
            raise ValueError("project_name must be provided")

        response = self.session.get(
            f"{self.base_url}/ai-agents/decisions/{project_name}",
            params={"user_id": self.user_id},
        )
        response.raise_for_status()
        data = response.json()
        return data.get("decisions", [])

    def get_full_context(
        self,
        project_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Get comprehensive project context including state, history, patterns, and decisions

        Args:
            project_name: Project name (uses default if not provided)

        Returns:
            Dict with comprehensive context
        """
        project_name = project_name or self.project_name
        if not project_name:
            raise ValueError("project_name must be provided")

        response = self.session.get(
            f"{self.base_url}/ai-agents/context/{project_name}",
            params={"user_id": self.user_id},
        )
        response.raise_for_status()
        data = response.json()
        return data.get("context", {})


def main():
    """Example usage"""
    import sys

    # Initialize client
    client = OpenMemoryClient(
        base_url="http://localhost:8080",
        project_name="example-project",
    )

    # Check health
    health = client.health_check()
    if not health.get("ok"):
        print("ERROR: OpenMemory server is not available")
        print("Please start OpenMemory server first:")
        print("  cd backend && npm run dev")
        sys.exit(1)

    print("✓ OpenMemory server is running")
    print(f"  Version: {health.get('version', 'unknown')}")

    # Detect mode
    mode = client.detect_mode()
    print(f"✓ Project mode: {mode}")

    if mode == "INITIALIZE":
        print("\nThis is a fresh project. Example operations:")
        print("  - Save initial state: client.save_project_state(state_dict)")
        print("  - Record action: client.record_action('architect', 'Created project structure')")
        print("  - Store pattern: client.store_pattern('MVC', 'Model-View-Controller pattern')")
        print("  - Record decision: client.record_decision('Use TypeScript', 'Better type safety')")
    else:
        print("\nThis project has existing state. Example operations:")
        print("  - Load state: client.load_project_state()")
        print("  - Get history: client.get_history()")
        print("  - Query memories: client.query_memories('latest changes')")
        print("  - Get patterns: client.get_patterns()")


if __name__ == "__main__":
    main()
