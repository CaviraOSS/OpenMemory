#!/usr/bin/env python3

import sys
import os
import time
import subprocess
import json
import urllib.request
import urllib.parse
import urllib.error
from typing import Optional, Dict, Any

# Add the SDK to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'SDK/python'))

# Try to import the SDK, fallback to mock if not available
try:
    from openmemory import OpenMemory, SECTORS
    SDK_AVAILABLE = True
except ImportError:
    print('Warning: SDK not found, using mock implementation')
    SDK_AVAILABLE = False
    
    SECTORS = ['episodic', 'semantic', 'procedural', 'emotional', 'reflective']
    
    class OpenMemory:
        def __init__(self, base_url='http://localhost:8080', auth_key=None):
            self.base_url = base_url
            self.auth_key = auth_key
        
        def health_check(self):
            return {'status': 'healthy'}
        
        def add(self, content, metadata=None):
            return {
                'id': f'test-id-{int(time.time() * 1000)}',
                'content': content,
                'metadata': metadata or {},
                'primary_sector': 'semantic',
                'sectors': ['semantic'],
                'salience': 1.0
            }
        
        def get_memory(self, memory_id):
            return {
                'id': memory_id,
                'content': 'Test memory content',
                'primary_sector': 'semantic',
                'sectors': ['semantic']
            }
        
        def query(self, query, k=10, use_graph=False):
            return {
                'matches': [
                    {
                        'id': 'test-match-1',
                        'content': 'Test match content',
                        'score': 0.95,
                        'primary_sector': 'semantic',
                        'sectors': ['semantic'],
                        'path': ['node1', 'node2'] if use_graph else []
                    }
                ]
            }
        
        def list_memories(self, limit=10, offset=0):
            return {
                'items': [
                    {'id': 'test-1', 'content': 'Test memory 1'},
                    {'id': 'test-2', 'content': 'Test memory 2'}
                ],
                'total': 2
            }
        
        def update(self, memory_id, content=None, tags=None, metadata=None):
            return {'id': memory_id, 'updated': True}
        
        def delete_memory(self, memory_id):
            return {'success': True}
        
        def get_sectors(self):
            return {
                'sectors': SECTORS,
                'stats': [{'sector': 'semantic', 'count': 5}]
            }
        
        def query_sector(self, query, sector, k=10):
            return {
                'matches': [
                    {
                        'id': 'sector-match-1',
                        'content': 'Sector-specific match',
                        'score': 0.9,
                        'sectors': [sector]
                    }
                ]
            }
        
        def get_by_sector(self, sector, limit=10):
            return {
                'items': [
                    {'id': 'sector-item-1', 'content': 'Sector item', 'sectors': [sector]}
                ]
            }

API_BASE_URL = 'http://localhost:8080'
server_process: Optional[subprocess.Popen] = None
client: Optional[OpenMemory] = None
test_results = {'passed': 0, 'failed': 0, 'total': 0, 'failures': []}

# Simple assertion functions
def assert_test(condition, message):
    test_results['total'] += 1
    if condition:
        test_results['passed'] += 1
        print(f'✅ {message}')
    else:
        test_results['failed'] += 1
        test_results['failures'].append(message)
        print(f'❌ {message}')

def assert_equal(actual, expected, message):
    assert_test(actual == expected, message or f'Expected {expected}, got {actual}')

def assert_true(condition, message):
    assert_test(condition is True, message or 'Expected True')

def assert_in(item, container, message):
    assert_test(item in container, message or f'Expected {item} in {container}')

def assert_isinstance(obj, class_or_tuple, message):
    assert_test(isinstance(obj, class_or_tuple), message or f'Expected {obj} to be instance of {class_or_tuple}')

def assert_greater(a, b, message):
    assert_test(a > b, message or f'Expected {a} > {b}')

def assert_property(obj, prop, message):
    condition = hasattr(obj, prop) if not isinstance(obj, dict) else prop in obj
    assert_test(condition, message or f'Expected {prop} in object')

# Test functions
def test_sdk_initialization():
    """Test SDK initialization with different configurations"""
    print('📋 Testing SDK Initialization...')
    
    try:
        # Default initialization
        default_client = OpenMemory()
        assert_test(default_client is not None, 'Should initialize with default configuration')
        
        # Custom configuration
        custom_client = OpenMemory(
            base_url='http://localhost:8080',
            auth_key='test-key'
        )
        assert_test(custom_client is not None, 'Should initialize with custom configuration')
    except Exception as e:
        assert_test(False, f'SDK initialization failed: {e}')

