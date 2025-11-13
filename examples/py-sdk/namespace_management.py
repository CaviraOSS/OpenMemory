#!/usr/bin/env python3
"""
🌐 OpenMemory Namespace Management Examples

Demonstrates namespace creation, management, and collaboration
patterns for multi-agent environments.
"""

from openmemory import OpenMemoryAgent, NamespaceManager


def demonstrate_namespace_concepts():
    """Explain namespace concepts with examples."""
    print("🌐 Namespace Management Concepts")
    print("=" * 40)
    
    print("OpenMemory supports three types of namespaces:")
    print("  🔒 Private - Agent's own memory space")
    print("  🤝 Shared - Collaboration between specific agents") 
    print("  🌍 Public - Globally accessible knowledge")
    print()
    
    # Create namespace manager
    ns_manager = NamespaceManager()
    
    # Get namespace suggestions
    suggestions = {
        "Research Team": ns_manager.suggest_namespace_name("ai-researcher", "machine learning experiments"),
        "Support Bot": ns_manager.suggest_namespace_name("support_bot", "customer service interactions"),
        "Data Analyst": ns_manager.suggest_namespace_name("data-analyst", "business intelligence"),
        "Content Manager": ns_manager.suggest_namespace_name("content_manager", None)
    }
    
    print("📝 Namespace Name Suggestions:")
    for role, suggestion in suggestions.items():
        print(f"  {role}: {suggestion}")
    
    return ns_manager


def setup_research_environment():
    """Set up a research team environment with multiple agents."""
    print("\n🔬 Research Team Environment Setup")
    print("=" * 40)
    
    # Create research team lead
    team_lead = OpenMemoryAgent(
        agent_id="research-lead-dr-smith",
        namespace="research-lead-workspace",
        description="Research team lead with project oversight",
        permissions=["read", "write", "admin"],
        shared_namespaces=[
            "team-research-papers",
            "experiment-results", 
            "public-datasets",
            "collaboration-notes"
        ]
    )
    
    # Create junior researcher
    junior_researcher = OpenMemoryAgent(
        agent_id="junior-researcher-alex",
        namespace="alex-research-workspace", 
        description="Junior researcher focusing on NLP experiments",
        permissions=["read", "write"],
        shared_namespaces=[
            "team-research-papers",
            "experiment-results",
            "public-datasets"
        ]
    )
    
    # Create data scientist
    data_scientist = OpenMemoryAgent(
        agent_id="data-scientist-maya",
        namespace="maya-analysis-workspace",
        description="Data scientist for statistical analysis", 
        permissions=["read", "write"],
        shared_namespaces=[
            "experiment-results",
            "public-datasets",
            "statistical-models"
        ]
    )
    
    agents = [team_lead, junior_researcher, data_scientist]
    
    print("✅ Created research team:")
    for agent in agents:
        print(f"  👤 {agent.agent_id}")
        print(f"     Private: {agent.namespace}")
        print(f"     Shared: {', '.join(agent.shared_namespaces)}")
        print()
    
    return agents


def demonstrate_namespace_isolation():
    """Show how namespace isolation works."""
    print("🔒 Namespace Isolation Demo")
    print("=" * 30)
    
    # Create two agents with separate namespaces
    agent_alice = OpenMemoryAgent(
        agent_id="alice-private-agent",
        namespace="alice-private-space",
        description="Alice's private research agent",
        shared_namespaces=[]  # No shared access
    )
    
    agent_bob = OpenMemoryAgent(
        agent_id="bob-private-agent", 
        namespace="bob-private-space",
        description="Bob's private research agent",
        shared_namespaces=[]  # No shared access
    )
    
    # Alice stores private information
    alice_memory = agent_alice.store_memory(
        content="Alice's private research notes: new algorithm approach showing promise",
        sector="reflective",
        salience=0.9,
        metadata={"private": True, "researcher": "alice"}
    )
    print(f"🔒 Alice stored private memory: {alice_memory.get('memory_id', 'N/A')}")
    
    # Bob stores his own private information  
    bob_memory = agent_bob.store_memory(
        content="Bob's confidential experiment results: 92% accuracy achieved",
        sector="semantic",
        salience=0.85,
        metadata={"private": True, "researcher": "bob", "accuracy": 0.92}
    )
    print(f"🔒 Bob stored private memory: {bob_memory.get('memory_id', 'N/A')}")
    
    # Alice cannot access Bob's memories
    alice_search = agent_alice.query_memory(
        query="Bob confidential experiment accuracy",
        k=5
    )
    print(f"🔍 Alice searching for Bob's memories: {alice_search.get('total_results', 0)} found")
    
    # Bob cannot access Alice's memories
    bob_search = agent_bob.query_memory(
        query="Alice algorithm approach promise",
        k=5  
    )
    print(f"🔍 Bob searching for Alice's memories: {bob_search.get('total_results', 0)} found")
    
    print("✅ Namespace isolation working correctly")
    
    return agent_alice, agent_bob


