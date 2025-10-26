import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Upload, FileText, CheckCircle2, XCircle } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useMemoryStore } from '@/stores/memory-store'
import { toast } from 'sonner'
import type { Sector } from '@/lib/schemas'
import { PageTransition } from '@/components/animations/page-transitions'

interface IngestionJob {
  id: string
  filename: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  sector: Sector
  error?: string
}

export function IngestPage() {
  const { fetchMemories } = useMemoryStore()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [sector, setSector] = useState<Sector>('episodic')
  const [jobs, setJobs] = useState<IngestionJob[]>([])
  const [isIngesting, setIsIngesting] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/html', 'text/plain']
      if (!validTypes.includes(file.type)) {
        toast.error('Invalid file type. Please upload PDF, DOCX, HTML, or TXT files.')
        return
      }
      setSelectedFile(file)
    }
  }

  const handleIngest = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first')
      return
    }

    const jobId = `job-${Date.now()}`
    const newJob: IngestionJob = {
      id: jobId,
      filename: selectedFile.name,
      status: 'pending',
      progress: 0,
      sector
    }

    setJobs(prev => [...prev, newJob])
    setIsIngesting(true)

    try {
      updateJob(jobId, { status: 'processing', progress: 30 })

      await apiClient.ingestFile(selectedFile, { sector })

      updateJob(jobId, { status: 'processing', progress: 70 })

      await fetchMemories()

      updateJob(jobId, { status: 'completed', progress: 100 })

      toast.success(`Successfully ingested ${selectedFile.name}`)
      setSelectedFile(null)

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      if (fileInput) fileInput.value = ''

    } catch (error) {
      updateJob(jobId, {
        status: 'failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      toast.error('Failed to ingest file')
    } finally {
      setIsIngesting(false)
    }
  }

  const updateJob = (jobId: string, updates: Partial<IngestionJob>) => {
    setJobs(prev => prev.map(job =>
      job.id === jobId ? { ...job, ...updates } : job
    ))
  }

  const clearCompleted = () => {
    setJobs(prev => prev.filter(job => job.status !== 'completed'))
  }

  const getStatusIcon = (status: IngestionJob['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <FileText className="h-5 w-5 text-blue-500" />
    }
  }

  return (
    <PageTransition>
      <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">File Ingestion</h2>
        <p className="text-muted-foreground">
          Upload and process documents into memories
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Document</CardTitle>
          <CardDescription>
            Supported formats: PDF, DOCX, HTML, TXT
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">Select File</Label>
            <div className="flex items-center gap-4">
              <Input
                id="file-upload"
                type="file"
                accept=".pdf,.docx,.html,.txt"
                onChange={handleFileSelect}
                disabled={isIngesting}
              />
              {selectedFile && (
                <Badge variant="outline">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sector-select">Target Sector</Label>
            <Select value={sector} onValueChange={(v) => setSector(v as Sector)}>
              <SelectTrigger id="sector-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="episodic">Episodic</SelectItem>
                <SelectItem value="semantic">Semantic</SelectItem>
                <SelectItem value="procedural">Procedural</SelectItem>
                <SelectItem value="emotional">Emotional</SelectItem>
                <SelectItem value="reflective">Reflective</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleIngest}
            disabled={!selectedFile || isIngesting}
            className="w-full"
          >
            <Upload className="mr-2 h-4 w-4" />
            {isIngesting ? 'Ingesting...' : 'Ingest File'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Ingestion History</CardTitle>
              <CardDescription>Track your file processing jobs</CardDescription>
            </div>
            {jobs.some(j => j.status === 'completed') && (
              <Button variant="outline" size="sm" onClick={clearCompleted}>
                Clear Completed
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {jobs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No ingestion jobs yet
              </p>
            )}

            {jobs.slice().reverse().map(job => (
              <div key={job.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <p className="font-medium">{job.filename}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="capitalize text-xs">
                          {job.sector}
                        </Badge>
                        <span className="text-xs text-muted-foreground capitalize">
                          {job.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {job.status === 'processing' && (
                  <div className="space-y-1">
                    <Progress value={job.progress} />
                    <p className="text-xs text-muted-foreground">
                      Processing... {job.progress}%
                    </p>
                  </div>
                )}

                {job.status === 'failed' && job.error && (
                  <p className="text-xs text-red-500">{job.error}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
    </PageTransition>
  )
}
