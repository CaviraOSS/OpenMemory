"""
🧠 OpenMemory Python SDK - Brain-Inspired Memory System

Features:
- Multi-sector memory classification (episodic, semantic, procedural, emotional, reflective)
- Exponential decay with sector-specific rates
- Vector similarity search with cosine distance
- Embedding log system for crash safety
- Memory reinforcement and salience tracking
"""

import json
import urllib.request
from typing import Dict, List, Optional, Union, Any


class OpenMemory:
    """
    OpenMemory client for brain-inspired memory storage and retrieval.
    
    Supports five memory sectors:
    - Episodic: Event memories (temporal data)
    - Semantic: Facts & preferences (factual data) 
    - Procedural: Habits, triggers (action patterns)
    - Emotional: Sentiment states (tone analysis)
    - Reflective: Meta memory & logs (audit trail)
    """
    
    def __init__(self, api_key: str = '', base_url: str = 'http://localhost:8080'):
        """
        Initialize OpenMemory client.
        
        Args:
            api_key: Optional Bearer token for authentication
            base_url: Backend server URL
        """
        self.k = api_key
        self.u = base_url.rstrip('/')
    
    def _r(self, method: str, path: str, body: Optional[Dict] = None) -> Dict[str, Any]:
        """Internal request method."""
        headers = {'content-type': 'application/json'}
        if self.k:
            headers['authorization'] = 'Bearer ' + self.k
        
        data = None
        if body is not None:
            data = json.dumps(body).encode()
        
        req = urllib.request.Request(self.u + path, method=method, headers=headers, data=data)
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode())
    
    def health(self) -> Dict[str, bool]:
        """Check server health status."""
        return self._r('GET', '/health')
    
    def sectors(self) -> Dict[str, Any]:
        """Get brain sector information and statistics."""
        return self._r('GET', '/sectors')
    
    def add(self, content: str, tags: Optional[List[str]] = None, 
            metadata: Optional[Dict[str, Any]] = None, salience: float = 0.5, 
            decay_lambda: Optional[float] = None) -> Dict[str, Any]:
        """
        Add memory to the appropriate brain sector.
        
        Args:
            content: Memory content text
            tags: Optional list of tags
            metadata: Optional metadata dict (can include 'sector' for explicit routing)
            salience: Memory importance (0.0-1.0)
            decay_lambda: Custom decay rate (overrides sector default)
            
        Returns:
            Dict with memory ID and assigned sector
        """
        return self._r('POST', '/memory/add', {
            'content': content,
            'tags': tags or [],
            'metadata': metadata or {},
            'salience': salience,
            'decay_lambda': decay_lambda
        })
    
    def query(self, query: str, k: int = 8, 
              filters: Optional[Dict[str, Union[str, int, float, List[str]]]] = None) -> Dict[str, Any]:
        """
        Query memories with vector similarity search.
        
        Args:
            query: Search query text
            k: Number of results to return
            filters: Optional filters dict:
                - sector: Specific brain sector to search
                - min_score: Minimum similarity score
                - tags: Tag filters
                
        Returns:
            Dict with query and matched memories (includes sector info)
        """
        return self._r('POST', '/memory/query', {
            'query': query,
            'k': k,
            'filters': filters or {}
        })
    
    def query_sector(self, query: str, sector: str, k: int = 8) -> Dict[str, Any]:
        """
        Query memories from a specific brain sector.
        
        Args:
            query: Search query text
            sector: Brain sector ('episodic', 'semantic', 'procedural', 'emotional', 'reflective')
            k: Number of results to return
        """
        return self.query(query, k, {'sector': sector})
    
    def reinforce(self, memory_id: str, boost: float = 0.2) -> Dict[str, bool]:
        """
        Reinforce a memory by increasing its salience.
        
        Args:
            memory_id: Memory ID to reinforce
            boost: Salience boost amount (0.0-1.0)
        """
        return self._r('POST', '/memory/reinforce', {'id': memory_id, 'boost': boost})
    
    def update(self, memory_id: str, content: Optional[str] = None, 
               tags: Optional[List[str]] = None, 
               metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Update an existing memory.
        
        Args:
            memory_id: Memory ID to update
            content: New content (optional)
            tags: New tags (optional)
            metadata: New metadata (optional)
        """
        payload = {}
        if content is not None:
            payload['content'] = content
        if tags is not None:
            payload['tags'] = tags
        if metadata is not None:
            payload['metadata'] = metadata
            
        return self._r('PATCH', f'/memory/{memory_id}', payload)
    
    def all(self, limit: int = 100, offset: int = 0, sector: Optional[str] = None) -> Dict[str, List]:
        """
        Get all memories with pagination.
        
        Args:
            limit: Maximum memories to return
            offset: Pagination offset
            sector: Optional sector filter
        """
        url = f'/memory/all?l={limit}&u={offset}'
        if sector:
            url += f'&sector={sector}'
        return self._r('GET', url)
    
    def get_by_sector(self, sector: str, limit: int = 100, offset: int = 0) -> Dict[str, List]:
        """
        Get memories from a specific brain sector.
        
        Args:
            sector: Brain sector name
            limit: Maximum memories to return
            offset: Pagination offset
        """
        return self.all(limit, offset, sector)
    
    def delete(self, memory_id: str) -> Dict[str, bool]:
        """
        Delete a memory by ID.
        
        Args:
            memory_id: Memory ID to delete
        """
        return self._r('DELETE', f'/memory/{memory_id}')
    
    def reinforce(self, memory_id: str, boost: float = 0.1) -> Dict[str, Any]:
        """
        Reinforce a memory by boosting its salience.
        
        Args:
            memory_id: Memory ID to reinforce
            boost: Salience boost amount (default 0.1)
        """
        return self._r('POST', '/memory/reinforce', {
            'id': memory_id,
            'boost': boost
        })
    
    def get_sectors(self) -> Dict[str, Any]:
        """
        Get available brain sectors and their configurations.
        
        Returns:
            Dict with sector information and decay parameters
        """
        return self._r('GET', '/sectors')
    
    def get_health(self) -> Dict[str, Any]:
        """
        Get system health and statistics.
        
        Returns:
            Dict with system status, memory counts, and performance metrics
        """
        return self._r('GET', '/health')


# Brain sector constants for convenience
SECTORS = {
    'EPISODIC': 'episodic',      # Event memories
    'SEMANTIC': 'semantic',      # Facts & preferences  
    'PROCEDURAL': 'procedural',  # Habits, triggers
    'EMOTIONAL': 'emotional',    # Sentiment states
    'REFLECTIVE': 'reflective'   # Meta memory & logs
}