import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, Check } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings-store'
import { toast } from 'sonner'
import { PageTransition } from '@/components/animations/page-transitions'

interface ApiEndpoint {
  method: string
  path: string
  description: string
  params?: { name: string; type: string; description: string }[]
  body?: { name: string; type: string; description: string }[]
  response: string
}

const API_ENDPOINTS: ApiEndpoint[] = [
  {
    method: 'GET',
    path: '/health',
    description: 'Check API health status',
    response: '{ "status": "ok", "database": "connected" }'
  },
  {
    method: 'GET',
    path: '/sectors',
    description: 'Get all available memory sectors',
    response: '{ "sectors": ["episodic", "semantic", "procedural", "emotional", "reflective"] }'
  },
  {
    method: 'POST',
    path: '/memory/add',
    description: 'Add a new memory',
    body: [
      { name: 'content', type: 'string', description: 'Memory content' },
      { name: 'sector', type: 'string', description: 'Target sector (episodic, semantic, etc.)' },
      { name: 'tags', type: 'string[]', description: 'Optional tags' },
      { name: 'metadata', type: 'object', description: 'Optional metadata' }
    ],
    response: '{ "id": "memory-id", "status": "success" }'
  },
  {
    method: 'POST',
    path: '/memory/query',
    description: 'Query memories by content',
    body: [
      { name: 'query', type: 'string', description: 'Search query' },
      { name: 'top_k', type: 'number', description: 'Number of results (default: 10)' },
      { name: 'min_score', type: 'number', description: 'Minimum similarity score (0-1)' }
    ],
    response: '[{ "id": "...", "content": "...", "score": 0.95, "salience": 0.8, ... }]'
  },
  {
    method: 'POST',
    path: '/memory/ingest',
    description: 'Ingest a file into memories',
    body: [
      { name: 'file', type: 'File', description: 'PDF, DOCX, HTML, or TXT file' },
      { name: 'sector', type: 'string', description: 'Target sector' }
    ],
    response: '{ "message": "File ingested successfully", "chunks": 42 }'
  },
  {
    method: 'POST',
    path: '/memory/reinforce',
    description: 'Reinforce a specific memory',
    body: [
      { name: 'memory_id', type: 'string', description: 'Memory ID to reinforce' }
    ],
    response: '{ "id": "memory-id", "salience": 0.95 }'
  },
  {
    method: 'GET',
    path: '/memory/all',
    description: 'Get all memories',
    params: [
      { name: 'limit', type: 'number', description: 'Max results (optional)' },
      { name: 'offset', type: 'number', description: 'Pagination offset (optional)' }
    ],
    response: '[{ "id": "...", "content": "...", "salience": 0.8, ... }]'
  },
  {
    method: 'GET',
    path: '/memory/:id',
    description: 'Get a specific memory by ID',
    params: [
      { name: 'id', type: 'string', description: 'Memory ID' }
    ],
    response: '{ "id": "...", "content": "...", "salience": 0.8, ... }'
  },
  {
    method: 'DELETE',
    path: '/memory/:id',
    description: 'Delete a specific memory',
    params: [
      { name: 'id', type: 'string', description: 'Memory ID' }
    ],
    response: '{ "success": true }'
  }
]

export function ApiDocsPage() {
  const settings = useSettingsStore()
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const baseUrl = settings.apiUrl || 'http://localhost:8080'
  const mcpUrl = settings.mcpUrl || 'http://localhost:8081'

  const copyToClipboard = (text: string, type: 'url' | 'code', id: string) => {
    navigator.clipboard.writeText(text)
    if (type === 'url') {
      setCopiedUrl(id)
      setTimeout(() => setCopiedUrl(null), 2000)
    } else {
      setCopiedCode(id)
      setTimeout(() => setCopiedCode(null), 2000)
    }
    toast.success('Copied to clipboard')
  }

  const generateCurlExample = (endpoint: ApiEndpoint): string => {
    const fullUrl = `${baseUrl}${endpoint.path}`
    let curl = `curl -X ${endpoint.method} "${fullUrl}"`

    if (endpoint.body) {
      curl += ` \\\n  -H "Content-Type: application/json"`
      const bodyExample: Record<string, unknown> = {}
      endpoint.body.forEach(param => {
        bodyExample[param.name] = param.type === 'string' ? 'example' : param.type === 'number' ? 10 : {}
      })
      curl += ` \\\n  -d '${JSON.stringify(bodyExample, null, 2)}'`
    }

    return curl
  }

  return (
    <PageTransition>
      <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">API Documentation</h2>
        <p className="text-muted-foreground">
          Reference for all OpenMemory API endpoints
        </p>
      </div>

      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">API Base URL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-secondary px-3 py-2 rounded">
                {baseUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(baseUrl, 'url', 'base')}
              >
                {copiedUrl === 'base' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">MCP Server URL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-secondary px-3 py-2 rounded">
                {mcpUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(mcpUrl, 'url', 'mcp')}
              >
                {copiedUrl === 'mcp' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {API_ENDPOINTS.map((endpoint, idx) => (
          <Card key={idx}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant={endpoint.method === 'GET' ? 'default' : 'secondary'}>
                    {endpoint.method}
                  </Badge>
                  <div>
                    <CardTitle className="text-lg font-mono">{endpoint.path}</CardTitle>
                    <CardDescription className="mt-1">
                      {endpoint.description}
                    </CardDescription>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(`${baseUrl}${endpoint.path}`, 'url', `endpoint-${idx}`)}
                >
                  {copiedUrl === `endpoint-${idx}` ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {endpoint.params && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Parameters</h4>
                  <div className="space-y-2">
                    {endpoint.params.map((param, pidx) => (
                      <div key={pidx} className="flex items-start gap-2 text-sm">
                        <code className="bg-secondary px-2 py-0.5 rounded">{param.name}</code>
                        <span className="text-muted-foreground">({param.type})</span>
                        <span className="text-muted-foreground">- {param.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {endpoint.body && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Request Body</h4>
                  <div className="space-y-2">
                    {endpoint.body.map((param, bidx) => (
                      <div key={bidx} className="flex items-start gap-2 text-sm">
                        <code className="bg-secondary px-2 py-0.5 rounded">{param.name}</code>
                        <span className="text-muted-foreground">({param.type})</span>
                        <span className="text-muted-foreground">- {param.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold mb-2">Response</h4>
                <div className="relative">
                  <pre className="bg-secondary p-3 rounded text-xs overflow-x-auto">
                    <code>{endpoint.response}</code>
                  </pre>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">cURL Example</h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(generateCurlExample(endpoint), 'code', `curl-${idx}`)}
                  >
                    {copiedCode === `curl-${idx}` ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="relative">
                  <pre className="bg-secondary p-3 rounded text-xs overflow-x-auto">
                    <code>{generateCurlExample(endpoint)}</code>
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
    </PageTransition>
  )
}
