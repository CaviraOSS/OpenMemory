import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Save, RefreshCw } from 'lucide-react'
import { useSettingsStore } from '@/stores/settings-store'
import { PageTransition } from '@/components/animations/page-transitions'
import { toast } from 'sonner'
import type { Settings } from '@/stores/settings-store'

const EMBEDDING_PROVIDERS = [
  { value: 'synthetic', label: 'Synthetic (Default)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'ollama', label: 'Ollama (Local)' }
]

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
]

export function SettingsPage() {
  const settings = useSettingsStore()
  const [formData, setFormData] = useState<Settings>({
    apiUrl: settings.apiUrl,
    apiKey: settings.apiKey,
    mcpUrl: settings.mcpUrl,
    embeddingProvider: settings.embeddingProvider,
    embeddingModel: settings.embeddingModel,
    decayLambda: settings.decayLambda,
    theme: settings.theme,
    autoRefresh: settings.autoRefresh,
    refreshInterval: settings.refreshInterval
  })

  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      Object.entries(formData).forEach(([key, value]) => {
        settings.updateSettings({ [key]: value })
      })
      toast.success('Settings saved successfully')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    const defaultSettings: Settings = {
      apiUrl: 'http://localhost:8080',
      apiKey: '',
      mcpUrl: 'http://localhost:8081',
      embeddingProvider: 'synthetic',
      embeddingModel: '',
      decayLambda: 0.02,
      theme: 'system',
      autoRefresh: false,
      refreshInterval: 30000
    }
    setFormData(defaultSettings)
    toast.info('Settings reset to defaults')
  }

  const updateField = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  return (
    <PageTransition>
      <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Configure OpenMemory and MCP settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
          <CardDescription>
            Configure your OpenMemory API connection
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-url">API Base URL</Label>
            <Input
              id="api-url"
              type="url"
              value={formData.apiUrl}
              onChange={(e) => updateField('apiUrl', e.target.value)}
              placeholder="http://localhost:8080"
            />
            <p className="text-xs text-muted-foreground">
              The base URL for your OpenMemory API server
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="api-key">API Key (Optional)</Label>
            <Input
              id="api-key"
              type="password"
              value={formData.apiKey}
              onChange={(e) => updateField('apiKey', e.target.value)}
              placeholder="Enter API key if required"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank if your API doesn't require authentication
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MCP Configuration</CardTitle>
          <CardDescription>
            Model Context Protocol server settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mcp-url">MCP Server URL</Label>
            <Input
              id="mcp-url"
              type="url"
              value={formData.mcpUrl}
              onChange={(e) => updateField('mcpUrl', e.target.value)}
              placeholder="http://localhost:8081"
            />
            <p className="text-xs text-muted-foreground">
              The URL for your MCP server endpoint
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Embedding Provider</CardTitle>
          <CardDescription>
            Choose how memories are embedded
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="embedding-provider">Provider</Label>
            <Select
              value={formData.embeddingProvider}
              onValueChange={(v) => updateField('embeddingProvider', v as Settings['embeddingProvider'])}
            >
              <SelectTrigger id="embedding-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMBEDDING_PROVIDERS.map(provider => (
                  <SelectItem key={provider.value} value={provider.value}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Synthetic uses no external API. For production, use OpenAI or Gemini.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interface Settings</CardTitle>
          <CardDescription>
            Customize your dashboard experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="theme">Theme</Label>
            <Select
              value={formData.theme}
              onValueChange={(v) => updateField('theme', v as Settings['theme'])}
            >
              <SelectTrigger id="theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEMES.map(theme => (
                  <SelectItem key={theme.value} value={theme.value}>
                    {theme.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-refresh">Auto Refresh</Label>
              <p className="text-xs text-muted-foreground">
                Automatically refresh memory data
              </p>
            </div>
            <Switch
              id="auto-refresh"
              checked={formData.autoRefresh}
              onCheckedChange={(checked) => updateField('autoRefresh', checked)}
            />
          </div>

          {formData.autoRefresh && (
            <div className="space-y-2">
              <Label htmlFor="refresh-interval">Refresh Interval (ms)</Label>
              <Input
                id="refresh-interval"
                type="number"
                value={formData.refreshInterval}
                onChange={(e) => updateField('refreshInterval', parseInt(e.target.value))}
                min={5000}
                step={1000}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 5000ms (5 seconds)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
        <Button variant="outline" onClick={handleReset}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reset to Defaults
        </Button>
      </div>
    </div>
    </PageTransition>
  )
}
