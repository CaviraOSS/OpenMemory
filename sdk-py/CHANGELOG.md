# OpenMemory Python SDK v0.4.0 - Agent Registration & Namespacing

## 🎉 Major Update: Agent Registration and Namespace Management

This release introduces powerful agent registration and namespace management capabilities to the OpenMemory Python SDK, enabling secure multi-agent collaboration and memory isolation.

## 🚀 New Features

### 🤖 Agent Registration System
- **Automatic Registration**: Agents can self-register with the OpenMemory proxy
- **API Key Management**: Secure, auto-generated API keys for each agent
- **Agent Lifecycle**: Full agent registration, status checking, and management
- **Manual Registration**: Option for explicit registration control

### 🌐 Namespace Management
- **Private Namespaces**: Each agent gets an isolated memory space
- **Shared Namespaces**: Enable collaboration between specific agents
- **Namespace Utilities**: Tools for managing and organizing memory spaces
- **Access Control**: Permission-based access to different namespaces

### 🔒 Enhanced Security
- **Per-Agent Authentication**: Individual API keys for each agent
- **Namespace Isolation**: Memory separation prevents data leakage
- **Permission Management**: Read, write, and admin access levels
- **Secure Collaboration**: Controlled access to shared memory spaces

## 📦 New Classes and Functions

### `OpenMemoryAgent`
Main agent class with automatic registration and namespace management:

```python
agent = OpenMemoryAgent(
    agent_id="my-research-agent",
    namespace="research-workspace",
    description="AI research assistant",
    permissions=["read", "write"],
    shared_namespaces=["team-knowledge", "public-papers"]
)
```

### `NamespaceManager`
Utility class for namespace operations:

```python
ns_manager = NamespaceManager()
namespaces = ns_manager.list_namespaces()
agents = ns_manager.get_namespace_agents("team-workspace")
```

### Helper Functions
- `register_agent()` - Manual agent registration
- `create_agent_client()` - Create client with existing API key

## 🔄 Backward Compatibility

**100% backward compatible** - All existing `OpenMemory` class functionality remains unchanged:

```python
# Existing code continues to work
from openmemory import OpenMemory

om = OpenMemory("http://localhost:8080", "api_key")
result = om.add("Memory content")
memories = om.query("search term")
```

## 📈 Key Benefits

### For Single-Agent Applications
- **Enhanced Security**: Individual API keys vs shared keys
- **Better Organization**: Logical namespace separation
- **Future-Proofing**: Ready for multi-agent architectures

### For Multi-Agent Applications
- **Memory Isolation**: Prevent agent memory interference
- **Controlled Collaboration**: Share knowledge when needed
- **Team Workspaces**: Shared namespaces for team projects
- **Scalable Architecture**: Support hundreds of agents

## 🛠 Installation & Usage

### Installation
```bash
pip install --upgrade openmemory-py
```

### Quick Start - Agent Mode
```python
from openmemory import OpenMemoryAgent

# Create and auto-register agent
agent = OpenMemoryAgent(
    agent_id="my-agent",
    namespace="my-workspace",
    description="My AI agent"
)

# Store memory in agent's namespace
result = agent.store_memory(
    content="Important information",
    sector="semantic",
    salience=0.9
)

# Query agent's memories
memories = agent.query_memory("important information", k=5)
```

### Quick Start - Multi-Agent Collaboration
```python
from openmemory import OpenMemoryAgent

# Create agents with shared workspace
researcher = OpenMemoryAgent(
    agent_id="researcher",
    namespace="researcher-private",
    shared_namespaces=["team-project"]
)

analyst = OpenMemoryAgent(
    agent_id="analyst", 
    namespace="analyst-private",
    shared_namespaces=["team-project"]
)

# Share knowledge
researcher.store_memory(
    "Research findings: 95% accuracy achieved",
    namespace="team-project"
)

# Access shared knowledge
findings = analyst.query_memory(
    "research findings accuracy",
    namespace="team-project"
)
```

## 📚 Documentation & Examples

### Examples Included
- `examples/agent_examples.py` - Complete agent usage examples
- `examples/py-sdk/agent_registration.py` - Registration patterns
- `examples/py-sdk/namespace_management.py` - Namespace management
- `test_agent_sdk.py` - Test suite for validation

### Migration Guide
See `MIGRATION.md` for detailed upgrade instructions.

## 🔧 Technical Implementation

### Architecture
- **MCP Integration**: Uses Model Context Protocol for agent communication
- **REST API**: Direct integration with OpenMemory proxy endpoints
- **Zero Dependencies**: Uses only Python standard library
- **Type Safety**: Full type hints for IDE support

### Supported Operations
- ✅ Agent registration and management
- ✅ Namespace-aware memory storage
- ✅ Cross-namespace memory queries
- ✅ Memory reinforcement
- ✅ Health monitoring
- ✅ Collaboration workflows

## 🧪 Testing

Run the test suite to validate functionality:

```bash
python test_agent_sdk.py
```

Ensure OpenMemory server is running on `http://localhost:8080` with MCP proxy enabled.

## 🔮 Future Roadmap

- **Agent Templates**: Pre-configured agent types for common use cases
- **Advanced Permissions**: Fine-grained access control
- **Agent Discovery**: Automatic discovery of compatible agents
- **Workflow Integration**: Built-in support for agent workflow patterns
- **Performance Optimization**: Advanced caching and batch operations

## 📞 Support

- **Examples**: Complete working examples in `examples/` directory
- **Migration Guide**: Step-by-step upgrade instructions in `MIGRATION.md`
- **GitHub Issues**: Report bugs and request features
- **Community**: Join the OpenMemory Discord for discussions

## 📝 Version History

### v0.4.0 (Current)
- ➕ Agent registration system
- ➕ Namespace management
- ➕ Multi-agent collaboration
- ➕ Enhanced security model
- ✅ 100% backward compatibility

### v0.3.0 (Previous)
- Basic memory operations
- User isolation
- Sector-based memory
- LangGraph integration

## 🎯 Getting Started

1. **Install**: `pip install --upgrade openmemory-py`
2. **Run Examples**: `python examples/agent_examples.py`
3. **Read Migration Guide**: Review `MIGRATION.md` for upgrade paths
4. **Start Building**: Create your first agent-based memory system

Welcome to the future of AI memory management! 🧠✨