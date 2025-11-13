#!/usr/bin/env node

/**
 * Quick MCP Tools Query Utility
 * 
 * Usage:
 *   node query-mcp-tools.js --list                    # List all tools
 *   node query-mcp-tools.js --tool openmemory_query   # Get tool details
 *   node query-mcp-tools.js --apis                    # List REST endpoints
 *   node query-mcp-tools.js --search memory           # Search tools/apis
 */

const { report } = require('./generate-mcp-report.js');

function printTable(headers, rows) {
    const maxWidths = headers.map((header, i) => 
        Math.max(header.length, ...rows.map(row => (row[i] || '').toString().length))
    );
    
    const separator = '+' + maxWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';
    const headerRow = '|' + headers.map((h, i) => ` ${h.padEnd(maxWidths[i])} `).join('|') + '|';
    const dataRows = rows.map(row => 
        '|' + row.map((cell, i) => ` ${(cell || '').toString().padEnd(maxWidths[i])} `).join('|') + '|'
    );
    
    console.log(separator);
    console.log(headerRow);
    console.log(separator);
    dataRows.forEach(row => console.log(row));
    console.log(separator);
}

function listAllTools() {
    console.log('📚 OpenMemory MCP Tools\n');
    
    console.log('🔹 Main MCP Server Tools:');
    const mainTools = report.services.main_mcp.tools.map(tool => [
        tool.name,
        tool.description.slice(0, 50) + '...',
        tool.parameters.length.toString(),
        tool.related_api || 'N/A'
    ]);
    printTable(['Tool Name', 'Description', 'Params', 'Related API'], mainTools);
    
    console.log('\n🔹 Proxy MCP Server Tools:');
    const proxyTools = report.services.proxy_mcp.tools.map(tool => [
        tool.name,
        tool.description.slice(0, 50) + '...',
        tool.parameters.length.toString(), 
        tool.related_api || 'N/A'
    ]);
    printTable(['Tool Name', 'Description', 'Params', 'Related API'], proxyTools);
}

function getToolDetails(toolName) {
    const allTools = [
        ...report.services.main_mcp.tools,
        ...report.services.proxy_mcp.tools
    ];
    
    const tool = allTools.find(t => t.name === toolName);
    if (!tool) {
        console.log(`❌ Tool '${toolName}' not found.`);
        return;
    }
    
    console.log(`🔧 Tool: ${tool.name}\n`);
    console.log(`📝 Description: ${tool.description}\n`);
    console.log(`📊 Parameters:`);
    
    const params = tool.parameters.map(p => [
        p.name,
        p.type,
        p.required ? '✅' : '❌',
        p.default !== undefined ? p.default.toString() : '-',
        p.description.slice(0, 40) + '...'
    ]);
    printTable(['Name', 'Type', 'Required', 'Default', 'Description'], params);
    
    console.log(`\n🔗 Related API: ${tool.related_api || 'N/A'}`);
    console.log(`📤 Returns: ${tool.returns}`);
}

function listAPIs() {
    console.log('🌐 OpenMemory REST API Endpoints\n');
    
    const apis = report.rest_apis.map(api => [
        api.method,
        api.endpoint,
        api.service,
        api.port.toString(),
        api.authentication === false ? '❌' : (api.authentication === true ? '✅' : api.authentication),
        api.description.slice(0, 40) + '...'
    ]);
    
    printTable(['Method', 'Endpoint', 'Service', 'Port', 'Auth', 'Description'], apis);
}

function searchTools(searchTerm) {
    const allTools = [
        ...report.services.main_mcp.tools.map(t => ({ ...t, service: 'Main MCP' })),
        ...report.services.proxy_mcp.tools.map(t => ({ ...t, service: 'Proxy MCP' }))
    ];
    
    const matchingTools = allTools.filter(tool => 
        tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const matchingAPIs = report.rest_apis.filter(api =>
        api.endpoint.toLowerCase().includes(searchTerm.toLowerCase()) ||
        api.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (matchingTools.length > 0) {
        console.log(`🔍 Matching MCP Tools for "${searchTerm}":\n`);
        const results = matchingTools.map(tool => [
            tool.name,
            tool.service,
            tool.description.slice(0, 50) + '...',
            tool.related_api || 'N/A'
        ]);
        printTable(['Tool Name', 'Service', 'Description', 'Related API'], results);
    }
    
    if (matchingAPIs.length > 0) {
        console.log(`\n🌐 Matching API Endpoints for "${searchTerm}":\n`);
        const results = matchingAPIs.map(api => [
            api.method,
            api.endpoint,
            api.service,
            api.description.slice(0, 40) + '...'
        ]);
        printTable(['Method', 'Endpoint', 'Service', 'Description'], results);
    }
    
    if (matchingTools.length === 0 && matchingAPIs.length === 0) {
        console.log(`❌ No tools or APIs found matching "${searchTerm}"`);
    }
}

function showHelp() {
    console.log(`📚 OpenMemory MCP Tools Query Utility

Usage:
  node query-mcp-tools.js --list                    List all MCP tools
  node query-mcp-tools.js --tool <name>             Get specific tool details  
  node query-mcp-tools.js --apis                    List REST API endpoints
  node query-mcp-tools.js --search <term>           Search tools and APIs
  node query-mcp-tools.js --help                    Show this help

Examples:
  node query-mcp-tools.js --list
  node query-mcp-tools.js --tool openmemory_query
  node query-mcp-tools.js --search memory
  node query-mcp-tools.js --apis

Tool Categories:
  📁 Main MCP Server: Core memory operations (query, store, list, etc.)
  🔐 Proxy MCP Server: Multi-agent namespace management
  🌐 REST APIs: Direct HTTP access to all functionality

Total: ${report.services.main_mcp.tools.length + report.services.proxy_mcp.tools.length} MCP tools, ${report.rest_apis.length} REST endpoints
`);
}

// Main CLI handler
function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
        showHelp();
        return;
    }
    
    if (args.includes('--list') || args.includes('-l')) {
        listAllTools();
        return;
    }
    
    if (args.includes('--apis') || args.includes('-a')) {
        listAPIs();
        return;
    }
    
    const toolIndex = args.indexOf('--tool');
    if (toolIndex !== -1 && args[toolIndex + 1]) {
        getToolDetails(args[toolIndex + 1]);
        return;
    }
    
    const searchIndex = args.indexOf('--search');
    if (searchIndex !== -1 && args[searchIndex + 1]) {
        searchTools(args[searchIndex + 1]);
        return;
    }
    
    console.log('❌ Unknown command. Use --help for usage information.');
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { listAllTools, getToolDetails, listAPIs, searchTools };