# OpenMemory Python SDK Migration Guide

## Upgrading to v0.4.0 with Agent Support

This guide helps you migrate from the basic OpenMemory Python SDK to the new version with agent registration and namespace management.

## What's New in v0.4.0

### 🤖 Agent Registration
- Automatic agent registration and API key management
- Secure agent authentication
- Agent lifecycle management

### 🌐 Namespace Management  
- Private agent namespaces
- Shared collaboration spaces
- Multi-agent memory isolation

### 🔑 Enhanced Security
- Per-agent API keys
- Permission-based access control
- Namespace-level security

## Migration Options

### Option 1: Keep Using Basic Client (No Changes Required)

Your existing code continues to work unchanged:

```python
from openmemory import OpenMemory

# Your existing code works exactly the same
om = OpenMemory(
    base_url="http://localhost:8080",
    api_key="your_api_key_here"
)

# All existing methods still work
result = om.add("User prefers dark mode", tags=["preferences"])
memories = om.query("preferences", k=5)
```

### Option 2: Upgrade to Agent-Based Architecture (Recommended)

For new features and better security:

```python
from openmemory import OpenMemoryAgent

# Replace your basic client with an agent
agent = OpenMemoryAgent(
    agent_id="my-app-agent",
    namespace="my-app-workspace",
    description="My application's AI agent",
    # Automatically registers and gets API key
)

# Use new methods with enhanced features
result = agent.store_memory(
    content="User prefers dark mode",
    sector="semantic",
    salience=0.8,
    metadata={"category": "preferences"}
)

memories = agent.query_memory(
    query="preferences",
    k=5,
    min_salience=0.5
)
```

## Migration Examples

### Basic Memory Operations

**Before (v0.3.x):**
```python
from openmemory import OpenMemory

om = OpenMemory("http://localhost:8080", "api_key_123")

# Add memory
result = om.add(
    content="User likes coffee",
    metadata={"category": "preferences"},
    user_id="user123"
)

# Query memory
memories = om.query(
    query="coffee preferences",
    filters={"user_id": "user123"}
)
```

**After (v0.4.0 - Agent approach):**
```python
from openmemory import OpenMemoryAgent

# Create agent (auto-registers)
agent = OpenMemoryAgent(
    agent_id="coffee-preference-agent",
    namespace="user-preferences",
    description="Manages user preferences and recommendations"
)

# Store memory (automatically namespaced)
result = agent.store_memory(
    content="User likes coffee",
    sector="semantic",
    metadata={"category": "preferences", "user": "user123"}
)

# Query memory (automatically scoped to agent)
memories = agent.query_memory(
    query="coffee preferences",
    k=5
)
```

### Multi-User Applications

**Before (v0.3.x):**
```python
# Manual user_id management
def add_user_memory(user_id, content):
    return om.add(content=content, user_id=user_id)

def get_user_memories(user_id, query):
    return om.query(query=query, filters={"user_id": user_id})
```

**After (v0.4.0):**
```python
# Create per-user agents or use shared agent with metadata
class UserMemoryManager:
    def __init__(self, user_id):
        self.agent = OpenMemoryAgent(
            agent_id=f"user-agent-{user_id}",
            namespace=f"user-{user_id}-memories",
            description=f"Memory agent for user {user_id}"
        )
    
    def add_memory(self, content):
        return self.agent.store_memory(content=content)
    
    def get_memories(self, query):
        return self.agent.query_memory(query=query)
```

### Team Collaboration

**Before (v0.3.x):**
```python
# Manual namespace simulation with metadata
def add_team_memory(content, team_id):
    return om.add(content=content, metadata={"team": team_id})

def get_team_memories(query, team_id):
    return om.query(query=query, filters={"team": team_id})
```

**After (v0.4.0):**
```python
# Real namespace-based collaboration
def create_team_agents(team_members):
    shared_namespace = f"team-{team_id}-workspace"
    
    agents = {}
    for member in team_members:
        agents[member] = OpenMemoryAgent(
            agent_id=f"{member}-agent",
            namespace=f"{member}-private",
            shared_namespaces=[shared_namespace],
            description=f"Agent for team member {member}"
        )
    
    return agents

# Team members can share knowledge
leader_agent.store_memory(
    content="Project deadline moved to next Friday",
    namespace="team-alpha-workspace",  # Shared space
    sector="episodic"
)

# Other team members can access it
updates = member_agent.query_memory(
    query="project deadline",
    namespace="team-alpha-workspace"
)
```

