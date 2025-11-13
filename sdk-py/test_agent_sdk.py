#!/usr/bin/env python3
"""
Test script for OpenMemory Python SDK agent functionality.

This script tests the new agent registration and namespacing features
to ensure they work correctly with the OpenMemory backend.
"""

import sys
import traceback
from openmemory import OpenMemoryAgent, register_agent, create_agent_client, NamespaceManager


def test_agent_registration():
    """Test basic agent registration."""
    print("Testing agent registration...")
    
    try:
        # Test automatic registration
        agent = OpenMemoryAgent(
            agent_id="test-agent-py",
            namespace="test-namespace",
            description="Test agent for SDK validation",
            permissions=["read", "write"],
            auto_register=True
        )
        
        assert agent.api_key is not None, "Agent should have API key after registration"
        assert agent.agent_id == "test-agent-py", "Agent ID should match"
        assert agent.namespace == "test-namespace", "Namespace should match"
        
        print("✅ Agent registration test passed")
        return agent
        
    except Exception as e:
        print(f"❌ Agent registration test failed: {e}")
        traceback.print_exc()
        return None


def test_manual_registration():
    """Test manual agent registration process."""
    print("Testing manual registration...")
    
    try:
        # Test manual registration
        registration = register_agent(
            agent_id="manual-test-agent-py",
            namespace="manual-test-namespace",
            description="Manually registered test agent"
        )
        
        assert registration.api_key is not None, "Registration should return API key"
        assert registration.agent_id == "manual-test-agent-py", "Agent ID should match"
        
        # Test creating client with API key
        client = create_agent_client(
            agent_id=registration.agent_id,
            api_key=registration.api_key
        )
        
        assert client.api_key == registration.api_key, "Client should have correct API key"
        
        print("✅ Manual registration test passed")
        return client
        
    except Exception as e:
        print(f"❌ Manual registration test failed: {e}")
        traceback.print_exc()
        return None


def test_memory_operations(agent):
    """Test memory operations with agent."""
    print("Testing memory operations...")
    
    try:
        # Store memory
        result = agent.store_memory(
            content="This is a test memory from the Python SDK",
            sector="semantic",
            salience=0.8,
            metadata={"test": True, "sdk": "python"}
        )
        
        assert result.get('success', False), "Memory storage should succeed"
        memory_id = result.get('memory_id')
        assert memory_id is not None, "Should return memory ID"
        
        print(f"✅ Stored memory with ID: {memory_id}")
        
        # Query memory
        query_result = agent.query_memory(
            query="test memory python SDK",
            k=5
        )
        
        assert query_result.get('success', False), "Memory query should succeed"
        memories = query_result.get('results', [])
        assert len(memories) > 0, "Should find at least one memory"
        
        print(f"✅ Found {len(memories)} memories")
        
        # Reinforce memory
        if memory_id:
            reinforce_result = agent.reinforce_memory(memory_id)
            assert reinforce_result.get('success', False), "Memory reinforcement should succeed"
            print(f"✅ Reinforced memory: {memory_id}")
        
        print("✅ Memory operations test passed")
        return True
        
    except Exception as e:
        print(f"❌ Memory operations test failed: {e}")
        traceback.print_exc()
        return False


def test_namespace_management():
    """Test namespace management functionality."""
    print("Testing namespace management...")
    
    try:
        ns_manager = NamespaceManager()
        
        # List namespaces
        namespaces = ns_manager.list_namespaces()
        print(f"✅ Found {len(namespaces)} namespaces")
        
        # Test namespace name suggestions
        suggestions = [
            ns_manager.suggest_namespace_name("test-agent", "testing purposes"),
            ns_manager.suggest_namespace_name("data_processor", None)
        ]
        
        print(f"✅ Generated namespace suggestions: {suggestions}")
        
        # Test get agents for namespace (if any exist)
        if namespaces:
            test_ns = namespaces[0]['namespace']
            agents = ns_manager.get_namespace_agents(test_ns)
            print(f"✅ Found {len(agents)} agents for namespace '{test_ns}'")
        
        print("✅ Namespace management test passed")
        return True
        
    except Exception as e:
        print(f"❌ Namespace management test failed: {e}")
        traceback.print_exc()
        return False


def test_agent_management(agent):
    """Test agent management operations."""
    print("Testing agent management...")
    
    try:
        # List agents
        agents = agent.list_agents(show_api_keys=False)
        print(f"✅ Found {len(agents)} registered agents")
        
        # Get registration info
        info = agent.get_registration_info()
        assert info is not None, "Should get registration info"
        assert info.agent_id == agent.agent_id, "Agent ID should match"
        print(f"✅ Retrieved registration info for {info.agent_id}")
        
        # Test health check
        health = agent.health_check()
        assert health.get('agent_registered', False), "Agent should be registered"
        print(f"✅ Health check passed - Agent registered: {health.get('agent_registered')}")
        
        # Get proxy info
        proxy_info = agent.get_proxy_info()
        assert 'service' in proxy_info, "Should get proxy service info"
        print(f"✅ Proxy service: {proxy_info.get('service')}")
        
        print("✅ Agent management test passed")
        return True
        
    except Exception as e:
        print(f"❌ Agent management test failed: {e}")
        traceback.print_exc()
        return False


def main():
    """Run all tests."""
    print("🧠 OpenMemory Python SDK Agent Tests")
    print("=" * 50)
    print("Testing new agent registration and namespacing features...")
    print("Make sure OpenMemory server is running on http://localhost:8080\n")
    
    test_results = []
    
    # Test agent registration
    agent1 = test_agent_registration()
    test_results.append(agent1 is not None)
    
    # Test manual registration
    agent2 = test_manual_registration()
    test_results.append(agent2 is not None)
    
    # Test memory operations (use first agent if available)
    test_agent = agent1 or agent2
    if test_agent:
        test_results.append(test_memory_operations(test_agent))
        test_results.append(test_agent_management(test_agent))
    else:
        test_results.extend([False, False])
    
    # Test namespace management
    test_results.append(test_namespace_management())
    
    # Summary
    passed = sum(test_results)
    total = len(test_results)
    
    print(f"\n🏁 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! Agent functionality is working correctly.")
        return 0
    else:
        print("❌ Some tests failed. Check the errors above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())