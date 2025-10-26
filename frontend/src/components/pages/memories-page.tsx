import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Trash2, Plus, Search, Edit, Copy, Download, Upload, ArrowUpDown, Zap } from 'lucide-react'
import { useMemoryStore } from '@/stores/memory-store'
import { openMemoryClient } from '@/lib/api-client'
import type { Sector, Memory } from '@/lib/schemas'
import { toast } from 'sonner'
import { PageTransition } from '@/components/animations/page-transitions'

const SECTORS: Sector[] = ['episodic', 'semantic', 'procedural', 'emotional', 'reflective']

type SortField = 'created_at' | 'salience' | 'content'
type SortOrder = 'asc' | 'desc'

export function MemoriesPage() {
  const memories = useMemoryStore((state) => state.memories)
  const setMemories = useMemoryStore((state) => state.setMemories)
  const removeMemory = useMemoryStore((state) => state.removeMemory)

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSector, setSelectedSector] = useState<string>('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [selectedMemories, setSelectedMemories] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [isLoading, setIsLoading] = useState(false)

    const [newMemory, setNewMemory] = useState({
    content: '',
    sector: 'episodic' as Sector,
    tags: '',
    salience: 0.5,
    metadata: '',
    embeddingProvider: 'openai',
    embeddingModel: 'text-embedding-3-small'
  })

  const [metadataError, setMetadataError] = useState<string>('')

  const loadMemories = useCallback(async () => {
    try {
      setIsLoading(true)
      const params = selectedSector === 'all' ? {} : { sector: selectedSector }
      const data = await openMemoryClient.getMemories(params)
      setMemories(data.items)
    } catch (error) {
      toast.error('Failed to load memories')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedSector, setMemories])

  useEffect(() => {
    loadMemories()
  }, [loadMemories])

  // Filter and sort memories
  const filteredAndSortedMemories = useCallback(() => {
    const filtered = memories.filter((memory) => {
      const matchesSearch = memory.content.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesSector = selectedSector === 'all' || memory.primary_sector === selectedSector
      return matchesSearch && matchesSector
    })

    // Sort
    const sorted = [...filtered]
    sorted.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'created_at':
          comparison = a.created_at - b.created_at
          break
        case 'salience':
          comparison = a.salience - b.salience
          break
        case 'content':
          comparison = a.content.localeCompare(b.content)
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [memories, searchTerm, selectedSector, sortField, sortOrder])

  const validateMetadata = (metadataStr: string): boolean => {
    if (!metadataStr.trim()) return true // Empty is ok
    try {
      JSON.parse(metadataStr)
      setMetadataError('')
      return true
    } catch {
      setMetadataError('Invalid JSON format')
      return false
    }
  }

  const handleAddMemory = async () => {
    if (!newMemory.content.trim()) {
      toast.error('Content is required')
      return
    }

    if (!validateMetadata(newMemory.metadata)) {
      return
    }

    try {
      setIsLoading(true)
      const metadata = newMemory.metadata.trim() ? JSON.parse(newMemory.metadata) : undefined
      const tags = newMemory.tags.split(',').map(t => t.trim()).filter(Boolean)

      const result = await openMemoryClient.addMemory({
        content: newMemory.content,
        tags: tags.length > 0 ? tags : undefined,
        metadata,
        embedding_provider: newMemory.embeddingProvider,
        embedding_model: newMemory.embeddingModel
      })

      toast.success(`Memory added successfully (ID: ${result.id}) using ${newMemory.embeddingModel}`)
      setIsAddDialogOpen(false)
      setNewMemory({
        content: '',
        sector: 'episodic',
        tags: '',
        salience: 0.5,
        metadata: '{}',
        embeddingProvider: 'openai',
        embeddingModel: 'text-embedding-3-small'
      })
      setMetadataError('')

      // Reload memories to show the new one
      await loadMemories()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add memory'
      toast.error(errorMessage)
      console.error('Add memory error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditMemory = async () => {
    if (!editingMemory) return

    if (!editingMemory.content.trim()) {
      toast.error('Content is required')
      return
    }

    try {
      setIsLoading(true)

      // Use PATCH endpoint to update memory
      const result = await openMemoryClient.updateMemory(editingMemory.id, {
        content: editingMemory.content,
        tags: editingMemory.tags,
        metadata: editingMemory.metadata
      })

      toast.success(`Memory updated successfully (v${result.version})`)
      setIsEditDialogOpen(false)
      setEditingMemory(null)

      await loadMemories()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update memory'
      toast.error(errorMessage)
      console.error('Update memory error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyMemory = (memory: Memory) => {
    setNewMemory({
      content: memory.content,
      sector: memory.primary_sector,
      tags: memory.tags?.join(', ') || '',
      salience: memory.salience || 0.5,
      metadata: JSON.stringify(memory.metadata || {}, null, 2),
      embeddingProvider: 'openai',
      embeddingModel: 'text-embedding-3-small'
    })
    setIsAddDialogOpen(true)
    toast.info('Memory copied to new form')
  }

  const handleDeleteMemory = async (id: string) => {
    setDeleteTarget(id)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return

    try {
      setIsDeleting(true)
      await openMemoryClient.deleteMemory(deleteTarget)
      removeMemory(deleteTarget)
      toast.success('Memory deleted successfully')
      setDeleteTarget(null)
    } catch (error) {
      toast.error('Failed to delete memory')
      console.error('Delete error:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedMemories.size === 0) {
      toast.error('No memories selected')
      return
    }

    try {
      setIsDeleting(true)
      const deletePromises = Array.from(selectedMemories).map(id =>
        openMemoryClient.deleteMemory(id)
      )

      await Promise.all(deletePromises)

      selectedMemories.forEach(id => removeMemory(id))
      toast.success(`${selectedMemories.size} memories deleted successfully`)
      setSelectedMemories(new Set())
      setIsBulkDeleteOpen(false)
    } catch (error) {
      toast.error('Failed to delete some memories')
      console.error('Bulk delete error:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const toggleSelectMemory = (id: string) => {
    const newSelected = new Set(selectedMemories)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedMemories(newSelected)
  }

  const toggleSelectAll = () => {
    const filtered = filteredAndSortedMemories()
    if (selectedMemories.size === filtered.length) {
      setSelectedMemories(new Set())
    } else {
      setSelectedMemories(new Set(filtered.map(m => m.id)))
    }
  }

  const handleExport = () => {
    const filtered = filteredAndSortedMemories()
    const dataStr = JSON.stringify(filtered, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `memories-export-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filtered.length} memories`)
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string) as Memory[]

        if (!Array.isArray(imported)) {
          toast.error('Invalid import file format')
          return
        }

        setIsLoading(true)
        let successCount = 0

        for (const memory of imported) {
          try {
            await openMemoryClient.addMemory({
              content: memory.content,
              tags: memory.tags,
              metadata: memory.metadata
            })
            successCount++
          } catch (err) {
            console.error('Failed to import memory:', err)
          }
        }

        toast.success(`Imported ${successCount} of ${imported.length} memories`)
        await loadMemories()
      } catch (error) {
        toast.error('Failed to parse import file')
        console.error('Import error:', error)
      } finally {
        setIsLoading(false)
      }
    }
    reader.readAsText(file)
    event.target.value = '' // Reset input
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString()
  }

  const filtered = filteredAndSortedMemories()

  return (
    <PageTransition>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Memories</h1>
          <p className="text-muted-foreground">Manage your memory entries</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Memory
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add New Memory</DialogTitle>
              <DialogDescription>
                Create a new memory entry in the system
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="content">Content *</Label>
                <Textarea
                  id="content"
                  placeholder="Enter memory content..."
                  value={newMemory.content}
                  onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
                  rows={5}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  placeholder="tag1, tag2, tag3"
                  value={newMemory.tags}
                  onChange={(e) => setNewMemory({ ...newMemory, tags: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metadata">Metadata (JSON)</Label>
                <Textarea
                  id="metadata"
                  placeholder='{"key": "value"}'
                  value={newMemory.metadata}
                  onChange={(e) => {
                    setNewMemory({ ...newMemory, metadata: e.target.value })
                    validateMetadata(e.target.value)
                  }}
                  rows={3}
                  className={metadataError ? 'border-red-500' : ''}
                />
                {metadataError && (
                  <p className="text-sm text-red-500">{metadataError}</p>
                )}
              </div>

              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <Label className="text-base font-semibold">Embedding Configuration</Label>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="provider">Provider</Label>
                    <Input
                      id="provider"
                      value={newMemory.embeddingProvider}
                      onChange={(e) => setNewMemory({ ...newMemory, embeddingProvider: e.target.value })}
                      placeholder="e.g., openai, gemini, ollama"
                    />
                    <p className="text-xs text-muted-foreground">
                      The embedding provider to use (openai, gemini, ollama, local, etc.)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="model">Model Name</Label>
                    <Input
                      id="model"
                      value={newMemory.embeddingModel}
                      onChange={(e) => setNewMemory({ ...newMemory, embeddingModel: e.target.value })}
                      placeholder="e.g., text-embedding-3-small, text-embedding-ada-002"
                    />
                    <p className="text-xs text-muted-foreground">
                      The specific embedding model to use for this memory
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleAddMemory} disabled={isLoading || !!metadataError}>
                {isLoading ? 'Creating...' : 'Create Memory'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Search & Filter</CardTitle>
              <CardDescription>Find and manage specific memories</CardDescription>
            </div>
            <div className="flex gap-2">
              <label htmlFor="import-file" className="hidden">Import JSON file</label>
              <input
                type="file"
                id="import-file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
                title="Import memories from JSON file"
              />
              <Button variant="outline" size="sm" onClick={() => document.getElementById('import-file')?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              {selectedMemories.size > 0 && (
                <Button variant="destructive" size="sm" onClick={() => setIsBulkDeleteOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Selected ({selectedMemories.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search memories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedSector} onValueChange={setSelectedSector}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by sector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sectors</SelectItem>
                {SECTORS.map(sector => (
                  <SelectItem key={sector} value={sector} className="capitalize">
                    {sector}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Memories ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading memories...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedMemories.size === filtered.length && filtered.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleSort('content')}
                  >
                    <div className="flex items-center">
                      Content
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleSort('salience')}
                  >
                    <div className="flex items-center">
                      Salience
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleSort('created_at')}
                  >
                    <div className="flex items-center">
                      Created
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </div>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No memories found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((memory) => (
                    <TableRow key={memory.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedMemories.has(memory.id)}
                          onCheckedChange={() => toggleSelectMemory(memory.id)}
                        />
                      </TableCell>
                      <TableCell className="max-w-md truncate">{memory.content}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {memory.primary_sector}
                        </Badge>
                      </TableCell>
                      <TableCell>{memory.salience.toFixed(3)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(memory.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingMemory(memory)
                              setIsEditDialogOpen(true)
                            }}
                            title="Edit memory"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyMemory(memory)}
                            title="Copy memory"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteMemory(memory.id)}
                            title="Delete memory"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Memory</DialogTitle>
            <DialogDescription>
              Modify the memory content (Note: This creates a new memory)
            </DialogDescription>
          </DialogHeader>
          {editingMemory && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-content">Content *</Label>
                <Textarea
                  id="edit-content"
                  placeholder="Enter memory content..."
                  value={editingMemory.content}
                  onChange={(e) => setEditingMemory({ ...editingMemory, content: e.target.value })}
                  rows={5}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
                <Input
                  id="edit-tags"
                  placeholder="tag1, tag2, tag3"
                  value={editingMemory.tags?.join(', ') || ''}
                  onChange={(e) => setEditingMemory({
                    ...editingMemory,
                    tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>Sector</Label>
                <Badge variant="outline" className="capitalize">
                  {editingMemory.primary_sector}
                </Badge>
                <p className="text-xs text-muted-foreground">Sector will be auto-detected</p>
              </div>
              <div className="space-y-2">
                <Label>Salience</Label>
                <p className="text-sm">{editingMemory.salience.toFixed(3)}</p>
                <p className="text-xs text-muted-foreground">Will be recalculated</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={handleEditMemory} disabled={isLoading}>
              {isLoading ? 'Updating...' : 'Update Memory'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the memory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedMemories.size} memories?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all selected memories.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </PageTransition>
  )
}
