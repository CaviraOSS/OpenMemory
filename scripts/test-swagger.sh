#!/bin/bash

# Test script for OpenMemory API with Swagger documentation
BASE_URL="http://localhost:8081"

echo "🚀 Testing OpenMemory API Endpoints"
echo "=================================="

# Test health endpoint
echo "1. Testing Health Endpoint..."
HEALTH_RESPONSE=$(curl -s "${BASE_URL}/health")
echo "   Status: $(echo $HEALTH_RESPONSE | jq -r '.ok // "ERROR"')"
echo "   Version: $(echo $HEALTH_RESPONSE | jq -r '.version // "ERROR"')"
echo "   Tier: $(echo $HEALTH_RESPONSE | jq -r '.tier // "ERROR"')"

echo

# Test OpenAPI spec endpoint
echo "2. Testing OpenAPI Spec Endpoint..."
OPENAPI_RESPONSE=$(curl -s "${BASE_URL}/openapi.json")
TITLE=$(echo $OPENAPI_RESPONSE | jq -r '.info.title // "ERROR"')
VERSION=$(echo $OPENAPI_RESPONSE | jq -r '.info.version // "ERROR"')
echo "   API Title: $TITLE"
echo "   API Version: $VERSION"
echo "   Endpoints Count: $(echo $OPENAPI_RESPONSE | jq '.paths | length')"

echo

# Test Swagger UI endpoint (just check if it returns HTML)
echo "3. Testing Swagger UI Endpoint..."
SWAGGER_RESPONSE=$(curl -s "${BASE_URL}/api-docs" | head -1)
if [[ $SWAGGER_RESPONSE == *"<!DOCTYPE html>"* ]]; then
    echo "   Swagger UI: ✅ Available (HTML page served)"
else
    echo "   Swagger UI: ❌ Not available"
fi

echo

# Test memory endpoint (should require API key but should return auth error, not 404)
echo "4. Testing Memory Add Endpoint (no auth)..."
MEMORY_RESPONSE=$(curl -s -X POST "${BASE_URL}/memory/add" \
    -H "Content-Type: application/json" \
    -d '{"content":"test memory"}')
echo "   Response: $MEMORY_RESPONSE"

echo

echo "🎉 API Documentation Setup Complete!"
echo "📖 Access your API documentation at:"
echo "   - Swagger UI: ${BASE_URL}/api-docs"
echo "   - OpenAPI Spec: ${BASE_URL}/openapi.json"