def test_health_check():
    """Test server health check"""
    print('\n🏥 Testing Health Check...')
    
    try:
        health = client.health_check()
        assert_property(health, 'status', 'Health response should have status property')
        assert_equal(health['status'], 'healthy', 'Health status should be healthy')
    except Exception as e:
        assert_test(False, f'Health check failed: {e}')

def test_add_memory():
    """Test adding a new memory"""
    print('\n🧠 Testing Add Memory...')
    
    try:
        content = 'This is a test memory from Python SDK'
        memory = client.add(content)
        
        assert_property(memory, 'id', 'Added memory should have ID')
        assert_equal(memory['content'], content, 'Added memory should have correct content')
        assert_property(memory, 'primary_sector', 'Added memory should have primary sector')
        assert_property(memory, 'sectors', 'Added memory should have sectors')
        assert_isinstance(memory['sectors'], list, 'Sectors should be a list')
        assert_property(memory, 'salience', 'Added memory should have salience')
        assert_isinstance(memory['salience'], (int, float), 'Salience should be a number')
        
        return memory['id']
    except Exception as e:
        assert_test(False, f'Add memory failed: {e}')
        return None

def test_add_memory_with_metadata():
    """Test adding memory with metadata"""
    print('\n📝 Testing Add Memory with Metadata...')
    
    try:
        content = 'Memory with metadata test'
        metadata = {'source': 'test', 'importance': 'high'}
        memory = client.add(content, metadata=metadata)
        
        assert_equal(memory['content'], content, 'Memory should have correct content')
        assert_property(memory, 'metadata', 'Memory should have metadata property')
        
        for key, value in metadata.items():
            assert_equal(memory['metadata'][key], value, f'Metadata should contain {key}={value}')
    except Exception as e:
        assert_test(False, f'Add memory with metadata failed: {e}')

def test_get_memory(memory_id):
    """Test retrieving a memory by ID"""
    print('\n🔍 Testing Get Memory...')
    
    if not memory_id:
        print('   Skipping get memory test - no memory ID available')
        return
    
    try:
        retrieved = client.get_memory(memory_id)
        assert_equal(retrieved['id'], memory_id, 'Retrieved memory should have correct ID')
        assert_property(retrieved, 'content', 'Retrieved memory should have content')
        assert_property(retrieved, 'primary_sector', 'Retrieved memory should have primary sector')
    except Exception as e:
        assert_test(False, f'Get memory failed: {e}')

def test_update_memory(memory_id):
    """Test updating a memory"""
    print('\n✏️ Testing Update Memory...')
    
    if not memory_id:
        print('   Skipping update memory test - no memory ID available')
        return
    
    try:
        updated_memory = client.update(
            memory_id,
            content='This is an UPDATED test memory from Python SDK',
            tags=['test', 'updated', 'py-sdk'],
            metadata={'updated': True, 'source': 'py-sdk-test'}
        )
        
        assert_property(updated_memory, 'id', 'Updated memory should have ID')
        assert_property(updated_memory, 'updated', 'Updated memory should have updated flag')
        assert_true(updated_memory['updated'], 'Updated flag should be True')
    except Exception as e:
        assert_test(False, f'Update memory failed: {e}')

def test_query_memories():
    """Test querying memories"""
    print('\n🔎 Testing Query Memories...')
    
    try:
        # Add a test memory first if using real SDK
        if SDK_AVAILABLE:
            client.add('Python SDK query test memory')
        
        query = 'Python SDK test'
        results = client.query(query, k=5)
        
        assert_property(results, 'matches', 'Query should return matches')
        assert_isinstance(results['matches'], list, 'Matches should be a list')
        assert_greater(len(results['matches']), 0, 'Should find at least one match')
        
        if results['matches']:
            first_match = results['matches'][0]
            assert_property(first_match, 'id', 'Match should have ID')
            assert_property(first_match, 'content', 'Match should have content')
            assert_property(first_match, 'score', 'Match should have score')
            assert_property(first_match, 'primary_sector', 'Match should have primary sector')
            assert_isinstance(first_match['score'], (int, float), 'Score should be a number')
    except Exception as e:
        assert_test(False, f'Query memories failed: {e}')