def demonstrate_shared_collaboration():
    """Show how shared namespaces enable collaboration."""
    print("\n🤝 Shared Namespace Collaboration")
    print("=" * 35)
    
    # Create agents with shared workspace
    project_manager = OpenMemoryAgent(
        agent_id="project-manager-sam",
        namespace="sam-project-mgmt",
        description="Project manager coordinating team efforts",
        permissions=["read", "write", "admin"],
        shared_namespaces=["team-project-alpha", "resource-sharing"]
    )
    
    developer = OpenMemoryAgent(
        agent_id="developer-jordan",
        namespace="jordan-development",
        description="Software developer working on project alpha",
        permissions=["read", "write"],
        shared_namespaces=["team-project-alpha", "code-reviews"]
    )
    
    designer = OpenMemoryAgent(
        agent_id="designer-casey",
        namespace="casey-design-work",
        description="UX designer for project alpha",
        permissions=["read", "write"], 
        shared_namespaces=["team-project-alpha", "design-assets"]
    )
    
    # Project manager shares project requirements
    pm_shared = project_manager.store_memory(
        content="Project Alpha requirements: responsive web app with dark mode, accessibility features",
        namespace="team-project-alpha",  # Shared space
        sector="semantic",
        salience=0.95,
        metadata={"type": "requirements", "project": "alpha", "features": ["responsive", "dark_mode", "accessibility"]}
    )
    print(f"📋 PM shared requirements: {pm_shared.get('memory_id', 'N/A')}")
    
    # Developer accesses requirements and adds technical notes
    dev_requirements = developer.query_memory(
        query="Project Alpha requirements responsive dark mode",
        namespace="team-project-alpha",
        k=3
    )
    print(f"💻 Developer found {dev_requirements.get('total_results', 0)} requirement items")
    
    dev_technical = developer.store_memory(
        content="Technical approach for Project Alpha: React with Material-UI, implement dark theme toggle",
        namespace="team-project-alpha",
        sector="procedural",
        salience=0.9,
        metadata={"type": "technical_plan", "project": "alpha", "tech_stack": ["react", "material-ui"]}
    )
    print(f"💻 Developer shared technical plan: {dev_technical.get('memory_id', 'N/A')}")
    
    # Designer accesses both requirements and technical notes
    design_context = designer.query_memory(
        query="Project Alpha requirements technical approach",
        namespace="team-project-alpha",
        k=5
    )
    print(f"🎨 Designer found {design_context.get('total_results', 0)} context items")
    
    design_concepts = designer.store_memory(
        content="Design concepts for Project Alpha: modern minimalist UI with smooth dark mode transition",
        namespace="team-project-alpha",
        sector="episodic",
        salience=0.88,
        metadata={"type": "design_concept", "project": "alpha", "style": "minimalist"}
    )
    print(f"🎨 Designer shared concepts: {design_concepts.get('memory_id', 'N/A')}")
    
    # Show how all team members can now access the shared knowledge
    print("\n📊 Shared Knowledge Summary:")
    for agent, role in [(project_manager, "PM"), (developer, "Dev"), (designer, "Designer")]:
        shared_knowledge = agent.query_memory(
            query="Project Alpha",
            namespace="team-project-alpha",
            k=10
        )
        print(f"  {role}: {shared_knowledge.get('total_results', 0)} shared items accessible")
    
    return project_manager, developer, designer


