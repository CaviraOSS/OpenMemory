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
            decay_lambda: Optional[float] = None, user_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Add memory to the appropriate brain sector.
        
        Args:
            content: Memory content text
            tags: Optional list of tags
            metadata: Optional metadata dict (can include 'sector' for explicit routing)
            salience: Memory importance (0.0-1.0)
            decay_lambda: Custom decay rate (overrides sector default)
            user_id: Optional user ID for multi-user isolation
            
        Returns:
            Dict with memory ID and assigned sector
        """
        payload = {
            'content': content,
            'tags': tags or [],
            'metadata': metadata or {},
            'salience': salience,
            'decay_lambda': decay_lambda
        }
        if user_id is not None:
            payload['user_id'] = user_id
        return self._r('POST', '/memory/add', payload)
    
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
                - user_id: User ID for filtering user-specific memories
                
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
    
    def get_user_memories(self, user_id: str, limit: int = 100, offset: int = 0) -> Dict[str, Any]:
        """
        Get all memories for a specific user.
        
        Args:
            user_id: User ID
            limit: Maximum memories to return
            offset: Pagination offset
            
        Returns:
            Dict with user_id and list of memories
        """
        url = f'/users/{user_id}/memories?l={limit}&u={offset}'
        return self._r('GET', url)
    
    def get_user_summary(self, user_id: str) -> Dict[str, Any]:
        """
        Get user summary with reflection count and last update time.
        
        Args:
            user_id: User ID
            
        Returns:
            Dict with user_id, summary, reflection_count, updated_at
        """
        return self._r('GET', f'/users/{user_id}/summary')
    
    def regenerate_user_summary(self, user_id: str) -> Dict[str, Any]:
        """
        Regenerate user summary from their memories.
        
        Args:
            user_id: User ID
            
        Returns:
            Dict with ok status, user_id, new summary, reflection_count
        """
        return self._r('POST', f'/users/{user_id}/summary/regenerate')
    
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
    
    # IDE Routes
    def ide_store_event(self, event_type: str, file_path: Optional[str] = None, 
                        content: Optional[str] = None, session_id: Optional[str] = None,
                        metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Store an IDE event as a memory.
        
        Args:
            event_type: Type of IDE event
            file_path: Optional file path
            content: Optional content
            session_id: Optional session ID
            metadata: Optional metadata
            
        Returns:
            Dict with success status, memory_id, primary_sector, sectors
        """
        payload = {'event_type': event_type}
        if file_path: payload['file_path'] = file_path
        if content: payload['content'] = content
        if session_id: payload['session_id'] = session_id
        if metadata: payload['metadata'] = metadata
        return self._r('POST', '/api/ide/events', payload)
    
    def ide_query_context(self, query: str, k: Optional[int] = None, 
                          session_id: Optional[str] = None, 
                          file_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Query IDE context memories.
        
        Args:
            query: Search query
            k: Number of results
            session_id: Optional session filter
            file_path: Optional file path filter
            
        Returns:
            Dict with success, memories, total, query
        """
        payload = {'query': query}
        if k is not None: payload['k'] = k
        if session_id: payload['session_id'] = session_id
        if file_path: payload['file_path'] = file_path
        return self._r('POST', '/api/ide/context', payload)
    
    def ide_start_session(self, user_id: Optional[str] = None, 
                          project_name: Optional[str] = None,
                          ide_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Start an IDE session.
        
        Args:
            user_id: Optional user ID
            project_name: Optional project name
            ide_name: Optional IDE name
            
        Returns:
            Dict with success, session_id, memory_id, started_at, etc.
        """
        payload = {}
        if user_id: payload['user_id'] = user_id
        if project_name: payload['project_name'] = project_name
        if ide_name: payload['ide_name'] = ide_name
        return self._r('POST', '/api/ide/session/start', payload)
    
    def ide_end_session(self, session_id: str) -> Dict[str, Any]:
        """
        End an IDE session.
        
        Args:
            session_id: Session ID to end
            
        Returns:
            Dict with success, session_id, ended_at, summary_memory_id, statistics
        """
        return self._r('POST', '/api/ide/session/end', {'session_id': session_id})
    
    def ide_get_patterns(self, session_id: str) -> Dict[str, Any]:
        """
        Get detected patterns for an IDE session.
        
        Args:
            session_id: Session ID
            
        Returns:
            Dict with success, session_id, pattern_count, patterns
        """
        return self._r('GET', f'/api/ide/patterns/{session_id}')
    
    # Compression Routes
    def compress(self, text: str, algorithm: Optional[str] = None) -> Dict[str, Any]:
        """
        Compress text using specified or auto-detected algorithm.
        
        Args:
            text: Text to compress
            algorithm: Optional algorithm ('semantic', 'syntactic', 'aggressive')
            
        Returns:
            Dict with ok, comp (compressed text), m (metrics), hash
        """
        payload = {'text': text}
        if algorithm: payload['algorithm'] = algorithm
        return self._r('POST', '/api/compression/compress', payload)
    
    def compress_batch(self, texts: List[str], algorithm: str = 'semantic') -> Dict[str, Any]:
        """
        Batch compress multiple texts.
        
        Args:
            texts: List of texts to compress
            algorithm: Compression algorithm
            
        Returns:
            Dict with ok, results, total
        """
        return self._r('POST', '/api/compression/batch', {'texts': texts, 'algorithm': algorithm})
    
    def analyze_compression(self, text: str) -> Dict[str, Any]:
        """
        Analyze compression options for text.
        
        Args:
            text: Text to analyze
            
        Returns:
            Dict with ok, analysis, rec (recommendation)
        """
        return self._r('POST', '/api/compression/analyze', {'text': text})
    
    def get_compression_stats(self) -> Dict[str, Any]:
        """
        Get compression statistics.
        
        Returns:
            Dict with ok and stats
        """
        return self._r('GET', '/api/compression/stats')
    
    # LangGraph Memory Routes
    def lgm_store(self, node_id: str, content: str, 
                  namespace: Optional[str] = None,
                  metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Store LangGraph node memory.
        
        Args:
            node_id: Node ID
            content: Memory content
            namespace: Optional namespace
            metadata: Optional metadata
            
        Returns:
            Storage result
        """
        payload = {'node_id': node_id, 'content': content}
        if namespace: payload['namespace'] = namespace
        if metadata: payload['metadata'] = metadata
        return self._r('POST', '/lgm/store', payload)
    
    def lgm_retrieve(self, node_id: str, query: str, k: int = 8,
                     namespace: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieve LangGraph node memories.
        
        Args:
            node_id: Node ID
            query: Query string
            k: Number of results
            namespace: Optional namespace
            
        Returns:
            Retrieved memories
        """
        payload = {'node_id': node_id, 'query': query, 'k': k}
        if namespace: payload['namespace'] = namespace
        return self._r('POST', '/lgm/retrieve', payload)
    
    def lgm_get_context(self, node_id: str, namespace: Optional[str] = None) -> Dict[str, Any]:
        """
        Get LangGraph node context.
        
        Args:
            node_id: Node ID
            namespace: Optional namespace
            
        Returns:
            Node context
        """
        payload = {'node_id': node_id}
        if namespace: payload['namespace'] = namespace
        return self._r('POST', '/lgm/context', payload)
    
    def lgm_create_reflection(self, node_id: str, content: str,
                              namespace: Optional[str] = None) -> Dict[str, Any]:
        """
        Create LangGraph reflection.
        
        Args:
            node_id: Node ID
            content: Reflection content
            namespace: Optional namespace
            
        Returns:
            Reflection result
        """
        payload = {'node_id': node_id, 'content': content}
        if namespace: payload['namespace'] = namespace
        return self._r('POST', '/lgm/reflection', payload)
    
    def lgm_get_config(self) -> Dict[str, Any]:
        """
        Get LangGraph memory configuration.
        
        Returns:
            Configuration dict
        """
        return self._r('GET', '/lgm/config')


# Brain sector constants for convenience
SECTORS = {
    'EPISODIC': 'episodic',      # Event memories
    'SEMANTIC': 'semantic',      # Facts & preferences  
    'PROCEDURAL': 'procedural',  # Habits, triggers
    'EMOTIONAL': 'emotional',    # Sentiment states
    'REFLECTIVE': 'reflective'   # Meta memory & logs
}