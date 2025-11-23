#!/usr/bin/env python3

import sys
import os
import shutil
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'sdk-py', 'src'))

from openmemory import OpenMemory

TEST_DB_PATH = './data/test-sdk.sqlite'
test_results = {'passed': 0, 'failed': 0, 'total': 0, 'failures': []}

def assert_test(condition, message):
    test_results['total'] += 1
    if condition:
        test_results['passed'] += 1
        print(f"✅ {message}")
    else:
        test_results['failed'] += 1
        test_results['failures'].append(message)
        print(f"❌ {message}")

def cleanup_test_db():
    try:
        os.remove(TEST_DB_PATH)
    except FileNotFoundError:
        pass

def test_sdk_initialization():
    print('📋 Testing SDK Initialization...\n')
    
    # Test 1: Should fail without required config
    try:
        OpenMemory()
        assert_test(False, 'Should throw error without required config')
    except ValueError:
        assert_test(True, 'Correctly throws error without required config')
    
    # Test 2: Should fail without path
    try:
        OpenMemory(tier='fast', embeddings={'provider': 'synthetic'})
        assert_test(False, 'Should throw error without path')
    except ValueError as e:
        assert_test('requires "path"' in str(e), 'Error message mentions missing path')
    
    # Test 3: Should fail without tier
    try:
        OpenMemory(path=TEST_DB_PATH, embeddings={'provider': 'synthetic'})
        assert_test(False, 'Should throw error without tier')
    except ValueError as e:
        assert_test('requires "tier"' in str(e), 'Error message mentions missing tier')
    
    # Test 4: Should fail without embeddings
    try:
        OpenMemory(path=TEST_DB_PATH, tier='fast')
        assert_test(False, 'Should throw error without embeddings')
    except ValueError as e:
        assert_test('embeddings' in str(e), 'Error message mentions missing embeddings')
    
    # Test 5: Should initialize with proper config
    try:
        mem = OpenMemory(
            path=TEST_DB_PATH,
            tier='fast',
            embeddings={'provider': 'synthetic'}
        )
        assert_test(mem is not None, 'Successfully initializes with proper config')
        mem.close()
    except Exception as e:
        assert_test(False, f'Initialization failed: {str(e)}')

def test_memory_operations():
    print('\n🧠 Testing Memory Operations...\n')
    
    mem = OpenMemory(
        path=TEST_DB_PATH,
        tier='fast',
        embeddings={'provider': 'synthetic'}
    )
    
    # Test add
    mem1, mem2 = None, None
    try:
        mem1 = mem.add("Test memory 1")
        assert_test(mem1['id'] is not None, 'Add returns memory with ID')
        assert_test(mem1['content'] == "Test memory 1", 'Add preserves content')
    except Exception as e:
        assert_test(False, f'Add failed: {str(e)}')
    
    # Test add with metadata
    try:
        mem2 = mem.add("Test memory 2", 
                       tags=["test", "sdk"], 
                       metadata={"source": "test"})
        assert_test(mem2['id'] is not None, 'Add with metadata returns ID')
    except Exception as e:
        assert_test(False, f'Add with metadata failed: {str(e)}')
    
    # Test query
    try:
        results = mem.query("test memory")
        assert_test(isinstance(results, list), 'Query returns list')
        assert_test(len(results) > 0, 'Query finds results')
        assert_test(results[0]['content'] is not None, 'Query results have content')
    except Exception as e:
        assert_test(False, f'Query failed: {str(e)}')
    
    # Test getAll
    try:
        all_mems = mem.getAll()
        assert_test(isinstance(all_mems, list), 'GetAll returns list')
        assert_test(len(all_mems) >= 2, 'GetAll returns all memories')
    except Exception as e:
        assert_test(False, f'GetAll failed: {str(e)}')
    
    # Test delete
    if mem1:
        try:
            mem.delete(mem1['id'])
            after_delete = mem.getAll()
            assert_test(not any(m['id'] == mem1['id'] for m in after_delete), 
                       'Delete removes memory')
        except Exception as e:
            assert_test(False, f'Delete failed: {str(e)}')
    
    mem.close()

def test_sector_operations():
    print('\n🏗️ Testing Sector Operations...\n')
    
    mem = OpenMemory(
        path=TEST_DB_PATH,
        tier='smart',
        embeddings={'provider': 'synthetic'}
    )
    
    # Add memories that should go to different sectors
    memories = [
        {"content": "I went to Paris yesterday", "sector": "episodic"},
        {"content": "Python is a programming language", "sector": "semantic"},
        {"content": "To make coffee: add water, heat, brew", "sector": "procedural"},
        {"content": "I feel really happy today!", "sector": "emotional"},
        {"content": "I think I'm learning faster now", "sector": "reflective"}
    ]
    
    for m in memories:
        try:
            mem.add(m['content'])
        except Exception as e:
            assert_test(False, f"Add {m['sector']} memory failed: {str(e)}")
    
    # Test getBySector
    sectors = ['episodic', 'semantic', 'procedural', 'emotional', 'reflective']
    for sector in sectors:
        try:
            sector_mems = mem.getBySector(sector)
            assert_test(isinstance(sector_mems, list), 
                       f'getBySector({sector}) returns list')
        except Exception as e:
            assert_test(False, f'getBySector({sector}) failed: {str(e)}')
    
    mem.close()

def test_advanced_features():
    print('\n⚡ Testing Advanced Features...\n')
    
    # Test with decay configuration
    try:
        mem = OpenMemory(
            path='./data/test-advanced.sqlite',
            tier='smart',
            embeddings={'provider': 'synthetic'},
            decay={
                'intervalMinutes': 5,
                'reinforceOnQuery': True
            },
            compression={
                'enabled': True,
                'algorithm': 'semantic'
            }
        )
        assert_test(mem is not None, 'Initializes with advanced config')
        
        mem.add("Test with advanced features", decayLambda=0.1)
        assert_test(True, 'Add with custom decay works')
        
        mem.close()
        os.remove('./data/test-advanced.sqlite')
    except Exception as e:
        assert_test(False, f'Advanced features failed: {str(e)}')

def run_tests():
    print('🧪 OpenMemory Python SDK Tests')
    print('===============================\n')
    
    cleanup_test_db()
    
    try:
        test_sdk_initialization()
        test_memory_operations()
        test_sector_operations()
        test_advanced_features()
    except Exception as e:
        print(f'❌ Test execution failed: {str(e)}')
    
    cleanup_test_db()
    
    print('\n📊 Test Results')
    print('===============')
    print(f"✅ Passed: {test_results['passed']}")
    print(f"❌ Failed: {test_results['failed']}")
    print(f"📝 Total:  {test_results['total']}")
    
    if test_results['failures']:
        print('\n💥 Failures:')
        for failure in test_results['failures']:
            print(f'   - {failure}')
    
    success = test_results['failed'] == 0
    print(f"\n{'🎉 All tests passed!' if success else '💔 Some tests failed'}")
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    run_tests()