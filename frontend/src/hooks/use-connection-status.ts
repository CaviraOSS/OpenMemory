import { useEffect, useState } from 'react'
import { openMemoryClient } from '@/lib/api-client'

export const useConnectionStatus = () => {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking')

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const health = await openMemoryClient.health()
        setStatus(health.ok ? 'connected' : 'disconnected')
      } catch {
        setStatus('disconnected')
      }
    }

    checkConnection()

    // Check every 30 seconds
    const interval = setInterval(checkConnection, 30000)
    return () => clearInterval(interval)
  }, [])

  return {
    status,
    isConnected: status === 'connected',
    isDisconnected: status === 'disconnected',
    isChecking: status === 'checking'
  }
}
