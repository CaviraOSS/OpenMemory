"""
🤖 OpenMemory Agent Registration and Namespace Management

Agent-aware client for OpenMemory with built-in registration, namespace
isolation, and multi-agent collaboration capabilities.
"""

import json
import urllib.request
from typing import Dict, List, Optional, Union, Any
from dataclasses import dataclass
from datetime import datetime


@dataclass
class AgentRegistration:
    """Agent registration details."""
    agent_id: str
    namespace: str
    permissions: List[str]
    shared_namespaces: List[str]
    api_key: str
    description: Optional[str] = None
    registration_date: Optional[datetime] = None
    last_access: Optional[datetime] = None


class OpenMemoryAgent:
    """
    Agent-aware OpenMemory client with namespace isolation and collaboration.
    
    Provides automatic agent registration, namespace management, and secure
    memory operations with API key authentication.
    """
    
    def __init__(self, 
                 agent_id: str,
                 base_url: str = 'http://localhost:8080',
                 api_key: Optional[str] = None,
                 namespace: Optional[str] = None,
                 permissions: Optional[List[str]] = None,
                 shared_namespaces: Optional[List[str]] = None,
                 description: Optional[str] = None,
                 auto_register: bool = True):
        """
        Initialize OpenMemory agent client.
        
        Args:
            agent_id: Unique identifier for this agent
            base_url: OpenMemory server URL
            api_key: Existing API key (if already registered)
            namespace: Primary namespace for agent memories
            permissions: Agent permissions ['read', 'write', 'admin']
            shared_namespaces: Additional namespaces this agent can access
            description: Human-readable description of agent purpose
            auto_register: Automatically register agent if not provided api_key
        """
        self.agent_id = agent_id
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.namespace = namespace or f"{agent_id}-workspace"
        self.permissions = permissions or ['read', 'write']
        self.shared_namespaces = shared_namespaces or []
        self.description = description
        self.registration: Optional[AgentRegistration] = None
        
        # Auto-register if no API key provided
        if auto_register and not self.api_key:
            self.register()
    
    def _request(self, method: str, path: str, body: Optional[Dict] = None) -> Dict[str, Any]:
        """Internal request method with agent authentication."""
        headers = {'content-type': 'application/json'}
        if self.api_key:
            headers['authorization'] = f'Bearer {self.api_key}'
        
        data = None
        if body is not None:
            data = json.dumps(body).encode()
        
        url = self.base_url + path
        req = urllib.request.Request(url, method=method, headers=headers, data=data)
        
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as e:
            error_body = e.read().decode() if e.fp else ""
            try:
                error_data = json.loads(error_body) if error_body else {}
                error_msg = error_data.get('message', f'HTTP {e.code}: {e.reason}')
            except json.JSONDecodeError:
                error_msg = f'HTTP {e.code}: {e.reason}'
            raise Exception(f"Request failed: {error_msg}")
    
    def register(self, 
                 namespace: Optional[str] = None,
                 permissions: Optional[List[str]] = None,
                 shared_namespaces: Optional[List[str]] = None,
                 description: Optional[str] = None) -> AgentRegistration:
        """
        Register this agent with OpenMemory proxy.
        
        Args:
            namespace: Override default namespace
            permissions: Override default permissions
            shared_namespaces: Override default shared namespaces
            description: Override default description
            
        Returns:
            AgentRegistration with API key and details
        """
        payload = {
            'agent_id': self.agent_id,
            'namespace': namespace or self.namespace,
            'permissions': permissions or self.permissions,
            'shared_namespaces': shared_namespaces or self.shared_namespaces
        }
        
        desc = description or self.description
        if desc:
            payload['description'] = desc
        
        try:
            result = self._request('POST', '/api/agents', payload)
            
            # Store registration details
            self.api_key = result['api_key']
            self.namespace = result['namespace']
            self.permissions = result['permissions']
            self.shared_namespaces = result['shared_namespaces']
            
            self.registration = AgentRegistration(
                agent_id=result['agent_id'],
                namespace=result['namespace'],
                permissions=result['permissions'],
                shared_namespaces=result['shared_namespaces'],
                api_key=result['api_key'],
                description=result.get('description')
            )
            
            return self.registration
            
        except Exception as e:
            raise Exception(f"Agent registration failed: {str(e)}")
    
    def get_registration_info(self) -> Optional[AgentRegistration]:
        """
        Get current agent registration details from server.
        
        Returns:
            AgentRegistration if agent exists, None otherwise
        """
        try:
            result = self._request('GET', f'/api/agents/{self.agent_id}')
            
            return AgentRegistration(
                agent_id=result['agent_id'],
                namespace=result['namespace'],
                permissions=result['permissions'],
                shared_namespaces=result['shared_namespaces'],
                api_key=result.get('api_key', '***hidden***'),
                description=result.get('description'),
                registration_date=datetime.fromisoformat(result['registration_date'].replace('Z', '+00:00')) if result.get('registration_date') else None,
                last_access=datetime.fromisoformat(result['last_access'].replace('Z', '+00:00')) if result.get('last_access') else None
            )
            
        except Exception:
            return None
    
    def list_agents(self, show_api_keys: bool = False) -> List[AgentRegistration]:
        """
        List all registered agents.
        
        Args:
            show_api_keys: Whether to include API keys in response
            
        Returns:
            List of AgentRegistration objects
        """
        try:
            url = '/api/agents'
            if show_api_keys:
                url += '?show_api_keys=true'
                
            result = self._request('GET', url)
            
            agents = []
            for agent_data in result.get('agents', []):
                agents.append(AgentRegistration(
                    agent_id=agent_data['agent_id'],
                    namespace=agent_data['namespace'],
                    permissions=agent_data['permissions'],
                    shared_namespaces=agent_data['shared_namespaces'],
                    api_key=agent_data.get('api_key', '***hidden***'),
                    description=agent_data.get('description'),
                    registration_date=datetime.fromisoformat(agent_data['registration_date'].replace('Z', '+00:00')) if agent_data.get('registration_date') else None,
                    last_access=datetime.fromisoformat(agent_data['last_access'].replace('Z', '+00:00')) if agent_data.get('last_access') else None
                ))
            
            return agents
            
        except Exception as e:
            raise Exception(f"Failed to list agents: {str(e)}")
    
    def list_namespaces(self) -> List[Dict[str, Any]]:
        """
        List all available namespaces.
        
        Returns:
            List of namespace information dictionaries
        """
        try:
            result = self._request('GET', '/api/namespaces')
            return result.get('namespaces', [])
        except Exception as e:
            raise Exception(f"Failed to list namespaces: {str(e)}")
    
    def store_memory(self, 
                     content: str,
                     namespace: Optional[str] = None,
                     sector: Optional[str] = None,
                     salience: Optional[float] = None,
                     metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Store a memory in agent's namespace.
        
        Args:
            content: Memory content to store
            namespace: Target namespace (defaults to agent's primary)
            sector: Memory sector classification
            salience: Memory importance (0-1)
            metadata: Additional metadata
            
        Returns:
            Storage result with memory_id and namespace
        """
        if not self.api_key:
            raise Exception("Agent must be registered before storing memories")
        
        # Use MCP proxy endpoint for namespaced operations
        payload = {
            'method': 'tools/call',
            'params': {
                'name': 'store_memory',
                'arguments': {
                    'agent_id': self.agent_id,
                    'content': content,
                    'api_key': self.api_key
                }
            }
        }
        
        # Add optional parameters
        args = payload['params']['arguments']
        if namespace:
            args['namespace'] = namespace
        if sector:
            args['sector'] = sector
        if salience is not None:
            args['salience'] = salience
        if metadata:
            args['metadata'] = metadata
        
        try:
            result = self._request('POST', '/mcp-proxy', payload)
            
            # Extract result from MCP response
            if 'result' in result and 'content' in result['result']:
                content_item = result['result']['content'][0]
                memory_id = result['result'].get('meta', {}).get('memory_id')
                used_namespace = result['result'].get('meta', {}).get('namespace')
                
                return {
                    'success': True,
                    'memory_id': memory_id,
                    'namespace': used_namespace,
                    'message': content_item.get('text', 'Memory stored successfully')
                }
            else:
                return result
                
        except Exception as e:
            raise Exception(f"Failed to store memory: {str(e)}")
    
    def query_memory(self, 
                     query: str,
                     namespace: Optional[str] = None,
                     k: int = 8,
                     sector: Optional[str] = None,
                     min_salience: Optional[float] = None) -> Dict[str, Any]:
        """
        Query memories from agent's authorized namespaces.
        
        Args:
            query: Search query text
            namespace: Target namespace (defaults to agent's primary)
            k: Number of results to return
            sector: Restrict search to specific sector
            min_salience: Minimum salience threshold
            
        Returns:
            Query results with memories and metadata
        """
        if not self.api_key:
            raise Exception("Agent must be registered before querying memories")
        
        # Use MCP proxy endpoint for namespaced operations
        payload = {
            'method': 'tools/call',
            'params': {
                'name': 'query_memory',
                'arguments': {
                    'agent_id': self.agent_id,
                    'query': query,
                    'k': k,
                    'api_key': self.api_key
                }
            }
        }
        
        # Add optional parameters
        args = payload['params']['arguments']
        if namespace:
            args['namespace'] = namespace
        if sector:
            args['sector'] = sector
        if min_salience is not None:
            args['min_salience'] = min_salience
        
        try:
            result = self._request('POST', '/mcp-proxy', payload)
            
            # Extract result from MCP response
            if 'result' in result and 'meta' in result['result']:
                meta = result['result']['meta']
                return {
                    'success': True,
                    'query': query,
                    'namespace': meta.get('namespace'),
                    'total_results': meta.get('total_results', 0),
                    'results': meta.get('results', [])
                }
            else:
                return result
                
        except Exception as e:
            raise Exception(f"Failed to query memories: {str(e)}")
    
    def reinforce_memory(self, memory_id: str) -> Dict[str, Any]:
        """
        Reinforce the salience of a specific memory.
        
        Args:
            memory_id: ID of memory to reinforce
            
        Returns:
            Reinforcement result
        """
        if not self.api_key:
            raise Exception("Agent must be registered before reinforcing memories")
        
        # Use MCP proxy endpoint for namespaced operations
        payload = {
            'method': 'tools/call',
            'params': {
                'name': 'reinforce_memory',
                'arguments': {
                    'agent_id': self.agent_id,
                    'memory_id': memory_id,
                    'api_key': self.api_key
                }
            }
        }
        
        try:
            result = self._request('POST', '/mcp-proxy', payload)
            
            # Extract result from MCP response
            if 'result' in result and 'content' in result['result']:
                content_item = result['result']['content'][0]
                return {
                    'success': True,
                    'message': content_item.get('text', 'Memory reinforced successfully')
                }
            else:
                return result
                
        except Exception as e:
            raise Exception(f"Failed to reinforce memory: {str(e)}")
    
    def get_registration_template(self, format: str = 'json') -> str:
        """
        Get agent registration template and guidance.
        
        Args:
            format: Template format ('json', 'curl', 'prompt', 'example')
            
        Returns:
            Registration template string
        """
        try:
            result = self._request('GET', f'/api/registration-template/{format}')
            return result.get('template', '')
        except Exception as e:
            raise Exception(f"Failed to get registration template: {str(e)}")
    
    def get_proxy_info(self) -> Dict[str, Any]:
        """
        Get information about the proxy service capabilities.
        
        Returns:
            Proxy service information
        """
        try:
            return self._request('GET', '/api/proxy-info')
        except Exception as e:
            raise Exception(f"Failed to get proxy info: {str(e)}")
    
    def health_check(self) -> Dict[str, Any]:
        """
        Check agent registration and proxy health.
        
        Returns:
            Health check results
        """
        try:
            proxy_health = self._request('GET', '/api/proxy-health')
            
            # Check agent registration status
            agent_status = self.get_registration_info()
            
            return {
                'proxy_healthy': proxy_health.get('status') == 'healthy',
                'agent_registered': agent_status is not None,
                'agent_id': self.agent_id,
                'namespace': self.namespace,
                'has_api_key': bool(self.api_key),
                'proxy_info': proxy_health
            }
            
        except Exception as e:
            return {
                'proxy_healthy': False,
                'agent_registered': False,
                'error': str(e)
            }


class NamespaceManager:
    """
    Utility class for managing OpenMemory namespaces.
    """
    
    def __init__(self, base_url: str = 'http://localhost:8080', api_key: Optional[str] = None):
        """
        Initialize namespace manager.
        
        Args:
            base_url: OpenMemory server URL
            api_key: Optional API key for authentication
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
    
    def _request(self, method: str, path: str, body: Optional[Dict] = None) -> Dict[str, Any]:
        """Internal request method."""
        headers = {'content-type': 'application/json'}
        if self.api_key:
            headers['authorization'] = f'Bearer {self.api_key}'
        
        data = None
        if body is not None:
            data = json.dumps(body).encode()
        
        url = self.base_url + path
        req = urllib.request.Request(url, method=method, headers=headers, data=data)
        
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as e:
            error_body = e.read().decode() if e.fp else ""
            try:
                error_data = json.loads(error_body) if error_body else {}
                error_msg = error_data.get('message', f'HTTP {e.code}: {e.reason}')
            except json.JSONDecodeError:
                error_msg = f'HTTP {e.code}: {e.reason}'
            raise Exception(f"Request failed: {error_msg}")
    
    def list_namespaces(self) -> List[Dict[str, Any]]:
        """
        List all available namespaces.
        
        Returns:
            List of namespace information
        """
        try:
            result = self._request('GET', '/api/namespaces')
            return result.get('namespaces', [])
        except Exception as e:
            raise Exception(f"Failed to list namespaces: {str(e)}")
    
    def get_namespace_agents(self, namespace: str) -> List[str]:
        """
        Get all agents that have access to a namespace.
        
        Args:
            namespace: Namespace name
            
        Returns:
            List of agent IDs with access to the namespace
        """
        try:
            result = self._request('GET', '/api/agents')
            agents_with_access = []
            
            for agent in result.get('agents', []):
                if (agent.get('namespace') == namespace or 
                    namespace in agent.get('shared_namespaces', [])):
                    agents_with_access.append(agent['agent_id'])
            
            return agents_with_access
            
        except Exception as e:
            raise Exception(f"Failed to get namespace agents: {str(e)}")
    
    def suggest_namespace_name(self, agent_id: str, purpose: Optional[str] = None) -> str:
        """
        Suggest a namespace name based on agent ID and purpose.
        
        Args:
            agent_id: Agent identifier
            purpose: Optional purpose description
            
        Returns:
            Suggested namespace name
        """
        base_name = agent_id.replace('_', '-').lower()
        
        if purpose:
            # Extract key words from purpose and create namespace
            purpose_words = purpose.lower().replace(' ', '-')
            # Keep only alphanumeric and hyphens
            purpose_clean = ''.join(c for c in purpose_words if c.isalnum() or c == '-')
            return f"{base_name}-{purpose_clean}"
        else:
            return f"{base_name}-workspace"


# Agent registration helper functions
def register_agent(agent_id: str,
                   namespace: Optional[str] = None,
                   base_url: str = 'http://localhost:8080',
                   permissions: Optional[List[str]] = None,
                   shared_namespaces: Optional[List[str]] = None,
                   description: Optional[str] = None) -> AgentRegistration:
    """
    Quick helper to register an agent.
    
    Args:
        agent_id: Unique agent identifier
        namespace: Primary namespace (defaults to {agent_id}-workspace)
        base_url: OpenMemory server URL
        permissions: Agent permissions
        shared_namespaces: Additional accessible namespaces
        description: Agent description
        
    Returns:
        AgentRegistration with API key and details
    """
    agent = OpenMemoryAgent(
        agent_id=agent_id,
        base_url=base_url,
        namespace=namespace,
        permissions=permissions,
        shared_namespaces=shared_namespaces,
        description=description,
        auto_register=False
    )
    
    return agent.register()


def create_agent_client(agent_id: str, 
                       api_key: str,
                       base_url: str = 'http://localhost:8080') -> OpenMemoryAgent:
    """
    Create an agent client with existing API key.
    
    Args:
        agent_id: Agent identifier
        api_key: Existing API key
        base_url: OpenMemory server URL
        
    Returns:
        Configured OpenMemoryAgent client
    """
    return OpenMemoryAgent(
        agent_id=agent_id,
        base_url=base_url,
        api_key=api_key,
        auto_register=False
    )