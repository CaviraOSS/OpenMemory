import { create } from 'zustand'
import type { GraphNode, GraphEdge, ApiCallLog } from '../lib/schemas'

interface AnalyticsState {
  apiCalls: ApiCallLog[]
  totalTokens: number
  graphData: {
    nodes: GraphNode[]
    edges: GraphEdge[]
  }
  sectorDistribution: Array<{
    sector: string
    count: number
    percentage: number
  }>
  memoryGrowth: Array<{
    date: string
    count: number
  }>

  addApiCall: (call: ApiCallLog) => void
  setGraphData: (nodes: GraphNode[], edges: GraphEdge[]) => void
  setSectorDistribution: (distribution: Array<{ sector: string; count: number; percentage: number }>) => void
  setMemoryGrowth: (growth: Array<{ date: string; count: number }>) => void
  clearAnalytics: () => void
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  apiCalls: [],
  totalTokens: 0,
  graphData: {
    nodes: [],
    edges: []
  },
  sectorDistribution: [],
  memoryGrowth: [],

  addApiCall: (call) =>
    set((state) => ({
      apiCalls: [call, ...state.apiCalls].slice(0, 1000), // Keep last 1000 calls
      totalTokens: state.totalTokens + (call.tokens || 0)
    })),

  setGraphData: (nodes, edges) =>
    set({ graphData: { nodes, edges } }),

  setSectorDistribution: (distribution) =>
    set({ sectorDistribution: distribution }),

  setMemoryGrowth: (growth) =>
    set({ memoryGrowth: growth }),

  clearAnalytics: () =>
    set({
      apiCalls: [],
      totalTokens: 0,
      sectorDistribution: [],
      memoryGrowth: []
    })
}))
