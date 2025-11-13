#!/usr/bin/env python3
"""
🤖 OpenMemory Agent Registration Examples

Demonstrates agent registration patterns and best practices
for different use cases in the OpenMemory ecosystem.
"""

import time
from openmemory import OpenMemoryAgent, register_agent, create_agent_client


def example_research_assistant():
    """Create a research assistant agent."""
    print("🔬 Research Assistant Agent")
    print("-" * 30)
    
    agent = OpenMemoryAgent(
        agent_id="research-assistant-v1",
        namespace="research-workspace",
        description="AI research assistant for academic paper analysis",
        permissions=["read", "write"],
        shared_namespaces=["public-papers", "team-research", "arxiv-cache"],
        auto_register=True
    )
    
    print(f"✅ Registered research assistant")
    print(f"   Namespace: {agent.namespace}")
    print(f"   Shared access: {', '.join(agent.shared_namespaces)}")
    print(f"   API Key: {agent.api_key[:15]}...")
    
    # Store some research-related memories
    memories = [
        {
            "content": "New transformer architecture called 'AttentionPlus' shows 15% improvement on GLUE benchmark",
            "metadata": {"paper": "arxiv:2024.001", "benchmark": "GLUE", "improvement": 0.15}
        },
        {
            "content": "Research meeting discussed potential collaboration with Stanford on multimodal learning",
            "metadata": {"meeting": "research-sync", "date": "2024-01-15", "topic": "multimodal"}
        },
        {
            "content": "User prefers detailed analysis with statistical significance tests",
            "metadata": {"preference": "analysis_style", "detail_level": "high"}
        }
    ]
    
    for i, memory in enumerate(memories):
        result = agent.store_memory(
            content=memory["content"],
            sector="semantic" if "paper" in memory["metadata"] else "episodic",
            salience=0.8,
            metadata=memory["metadata"]
        )
        print(f"   📝 Stored memory {i+1}: {result.get('memory_id', 'N/A')}")
    
    return agent


def example_customer_support_bot():
    """Create a customer support bot agent."""
    print("\n🛠 Customer Support Bot")
    print("-" * 30)
    
    agent = OpenMemoryAgent(
        agent_id="support-bot-prod",
        namespace="customer-support",
        description="Customer support chatbot with knowledge base access",
        permissions=["read", "write"],
        shared_namespaces=["kb-articles", "faq-database", "product-docs"],
        auto_register=True
    )
    
    print(f"✅ Registered support bot")
    print(f"   Namespace: {agent.namespace}")
    print(f"   KB Access: {', '.join(agent.shared_namespaces)}")
    
    # Store customer interaction patterns
    support_memories = [
        {
            "content": "Customer frequently asks about password reset procedure",
            "metadata": {"topic": "password", "frequency": "high", "category": "account"}
        },
        {
            "content": "Premium users prefer phone support over chat for billing issues",
            "metadata": {"user_type": "premium", "issue": "billing", "preference": "phone"}
        }
    ]
    
    for memory in support_memories:
        result = agent.store_memory(
            content=memory["content"],
            sector="procedural",
            salience=0.9,
            metadata=memory["metadata"]
        )
        print(f"   💬 Stored pattern: {result.get('memory_id', 'N/A')}")
    
    return agent


def example_data_analyst():
    """Create a data analyst agent with admin permissions."""
    print("\n📊 Data Analyst Agent") 
    print("-" * 30)
    
    # Use manual registration for this example
    registration = register_agent(
        agent_id="data-analyst-senior",
        namespace="analytics-workspace",
        description="Senior data analyst with full analytics access",
        permissions=["read", "write", "admin"],  # Admin permissions
        shared_namespaces=["company-metrics", "ml-models", "reporting-data"]
    )
    
    print(f"✅ Manually registered data analyst")
    print(f"   Agent ID: {registration.agent_id}")
    print(f"   Permissions: {registration.permissions}")
    print(f"   API Key: {registration.api_key}")
    
    # Create client with the API key
    agent = create_agent_client(
        agent_id=registration.agent_id,
        api_key=registration.api_key
    )
    
    # Store analytical insights
    insights = [
        {
            "content": "Q4 revenue shows 23% increase, primarily driven by enterprise accounts",
            "metadata": {"quarter": "Q4", "metric": "revenue", "growth": 0.23, "driver": "enterprise"}
        },
        {
            "content": "ML model accuracy improved to 94.2% after hyperparameter tuning",
            "metadata": {"model": "classification", "accuracy": 0.942, "method": "hyperparameter_tuning"}
        }
    ]
    
    for insight in insights:
        result = agent.store_memory(
            content=insight["content"],
            sector="reflective",  # Analytical insights
            salience=0.95,
            metadata=insight["metadata"]
        )
        print(f"   📈 Stored insight: {result.get('memory_id', 'N/A')}")
    
    return agent


