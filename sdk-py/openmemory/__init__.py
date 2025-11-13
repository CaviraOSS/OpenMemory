"""
🧠 OpenMemory Python SDK

Brain-inspired memory system with multi-sector architecture,
exponential decay, and vector similarity search.

Includes agent registration, namespace management, and multi-agent collaboration.
"""

__version__ = "0.4.0"
__author__ = "OpenMemory Project"
__email__ = "contact@openmemory.dev"
__description__ = "Brain-inspired memory system client for Python applications"

from .client import OpenMemory
from .agent import OpenMemoryAgent, NamespaceManager, AgentRegistration, register_agent, create_agent_client

__all__ = [
    "OpenMemory", 
    "OpenMemoryAgent", 
    "NamespaceManager", 
    "AgentRegistration",
    "register_agent",
    "create_agent_client"
]