import { create } from 'zustand'
import type { Memory, QueryResult } from '../lib/schemas'
import { openMemoryClient } from '../lib/api-client'

interface MemoryState {
  memories: Memory[]
  selectedMemory: Memory | null
  queryResults: QueryResult[]
  isLoading: boolean
  error: string | null

  setMemories: (memories: Memory[]) => void
  setSelectedMemory: (memory: Memory | null) => void
  setQueryResults: (results: QueryResult[]) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  addMemory: (memory: Memory) => void
  updateMemory: (id: string, updates: Partial<Memory>) => void
  removeMemory: (id: string) => void
  fetchMemories: () => Promise<void>
}

export const useMemoryStore = create<MemoryState>((set) => ({
  memories: [],
  selectedMemory: null,
  queryResults: [],
  isLoading: false,
  error: null,

  setMemories: (memories) => set({ memories }),
  setSelectedMemory: (memory) => set({ selectedMemory: memory }),
  setQueryResults: (results) => set({ queryResults: results }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  addMemory: (memory) =>
    set((state) => ({ memories: [memory, ...state.memories] })),

  updateMemory: (id, updates) =>
    set((state) => ({
      memories: state.memories.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      )
    })),

  removeMemory: (id) =>
    set((state) => ({
      memories: state.memories.filter((m) => m.id !== id),
      selectedMemory: state.selectedMemory?.id === id ? null : state.selectedMemory
    })),

  fetchMemories: async () => {
    set({ isLoading: true, error: null })
    try {
      const result = await openMemoryClient.getMemories()
      set({ memories: result.items, isLoading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch memories', isLoading: false })
    }
  }
}))
