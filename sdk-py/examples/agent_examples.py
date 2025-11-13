#!/usr/bin/env python3
"""
🤖 OpenMemory Python SDK - Agent Registration and Namespacing Examples

Demonstrates:
- Agent registration and authentication
- Namespace isolation and shared access
- Memory operations with agent context
- Multi-agent collaboration
- Namespace management utilities
"""

import sys
import json
from openmemory import OpenMemoryAgent, NamespaceManager, register_agent, create_agent_client


def example_basic_agent_registration():
    """Basic agent registration example."""
    print("🤖 Basic Agent Registration Example")
    print("=" * 50)
    
    try:
        # Create and register a new agent
        agent = OpenMemoryAgent(
            agent_id="research-assistant-py",
            namespace="research-data",
            description="Python research assistant for data analysis",
            permissions=["read", "write"],
            shared_namespaces=["public-papers", "team-knowledge"]
        )
        
        print(f"✅ Agent registered successfully!")
        print(f"   Agent ID: {agent.agent_id}")
        print(f"   Namespace: {agent.namespace}")
        print(f"   API Key: {agent.api_key[:10]}...")
        print(f"   Permissions: {agent.permissions}")
        print(f"   Shared Namespaces: {agent.shared_namespaces}")
        
        return agent
        
    except Exception as e:
        print(f"❌ Registration failed: {e}")
        return None


def example_manual_registration():
    """Manual agent registration without auto-register."""
    print("\n🔧 Manual Agent Registration Example")
    print("=" * 50)
    
    try:
        # Register agent manually using helper function
        registration = register_agent(
            agent_id="data-analyst-py",
            namespace="analytics-workspace",
            description="Data analysis and visualization agent",
            permissions=["read", "write", "admin"],
            shared_namespaces=["company-metrics", "public-datasets"]
        )
        
        print(f"✅ Manual registration successful!")
        print(f"   Agent ID: {registration.agent_id}")
        print(f"   Namespace: {registration.namespace}")
        print(f"   API Key: {registration.api_key}")
        print(f"   Description: {registration.description}")
        
        # Create client with the API key
        agent = create_agent_client(
            agent_id=registration.agent_id,
            api_key=registration.api_key
        )
        
        print(f"✅ Client created with existing API key")
        return agent
        
    except Exception as e:
        print(f"❌ Manual registration failed: {e}")
        return None


def example_memory_operations(agent: OpenMemoryAgent):
    """Demonstrate memory operations with agent context."""
    print(f"\n💾 Memory Operations for Agent: {agent.agent_id}")
    print("=" * 50)
    
    try:
        # Store memories in agent's namespace
        result1 = agent.store_memory(
            content="User prefers dark mode interface for better visibility",
            sector="semantic",
            salience=0.8,
            metadata={"category": "ui_preference", "user": "alice"}
        )
        print(f"✅ Stored memory 1: {result1.get('memory_id')}")
        
        result2 = agent.store_memory(
            content="Last project meeting discussed new ML model architecture",
            sector="episodic",
            salience=0.9,
            metadata={"category": "meeting", "date": "2024-01-15"}
        )
        print(f"✅ Stored memory 2: {result2.get('memory_id')}")
        
        # Query memories
        query_result = agent.query_memory(
            query="user preferences interface",
            k=5,
            min_salience=0.5
        )
        
        print(f"✅ Query found {query_result.get('total_results', 0)} memories:")
        for memory in query_result.get('results', []):
            print(f"   - {memory.get('content', '')[:60]}...")
            print(f"     Sector: {memory.get('sector')}, Score: {memory.get('score', 0):.3f}")
        
        # Reinforce important memory
        if query_result.get('results'):
            memory_id = query_result['results'][0].get('memory_id')
            if memory_id:
                reinforce_result = agent.reinforce_memory(memory_id)
                print(f"✅ Reinforced memory: {reinforce_result.get('message')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Memory operations failed: {e}")
        return False


def example_namespace_operations(agent: OpenMemoryAgent):
    """Demonstrate namespace-specific operations."""
    print(f"\n🌐 Namespace Operations")
    print("=" * 50)
    
    try:
        # Store memory in different namespace (if accessible)
        if agent.shared_namespaces:
            shared_ns = agent.shared_namespaces[0]
            result = agent.store_memory(
                content="Shared knowledge: Best practices for Python development",
                namespace=shared_ns,
                sector="semantic",
                salience=0.7,
                metadata={"category": "best_practices", "language": "python"}
            )
            print(f"✅ Stored in shared namespace '{shared_ns}': {result.get('memory_id')}")
            
            # Query from shared namespace
            query_result = agent.query_memory(
                query="python development practices",
                namespace=shared_ns,
                k=3
            )
            print(f"✅ Found {query_result.get('total_results', 0)} memories in shared namespace")
        else:
            print("ℹ️  No shared namespaces available for this agent")
        
        # Query from agent's primary namespace
        query_result = agent.query_memory(
            query="meeting discussion",
            k=5
        )
        print(f"✅ Found {query_result.get('total_results', 0)} memories in primary namespace")
        
        return True
        
    except Exception as e:
        print(f"❌ Namespace operations failed: {e}")
        return False


