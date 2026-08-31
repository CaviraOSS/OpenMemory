/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : dashboard/app/api/settings/route.ts
 *  usage : supports the LongMemory dashboard route
 */


import { NextResponse } from 'next/server'

export async function GET() {
    return NextResponse.json({
        exists: true,
        read_only: true,
        settings: {
            LONGMEMORY_API_URL: process.env.LONGMEMORY_API_URL || 'http://127.0.0.1:7331',
            LONGMEMORY_API_KEY: process.env.LONGMEMORY_API_KEY ? '***' : '',
            NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api/longmemory',
            LONGMEMORY_EMBEDDING_PROVIDER: process.env.LONGMEMORY_EMBEDDING_PROVIDER || process.env.OM_EMBEDDINGS || 'synthetic',
            LONGMEMORY_EMBEDDING_TIER: process.env.LONGMEMORY_EMBEDDING_TIER || process.env.OM_TIER || 'hybrid',
            LONGMEMORY_EMBEDDING_FALLBACK: process.env.LONGMEMORY_EMBEDDING_FALLBACK || process.env.OM_EMBEDDING_FALLBACK || 'synthetic',
            LONGMEMORY_EMBEDDING_DIMENSION: process.env.LONGMEMORY_EMBEDDING_DIMENSION || process.env.OM_VEC_DIM || '256',
            LONGMEMORY_OPENAI_EMBEDDING_MODEL: process.env.LONGMEMORY_OPENAI_EMBEDDING_MODEL || process.env.OM_OPENAI_MODEL || 'text-embedding-3-small',
            LONGMEMORY_GEMINI_EMBEDDING_MODEL: process.env.LONGMEMORY_GEMINI_EMBEDDING_MODEL || process.env.OM_GEMINI_MODEL || 'gemini-embedding-001',
            LONGMEMORY_OLLAMA_EMBEDDING_MODEL: process.env.LONGMEMORY_OLLAMA_EMBEDDING_MODEL || process.env.OM_OLLAMA_MODEL || 'nomic-embed-text',
        },
    })
}

export async function POST() {
    return NextResponse.json({
        error: 'read_only_settings',
        message: 'Configure LONGMEMORY_API_URL and LONGMEMORY_API_KEY in the dashboard deployment environment, then restart the dashboard.',
    }, { status: 405 })
}
