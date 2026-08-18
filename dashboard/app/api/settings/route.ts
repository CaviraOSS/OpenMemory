import { NextResponse } from 'next/server'

export async function GET() {
    return NextResponse.json({
        exists: true,
        read_only: true,
        settings: {
            OPENMEMORY_API_URL: process.env.OPENMEMORY_API_URL || 'http://127.0.0.1:7331',
            OPENMEMORY_API_KEY: process.env.OPENMEMORY_API_KEY ? '***' : '',
            NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api/openmemory',
            OPENMEMORY_EMBEDDING_PROVIDER: process.env.OPENMEMORY_EMBEDDING_PROVIDER || process.env.OM_EMBEDDINGS || 'synthetic',
            OPENMEMORY_EMBEDDING_TIER: process.env.OPENMEMORY_EMBEDDING_TIER || process.env.OM_TIER || 'hybrid',
            OPENMEMORY_EMBEDDING_FALLBACK: process.env.OPENMEMORY_EMBEDDING_FALLBACK || process.env.OM_EMBEDDING_FALLBACK || 'synthetic',
            OPENMEMORY_EMBEDDING_DIMENSION: process.env.OPENMEMORY_EMBEDDING_DIMENSION || process.env.OM_VEC_DIM || '256',
            OPENMEMORY_OPENAI_EMBEDDING_MODEL: process.env.OPENMEMORY_OPENAI_EMBEDDING_MODEL || process.env.OM_OPENAI_MODEL || 'text-embedding-3-small',
            OPENMEMORY_GEMINI_EMBEDDING_MODEL: process.env.OPENMEMORY_GEMINI_EMBEDDING_MODEL || process.env.OM_GEMINI_MODEL || 'gemini-embedding-001',
            OPENMEMORY_OLLAMA_EMBEDDING_MODEL: process.env.OPENMEMORY_OLLAMA_EMBEDDING_MODEL || process.env.OM_OLLAMA_MODEL || 'nomic-embed-text',
        },
    })
}

export async function POST() {
    return NextResponse.json({
        error: 'read_only_settings',
        message: 'Configure OPENMEMORY_API_URL and OPENMEMORY_API_KEY in the dashboard deployment environment, then restart the dashboard.',
    }, { status: 405 })
}