def example_namespace_management():
    """Demonstrate namespace management utilities."""
    print(f"\n🔧 Namespace Management")
    print("=" * 50)
    
    try:
        # Create namespace manager
        ns_manager = NamespaceManager()
        
        # List all namespaces
        namespaces = ns_manager.list_namespaces()
        print(f"✅ Found {len(namespaces)} namespaces:")
        for ns in namespaces:
            print(f"   - {ns.get('namespace')} ({ns.get('group_type')})")
            print(f"     Description: {ns.get('description', 'No description')}")
        
        # Suggest namespace names
        suggestions = [
            ns_manager.suggest_namespace_name("ml-researcher", "machine learning experiments"),
            ns_manager.suggest_namespace_name("customer-bot", "customer service interactions"),
            ns_manager.suggest_namespace_name("data_validator", None)
        ]
        
        print(f"✅ Namespace name suggestions:")
        for suggestion in suggestions:
            print(f"   - {suggestion}")
        
        # Find agents for specific namespace
        if namespaces:
            example_ns = namespaces[0]['namespace']
            agents = ns_manager.get_namespace_agents(example_ns)
            print(f"✅ Agents with access to '{example_ns}': {agents}")
        
        return True
        
    except Exception as e:
        print(f"❌ Namespace management failed: {e}")
        return False


def example_agent_management():
    """Demonstrate agent management operations."""
    print(f"\n👥 Agent Management")
    print("=" * 50)
    
    try:
        # Create a manager agent to list others
        manager = OpenMemoryAgent(
            agent_id="system-manager-py",
            namespace="system-admin",
            description="System management agent",
            auto_register=True
        )
        
        # List all registered agents
        agents = manager.list_agents(show_api_keys=False)
        print(f"✅ Found {len(agents)} registered agents:")
        for agent in agents:
            print(f"   - {agent.agent_id} (namespace: {agent.namespace})")
            print(f"     Permissions: {agent.permissions}")
            print(f"     Description: {agent.description or 'No description'}")
            if agent.last_access:
                print(f"     Last Access: {agent.last_access}")
        
        # Get registration template
        template = manager.get_registration_template('json')
        print(f"✅ Registration template available ({len(template)} chars)")
        
        # Get proxy info
        proxy_info = manager.get_proxy_info()
        print(f"✅ Proxy service: {proxy_info.get('service')}")
        print(f"   Version: {proxy_info.get('version')}")
        print(f"   Capabilities: {', '.join(proxy_info.get('capabilities', []))}")
        
        return True
        
    except Exception as e:
        print(f"❌ Agent management failed: {e}")
        return False


def example_health_monitoring():
    """Demonstrate health monitoring capabilities."""
    print(f"\n🔍 Health Monitoring")
    print("=" * 50)
    
    try:
        # Check agent health
        test_agent = OpenMemoryAgent(
            agent_id="health-checker-py",
            namespace="monitoring",
            description="Health monitoring agent",
            auto_register=True
        )
        
        health = test_agent.health_check()
        print(f"✅ Health Check Results:")
        print(f"   Proxy Healthy: {health.get('proxy_healthy')}")
        print(f"   Agent Registered: {health.get('agent_registered')}")
        print(f"   Agent ID: {health.get('agent_id')}")
        print(f"   Namespace: {health.get('namespace')}")
        print(f"   Has API Key: {health.get('has_api_key')}")
        
        if health.get('error'):
            print(f"   Error: {health.get('error')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Health monitoring failed: {e}")
        return False


def example_collaboration_scenario():
    """Demonstrate multi-agent collaboration."""
    print(f"\n🤝 Multi-Agent Collaboration Scenario")
    print("=" * 50)
    
    try:
        # Create multiple agents with shared namespace access
        researcher = OpenMemoryAgent(
            agent_id="researcher-alpha",
            namespace="research-alpha",
            shared_namespaces=["team-knowledge", "public-papers"],
            description="Research agent for data collection",
            auto_register=True
        )
        
        analyst = OpenMemoryAgent(
            agent_id="analyst-beta",
            namespace="analysis-beta", 
            shared_namespaces=["team-knowledge", "research-reports"],
            description="Analysis agent for data processing",
            auto_register=True
        )
        
        # Researcher stores findings in shared space
        researcher.store_memory(
            content="New research paper on attention mechanisms shows 15% improvement",
            namespace="team-knowledge",
            sector="semantic",
            salience=0.9,
            metadata={"source": "arxiv", "topic": "attention", "improvement": 0.15}
        )
        print("✅ Researcher stored findings in shared namespace")
        
        # Analyst queries shared knowledge
        results = analyst.query_memory(
            query="attention mechanisms improvement",
            namespace="team-knowledge",
            k=3
        )
        print(f"✅ Analyst found {results.get('total_results', 0)} relevant findings")
        
        # Analyst stores analysis in their own namespace
        analyst.store_memory(
            content="Analysis shows attention mechanism improvements correlate with dataset size",
            sector="reflective",
            salience=0.8,
            metadata={"analysis_type": "correlation", "based_on": "team_research"}
        )
        print("✅ Analyst stored analysis in private namespace")
        
        # Both agents can access their respective memories plus shared knowledge
        researcher_memories = researcher.query_memory("research paper attention", k=5)
        analyst_memories = analyst.query_memory("analysis correlation", k=5)
        
        print(f"✅ Researcher can access {researcher_memories.get('total_results', 0)} memories")
        print(f"✅ Analyst can access {analyst_memories.get('total_results', 0)} memories")
        
        return True
        
    except Exception as e:
        print(f"❌ Collaboration scenario failed: {e}")
        return False


def main():
    """Run all examples."""
    print("🧠 OpenMemory Python SDK - Agent & Namespace Examples")
    print("=" * 60)
    
    print("\nThis demo showcases the new agent registration and namespacing features.")
    print("Make sure OpenMemory server is running on http://localhost:8080")
    
    # Run examples
    agent1 = example_basic_agent_registration()
    agent2 = example_manual_registration()
    
    if agent1:
        example_memory_operations(agent1)
        example_namespace_operations(agent1)
    
    example_namespace_management()
    example_agent_management()
    example_health_monitoring()
    example_collaboration_scenario()
    
    print(f"\n🎉 All examples completed!")
    print("=" * 60)


if __name__ == "__main__":
    main()