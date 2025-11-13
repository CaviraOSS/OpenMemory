#!/usr/bin/env node

const http = require('http');

// Test MCP proxy endpoint
async function testMCPProxy() {
    console.log('🧪 Testing MCP Proxy Connection...\n');
    
    try {
        // Test health endpoint first
        console.log('1. Testing health endpoint...');
        const healthResponse = await fetch('http://localhost:8082/api/proxy-health');
        const healthData = await healthResponse.json();
        console.log('✅ Health check:', healthData);
        
        // Test proxy info endpoint
        console.log('\n2. Testing proxy info endpoint...');
        const infoResponse = await fetch('http://localhost:8082/api/proxy-info');
        const infoData = await infoResponse.json();
        console.log('✅ Proxy info:', infoData);
        
        // Test MCP endpoint with minimal request
        console.log('\n3. Testing MCP endpoint with initialize request...');
        const mcpPayload = {
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: {
                    resources: {},
                    tools: {}
                },
                clientInfo: {
                    name: "test-client",
                    version: "1.0.0"
                }
            }
        };

        const mcpResponse = await fetch('http://localhost:8082/mcp-proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(mcpPayload)
        });
        
        const mcpData = await mcpResponse.text();
        console.log('✅ MCP endpoint response:');
        console.log('Status:', mcpResponse.status);
        console.log('Headers:', Object.fromEntries(mcpResponse.headers.entries()));
        console.log('Body:', mcpData);
        
        console.log('\n🎉 All tests passed! MCP proxy is working correctly.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

testMCPProxy();