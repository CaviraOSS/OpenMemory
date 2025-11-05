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
        related_decision: Optional[str] = None,  # NEW
        used_pattern: Optional[str] = None,      # NEW
        project_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Record an agent action in episodic memory

        Args:
            agent_name: Name of the agent performing the action
            action: Description of the action
            context: Additional context
            outcome: Outcome of the action
            related_decision: Optional decision ID that led to this action
            used_pattern: Optional pattern ID used in this action
            project_name: Project name (uses default if not provided)

        Returns:
            Response dict with memory_id and links
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
            "related_decision": related_decision,
            "used_pattern": used_pattern,
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

    # =========================================================================
    # NEW METHODS: Emotional Memory, Waypoints, Pattern Detection, Smart Reinforcement
    # =========================================================================

    def record_emotion(
        self,
        agent_name: str,
        feeling: str,
        sentiment: str = "neutral",  # positive, negative, neutral, frustrated, confident
        confidence: float = 0.5,  # 0.0 - 1.0
        context: Optional[str] = None,
        related_action: Optional[str] = None,
        project_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Record agent emotional state

        Args:
            agent_name: Name of the agent
            feeling: Description of the feeling
            sentiment: Sentiment category
            confidence: Confidence level (0.0-1.0)
            context: What triggered this feeling
            related_action: Optional action ID this relates to
            project_name: Project name

        Returns:
            Response dict with memory_id
        """
        project_name = project_name or self.project_name
        if not project_name:
            raise ValueError("project_name must be provided")

        payload = {
            "project_name": project_name,
            "agent_name": agent_name,
            "feeling": feeling,
            "sentiment": sentiment,
            "confidence": confidence,
            "context": context,
            "related_action": related_action,
            "user_id": self.user_id,
        }

        response = self.session.post(
            f"{self.base_url}/ai-agents/emotion",
            json=payload,
        )
        response.raise_for_status()
        return response.json()

    def get_emotional_timeline(
        self,
        limit: int = 50,
        project_name: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get emotional timeline for project"""
        project_name = project_name or self.project_name
        if not project_name:
            raise ValueError("project_name must be provided")

        response = self.session.get(
            f"{self.base_url}/ai-agents/emotions/{project_name}",
            params={"limit": limit, "user_id": self.user_id},
        )
        response.raise_for_status()
        data = response.json()
        return data.get("emotions", [])

    def analyze_sentiment_trends(
        self,
        project_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Analyze sentiment trends over time"""
        project_name = project_name or self.project_name
        if not project_name:
            raise ValueError("project_name must be provided")

        response = self.session.get(
            f"{self.base_url}/ai-agents/sentiment/{project_name}",
            params={"user_id": self.user_id},
        )
        response.raise_for_status()
        return response.json()

    def link_memories(
        self,
        source_memory_id: str,
        target_memory_id: str,
        weight: float = 0.8,
        relationship: str = "related_to",
    ) -> Dict[str, Any]:
        """
        Create associative link between two memories

        Args:
            source_memory_id: Source memory ID
            target_memory_id: Target memory ID
            weight: Connection strength (0.0-1.0)
            relationship: Type of relationship

        Returns:
            Response dict
        """
        payload = {
            "source_memory_id": source_memory_id,
            "target_memory_id": target_memory_id,
            "weight": weight,
            "relationship": relationship,
        }

        response = self.session.post(
            f"{self.base_url}/ai-agents/link",
            json=payload,
        )
        response.raise_for_status()
        return response.json()

    def get_memory_graph(
        self,
        memory_id: str,
        depth: int = 2,
    ) -> Dict[str, Any]:
        """
        Get associative graph for a memory

        Args:
            memory_id: Root memory ID
            depth: How many hops to traverse

        Returns:
            Dict with waypoints and relationships
        """
        response = self.session.get(
            f"{self.base_url}/ai-agents/graph/{memory_id}",
            params={"depth": depth},
        )
        response.raise_for_status()
        return response.json()

    def trace_decision_to_actions(
        self,
        decision_memory_id: str,
    ) -> List[Dict[str, Any]]:
        """
        Trace from decision → patterns used → actions taken

        Returns full graph of related memories
        """
        graph = self.get_memory_graph(decision_memory_id, depth=3)
        return graph.get("waypoints", [])

    def reinforce_memory_smart(
        self,
        memory_id: str,
        reason: str,  # success, frequent_use, critical_decision, reference
    ) -> Dict[str, Any]:
        """
        Intelligently reinforce memory based on reason

        Args:
            memory_id: Memory ID to reinforce
            reason: Why reinforcing (affects boost amount)

        Returns:
            Response dict
        """
        payload = {
            "memory_id": memory_id,
            "reason": reason,
        }

        response = self.session.post(
            f"{self.base_url}/ai-agents/smart-reinforce",
            json=payload,
        )
        response.raise_for_status()
        return response.json()

    def get_memory_metrics(
        self,
        memory_id: str,
    ) -> Dict[str, Any]:
        """Get importance metrics for a memory"""
        response = self.session.get(
            f"{self.base_url}/ai-agents/metrics/{memory_id}",
        )
        response.raise_for_status()
        data = response.json()
        return data.get("metrics", {})

    def detect_patterns(
        self,
        lookback_days: int = 7,
        min_frequency: int = 3,
        project_name: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Automatically detect patterns from recent actions

        Args:
            lookback_days: How many days to analyze
            min_frequency: Minimum occurrences to consider a pattern
            project_name: Project name

        Returns:
            List of detected patterns
        """
        project_name = project_name or self.project_name
        if not project_name:
            raise ValueError("project_name must be provided")

        payload = {
            "project_name": project_name,
            "lookback_days": lookback_days,
            "min_frequency": min_frequency,
            "user_id": self.user_id,
        }

        response = self.session.post(
            f"{self.base_url}/ai-agents/detect-patterns",
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("patterns", [])

    def get_most_important_memories(
        self,
        memory_type: str = "all",
        limit: int = 10,
        project_name: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get most important memories (by salience * coactivations)

        Args:
            memory_type: Type filter (patterns, decisions, etc.)
            limit: How many to return
            project_name: Project name

        Returns:
            List of memories sorted by importance
        """
        project_name = project_name or self.project_name
        if not project_name:
            raise ValueError("project_name must be provided")

        payload = {
            "project_name": project_name,
            "memory_type": memory_type,
            "limit": limit,
            "user_id": self.user_id,
        }

        response = self.session.post(
            f"{self.base_url}/ai-agents/important",
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("memories", [])


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