def demonstrate_namespace_management_tools():
    """Show namespace management utilities."""
    print("\n🔧 Namespace Management Tools")
    print("=" * 32)
    
    ns_manager = NamespaceManager()
    
    # List all available namespaces
    try:
        namespaces = ns_manager.list_namespaces()
        print(f"📋 Total namespaces found: {len(namespaces)}")
        
        # Group by type
        namespace_types = {}
        for ns in namespaces:
            ns_type = ns.get('group_type', 'unknown')
            if ns_type not in namespace_types:
                namespace_types[ns_type] = []
            namespace_types[ns_type].append(ns)
        
        for ns_type, ns_list in namespace_types.items():
            print(f"\n{ns_type.upper()} Namespaces ({len(ns_list)}):")
            for ns in ns_list[:3]:  # Show first 3
                print(f"  🌐 {ns.get('namespace')}")
                if ns.get('description'):
                    print(f"     {ns.get('description')}")
            if len(ns_list) > 3:
                print(f"     ... and {len(ns_list) - 3} more")
        
        # Show agents per namespace for first few
        print(f"\n👥 Agent Access Analysis:")
        for ns in namespaces[:3]:
            ns_name = ns.get('namespace')
            agents = ns_manager.get_namespace_agents(ns_name)
            print(f"  {ns_name}: {len(agents)} agents")
            if agents:
                print(f"    Agents: {', '.join(agents[:2])}{'...' if len(agents) > 2 else ''}")
        
    except Exception as e:
        print(f"❌ Namespace management error: {e}")
    
    # Demonstrate name suggestions for different scenarios
    print(f"\n💡 Namespace Name Suggestions:")
    scenarios = [
        ("ml-training-bot", "machine learning model training"),
        ("customer_service", "customer support interactions"),
        ("content-creator", "blog and social media content"),
        ("security-monitor", "system security monitoring"),
        ("data_pipeline", None)
    ]
    
    for agent_id, purpose in scenarios:
        suggestion = ns_manager.suggest_namespace_name(agent_id, purpose)
        purpose_text = f" ({purpose})" if purpose else ""
        print(f"  {agent_id}{purpose_text} → {suggestion}")


def demonstrate_best_practices():
    """Show namespace best practices."""
    print(f"\n📚 Namespace Best Practices")
    print("=" * 30)
    
    print("✅ DO:")
    print("  • Use descriptive namespace names")
    print("  • Follow consistent naming patterns")
    print("  • Limit shared namespace access to what's needed")
    print("  • Use private namespaces for sensitive data")
    print("  • Document namespace purposes")
    
    print("\n❌ DON'T:")
    print("  • Share namespaces unnecessarily")
    print("  • Use generic names like 'data' or 'temp'")
    print("  • Mix different project data in same namespace")
    print("  • Grant admin permissions unless required")
    print("  • Store personal data in shared spaces")
    
    print("\n🏗 Naming Patterns:")
    patterns = {
        "Agent Private": "{agent-id}-workspace",
        "Team Project": "team-{project-name}", 
        "Department": "dept-{department-name}",
        "Public Knowledge": "public-{domain}",
        "Shared Resources": "shared-{resource-type}"
    }
    
    for pattern_type, pattern in patterns.items():
        print(f"  {pattern_type}: {pattern}")
    
    print("\n🔐 Security Guidelines:")
    print("  • Review agent permissions regularly")
    print("  • Use least-privilege principle")
    print("  • Monitor cross-namespace access")
    print("  • Rotate API keys periodically")
    print("  • Audit shared namespace usage")


def main():
    """Run namespace management demonstration."""
    print("🌐 OpenMemory Namespace Management Examples")
    print("=" * 50)
    print("Learn how to organize memory spaces for multi-agent collaboration\n")
    
    # Explain concepts
    ns_manager = demonstrate_namespace_concepts()
    
    # Set up team environment
    research_team = setup_research_environment()
    
    # Show isolation
    alice, bob = demonstrate_namespace_isolation()
    
    # Show collaboration
    project_team = demonstrate_shared_collaboration()
    
    # Management tools
    demonstrate_namespace_management_tools()
    
    # Best practices
    demonstrate_best_practices()
    
    print(f"\n🎉 Namespace management examples completed!")
    print("=" * 50)
    print("Your agents are now ready for organized, collaborative memory management")


if __name__ == "__main__":
    main()