// Health check endpoint for Docker healthcheck
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Basic health check - just return OK if the app is running
    return NextResponse.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      service: 'openmemory-dashboard'
    })
  } catch (error) {
    return NextResponse.json(
      { status: 'error', error: 'Dashboard unhealthy' },
      { status: 500 }
    )
  }
}