import { useState, lazy, Suspense } from 'react'
import { Home, Database, Search, Network, BarChart3, Upload, FileText, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter
} from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/theme-toggle'
import { ConnectionStatus } from '@/components/connection-status'
import { AnimatePresence } from 'framer-motion'
import {
  OverviewPageSkeleton,
  MemoriesPageSkeleton,
  QueryPageSkeleton,
  GraphPageSkeleton,
  AnalyticsPageSkeleton,
  IngestPageSkeleton,
  ApiDocsPageSkeleton,
  SettingsPageSkeleton
} from '@/components/skeletons'

// Lazy load all page components
const OverviewPage = lazy(() => import('./pages/overview-page').then(m => ({ default: m.OverviewPage })))
const MemoriesPage = lazy(() => import('./pages/memories-page').then(m => ({ default: m.MemoriesPage })))
const QueryPage = lazy(() => import('./pages/query-page').then(m => ({ default: m.QueryPage })))
const GraphPage = lazy(() => import('./pages/graph-page').then(m => ({ default: m.GraphPage })))
const AnalyticsPage = lazy(() => import('./pages/analytics-page').then(m => ({ default: m.AnalyticsPage })))
const IngestPage = lazy(() => import('./pages/ingest-page').then(m => ({ default: m.IngestPage })))
const ApiDocsPage = lazy(() => import('./pages/api-docs-page').then(m => ({ default: m.ApiDocsPage })))
const SettingsPage = lazy(() => import('./pages/settings-page').then(m => ({ default: m.SettingsPage })))

const menuItems = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'memories', label: 'Memories', icon: Database },
  { id: 'query', label: 'Query', icon: Search },
  { id: 'graph', label: '3D Graph', icon: Network },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'ingest', label: 'Ingest', icon: Upload },
  { id: 'api-docs', label: 'API Docs', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings }
] as const

type ViewId = typeof menuItems[number]['id']

export function Dashboard() {
  const [activeView, setActiveView] = useState<ViewId>('overview')
  const [loadedPages, setLoadedPages] = useState<Set<ViewId>>(new Set(['overview']))

  // Mark page as loaded when successfully rendered
  const handlePageLoad = (pageId: ViewId) => {
    setLoadedPages(prev => new Set([...prev, pageId]))
  }

  // Change view handler
  const handleViewChange = (viewId: ViewId) => {
    setActiveView(viewId)
    // Mark as loaded when switching (will be marked again after Suspense resolves)
    if (!loadedPages.has(viewId)) {
      // Give it a moment to load before marking
      setTimeout(() => handlePageLoad(viewId), 100)
    }
  }

  const LoadingFallback = () => {
    // If page was already loaded before, show minimal loading or nothing
    const isReload = loadedPages.has(activeView)

    if (isReload) {
      // Minimal loading indicator for already-loaded pages
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )
    }

    // First-time load: show full skeleton
    switch (activeView) {
      case 'overview':
        return <OverviewPageSkeleton />
      case 'memories':
        return <MemoriesPageSkeleton />
      case 'query':
        return <QueryPageSkeleton />
      case 'graph':
        return <GraphPageSkeleton />
      case 'analytics':
        return <AnalyticsPageSkeleton />
      case 'ingest':
        return <IngestPageSkeleton />
      case 'api-docs':
        return <ApiDocsPageSkeleton />
      case 'settings':
        return <SettingsPageSkeleton />
      default:
        return <OverviewPageSkeleton />
    }
  }

  const renderView = () => {
    return (
      <AnimatePresence mode="wait">
        <Suspense key={activeView} fallback={<LoadingFallback />}>
          {activeView === 'overview' && <OverviewPage />}
          {activeView === 'memories' && <MemoriesPage />}
          {activeView === 'query' && <QueryPage />}
          {activeView === 'graph' && <GraphPage />}
          {activeView === 'analytics' && <AnalyticsPage />}
          {activeView === 'ingest' && <IngestPage />}
          {activeView === 'api-docs' && <ApiDocsPage />}
          {activeView === 'settings' && <SettingsPage />}
        </Suspense>
      </AnimatePresence>
    )
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar>
        <SidebarHeader>
          <div className="px-4 py-2">
            <h2 className="text-lg font-bold">OpenMemory</h2>
            <p className="text-xs text-muted-foreground">AI Memory Dashboard</p>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => handleViewChange(item.id)}
                      className={cn(
                        activeView === item.id && 'bg-sidebar-accent text-sidebar-accent-foreground'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <ConnectionStatus />
          <div className="flex items-center justify-end px-4 py-2">
            <ThemeToggle />
          </div>
        </SidebarFooter>
      </Sidebar>

      <main className="flex-1 overflow-auto bg-background">
        <div className="container mx-auto p-4 sm:p-6 max-w-[1600px]">
          {renderView()}
        </div>
      </main>
    </div>
  )
}