def example_collaborative_scenario(research_agent, support_agent):
    """Demonstrate multi-agent collaboration."""
    print("\n🤝 Multi-Agent Collaboration")
    print("-" * 30)
    
    # Research agent stores findings in shared space
    shared_finding = research_agent.store_memory(
        content="New NLP technique reduces customer query processing time by 40%",
        namespace="team-research",  # Shared namespace
        sector="semantic",
        salience=0.9,
        metadata={
            "technique": "nlp_optimization",
            "improvement": 0.40,
            "application": "customer_support"
        }
    )
    print(f"🔬 Research agent shared finding: {shared_finding.get('memory_id', 'N/A')}")
    
    # Support bot accesses the shared research
    relevant_research = support_agent.query_memory(
        query="NLP technique customer query processing",
        namespace="team-research",
        k=3
    )
    
    print(f"🛠 Support bot found {relevant_research.get('total_results', 0)} relevant research items")
    
    if relevant_research.get('results'):
        # Support bot applies the research
        application_memory = support_agent.store_memory(
            content="Implemented new NLP optimization from research team, reducing response time significantly",
            sector="procedural",
            salience=0.85,
            metadata={
                "implementation": "nlp_optimization",
                "source": "research_team",
                "result": "improved_response_time"
            }
        )
        print(f"🛠 Support bot implemented research: {application_memory.get('memory_id', 'N/A')}")


def example_agent_lifecycle_management():
    """Demonstrate agent lifecycle and management operations."""
    print("\n🔄 Agent Lifecycle Management")
    print("-" * 30)
    
    # Create a temporary agent for demonstration
    temp_agent = OpenMemoryAgent(
        agent_id="temp-demo-agent",
        namespace="demo-workspace",
        description="Temporary agent for lifecycle demo",
        auto_register=True
    )
    
    print(f"✅ Created temporary agent: {temp_agent.agent_id}")
    
    # Check agent status
    health = temp_agent.health_check()
    print(f"🔍 Agent health check:")
    print(f"   Registered: {health.get('agent_registered')}")
    print(f"   Has API Key: {health.get('has_api_key')}")
    print(f"   Proxy Healthy: {health.get('proxy_healthy')}")
    
    # List all agents
    all_agents = temp_agent.list_agents(show_api_keys=False)
    print(f"\n👥 Found {len(all_agents)} total agents:")
    for agent_info in all_agents[:3]:  # Show first 3
        print(f"   - {agent_info.agent_id} (namespace: {agent_info.namespace})")
        print(f"     Permissions: {agent_info.permissions}")
        if agent_info.last_access:
            print(f"     Last access: {agent_info.last_access}")
    
    if len(all_agents) > 3:
        print(f"   ... and {len(all_agents) - 3} more")
    
    # Get proxy information
    proxy_info = temp_agent.get_proxy_info()
    print(f"\n🔧 Proxy Service: {proxy_info.get('service', 'Unknown')}")
    print(f"   Version: {proxy_info.get('version', 'Unknown')}")
    print(f"   Registered Agents: {proxy_info.get('agents', 0)}")
    print(f"   Available Namespaces: {proxy_info.get('namespaces', 0)}")
    
    return temp_agent


def demonstrate_error_handling():
    """Demonstrate proper error handling."""
    print("\n⚠️ Error Handling Examples")
    print("-" * 30)
    
    try:
        # Attempt to create agent with invalid ID
        invalid_agent = OpenMemoryAgent(
            agent_id="invalid@agent#id",  # Invalid characters
            namespace="test",
            auto_register=False  # Don't auto-register for this test
        )
        invalid_agent.register()
    except Exception as e:
        print(f"❌ Expected error for invalid agent ID: {str(e)[:60]}...")
    
    try:
        # Attempt operation without API key
        no_key_agent = OpenMemoryAgent(
            agent_id="no-key-agent",
            namespace="test",
            auto_register=False  # No registration
        )
        no_key_agent.store_memory("This should fail", sector="semantic")
    except Exception as e:
        print(f"❌ Expected error for missing API key: {str(e)[:60]}...")
    
    print("✅ Error handling working correctly")


def main():
    """Run all agent registration examples."""
    print("🤖 OpenMemory Agent Registration Examples")
    print("=" * 50)
    print("Demonstrates various agent registration patterns and use cases\n")
    
    # Create different types of agents
    research_agent = example_research_assistant()
    support_agent = example_customer_support_bot()
    data_agent = example_data_analyst()
    
    # Demonstrate collaboration
    if research_agent and support_agent:
        example_collaborative_scenario(research_agent, support_agent)
    
    # Show lifecycle management
    temp_agent = example_agent_lifecycle_management()
    
    # Demonstrate error handling
    demonstrate_error_handling()
    
    print("\n🎉 All agent examples completed successfully!")
    print("=" * 50)


if __name__ == "__main__":
    main()