## API Mapping

| Old Method (v0.3.x) | New Method (v0.4.0) | Notes |
|---------------------|---------------------|-------|
| `om.add()` | `agent.store_memory()` | Enhanced with sectors and salience |
| `om.query()` | `agent.query_memory()` | Enhanced with namespace filtering |
| `om.reinforce()` | `agent.reinforce_memory()` | Same functionality, agent-scoped |
| `om.update()` | (Use existing client) | Available in base `OpenMemory` class |
| `om.delete()` | (Use existing client) | Available in base `OpenMemory` class |
| `om.health()` | `agent.health_check()` | Enhanced with agent status |

## Breaking Changes

### None for Existing Code
- All existing `OpenMemory` class methods remain unchanged
- Existing applications continue to work without modification
- No changes to API endpoints or data formats

### New Features Require Migration
- Agent registration requires the new `OpenMemoryAgent` class
- Namespace management requires the new API structure
- Shared collaboration requires agent-based architecture

## Step-by-Step Migration

### 1. Install Updated SDK
```bash
pip install --upgrade openmemory-py
```

### 2. Choose Migration Strategy

**Conservative (No Code Changes):**
Keep using `OpenMemory` class for existing functionality.

**Progressive (Gradual Migration):**
Introduce `OpenMemoryAgent` for new features while keeping existing code.

**Complete (Full Migration):**
Replace all memory operations with agent-based architecture.

### 3. Test Migration

Use the provided test script to verify functionality:

```bash
python test_agent_sdk.py
```

### 4. Update Configuration

**Before:**
```python
om = OpenMemory(
    base_url=os.getenv("OPENMEMORY_URL", "http://localhost:8080"),
    api_key=os.getenv("OPENMEMORY_API_KEY")
)
```

**After:**
```python
agent = OpenMemoryAgent(
    agent_id=os.getenv("AGENT_ID", "my-app-agent"),
    base_url=os.getenv("OPENMEMORY_URL", "http://localhost:8080"),
    api_key=os.getenv("OPENMEMORY_API_KEY"),  # Optional, will auto-register
    namespace=os.getenv("AGENT_NAMESPACE", "my-app-workspace"),
    description=os.getenv("AGENT_DESCRIPTION", "My application agent")
)
```

## Benefits of Migration

### Enhanced Security
- Per-agent API keys instead of shared keys
- Namespace isolation prevents data leakage
- Permission-based access control

### Better Organization
- Logical separation of different agent memories
- Shared namespaces for team collaboration
- Clear ownership and access patterns

### Improved Scalability
- Support for multiple agents in one application
- Namespace-based memory organization
- Better conflict resolution

### Future-Proofing
- Built for multi-agent architectures
- Supports advanced collaboration patterns
- Compatible with MCP (Model Context Protocol)

## Troubleshooting

### Common Issues

**"Agent registration failed"**
- Ensure OpenMemory server is running
- Check server URL and connectivity
- Verify agent_id format (alphanumeric, hyphens, underscores only)

**"Namespace access denied"**
- Check agent permissions
- Verify shared namespace configuration
- Ensure agent is registered properly

**"Memory not found"**
- Verify you're searching in the correct namespace
- Check if memory was stored in agent's private or shared space
- Use `agent.list_agents()` to debug namespace access

### Getting Help

- Check the [examples directory](examples/) for usage patterns
- Review the [test script](test_agent_sdk.py) for working code
- Open issues on GitHub for bugs or feature requests

## Conclusion

The new agent-based architecture provides powerful features for multi-agent collaboration while maintaining full backward compatibility. Choose the migration strategy that best fits your application's needs and timeline.

For most applications, we recommend a progressive migration approach:
1. Keep existing code unchanged
2. Use agents for new features
3. Gradually migrate critical components
4. Complete migration when ready

This approach minimizes risk while enabling access to new capabilities.