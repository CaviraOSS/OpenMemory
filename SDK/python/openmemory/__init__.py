"""
🧠 OpenMemory Python SDK

Brain-inspired memory system with multi-sector architecture,
exponential decay, and vector similarity search.
"""

__version__ = "0.1.0"
__author__ = "OpenMemory Project"
__email__ = "contact@openmemory.dev"
__description__ = "Brain-inspired memory system client for Python applications"

from .client import OpenMemory

__all__ = ["OpenMemory"]