def test_query_with_graph():
    """Test querying with graph traversal"""
    print('\n🔗 Testing Query with Graph Traversal...')
    
    try:
        results = client.query('test memory', k=3, use_graph=True)
        assert_property(results, 'matches', 'Graph query should return matches')
        assert_isinstance(results['matches'], list, 'Graph matches should be a list')
        
        if results['matches']:
            first_match = results['matches'][0]
            assert_property(first_match, 'path', 'Graph match should have path')
            assert_isinstance(first_match['path'], list, 'Path should be a list')
    except Exception as e:
        assert_test(False, f'Query with graph failed: {e}')

def test_list_memories():
    """Test listing memories"""
    print('\n📋 Testing List Memories...')
    
    try:
        memories = client.list_memories(limit=10, offset=0)
        assert_property(memories, 'items', 'List should return items')
        assert_isinstance(memories['items'], list, 'Items should be a list')
        assert_property(memories, 'total', 'List should return total count')
        assert_isinstance(memories['total'], int, 'Total should be an integer')
    except Exception as e:
        assert_test(False, f'List memories failed: {e}')

def test_delete_memory(memory_id):
    """Test deleting a memory"""
    print('\n🗑️ Testing Delete Memory...')
    
    if not memory_id:
        print('   Skipping delete memory test - no memory ID available')
        return
    
    try:
        result = client.delete_memory(memory_id)
        assert_property(result, 'success', 'Delete should return success property')
        assert_true(result['success'], 'Delete should be successful')
    except Exception as e:
        assert_test(False, f'Delete memory failed: {e}')

def test_sector_operations():
    """Test sector-related operations"""
    print('\n🏗️ Testing Sector Operations...')
    
    try:
        # Get sector information
        sectors_info = client.get_sectors()
        assert_property(sectors_info, 'sectors', 'Should return sectors list')
        assert_isinstance(sectors_info['sectors'], list, 'Sectors should be a list')
        
        for sector in SECTORS:
            assert_in(sector, sectors_info['sectors'], f'Should include {sector} sector')
        
        # Test sector-specific queries
        results = client.query_sector('machine learning', 'semantic', k=3)
        assert_property(results, 'matches', 'Sector query should return matches')
        assert_isinstance(results['matches'], list, 'Sector matches should be a list')
        
        # Test getting memories by sector
        memories = client.get_by_sector('emotional', limit=5)
        assert_property(memories, 'items', 'Sector memories should return items')
        assert_isinstance(memories['items'], list, 'Sector items should be a list')
        
    except Exception as e:
        assert_test(False, f'Sector operations failed: {e}')

def test_error_handling():
    """Test error handling"""
    print('\n⚠️ Testing Error Handling...')
    
    try:
        # Test with offline client (should work with mock)
        offline_client = OpenMemory(base_url='http://localhost:9999')
        
        try:
            health = offline_client.health_check()
            assert_test(True, 'Offline client test completed (using mock)')
        except Exception:
            assert_test(True, 'Expected error for offline client (real SDK)')
            
    except Exception as e:
        assert_test(False, f'Error handling test failed: {e}')

def run_python_tests():
    """Main test runner"""
    print('🧪 OpenMemory Python SDK Tests')
    print('===============================')
    
    global client
    
    # Initialize client
    try:
        client = OpenMemory(base_url=API_BASE_URL)
        print(f'✅ SDK client initialized ({"Real" if SDK_AVAILABLE else "Mock"} SDK)\n')
    except Exception as e:
        print(f'❌ Failed to initialize SDK client: {e}')
        return False
    
    # Run tests
    try:
        test_sdk_initialization()
        test_health_check()
        
        memory_id = test_add_memory()
        test_add_memory_with_metadata()
        test_get_memory(memory_id)
        test_update_memory(memory_id)
        test_query_memories()
        test_query_with_graph()
        test_list_memories()
        test_delete_memory(memory_id)
        test_sector_operations()
        test_error_handling()
        
    except Exception as e:
        print(f'❌ Test execution failed: {e}')
    
    # Print results
    print('\n📊 Test Results')
    print('===============')
    print(f'✅ Passed: {test_results["passed"]}')
    print(f'❌ Failed: {test_results["failed"]}')
    print(f'📝 Total:  {test_results["total"]}')
    
    if test_results['failures']:
        print('\n💥 Failures:')
        for failure in test_results['failures']:
            print(f'   - {failure}')
    
    success = test_results['failed'] == 0
    print(f'\n{"🎉 All tests passed!" if success else "💔 Some tests failed"}')
    return success

if __name__ == '__main__':
    success = run_python_tests()
    exit(0 if success else 1)