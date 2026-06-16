import { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BACKEND = (process.env.OPENMEMORY_API_URL || 'http://127.0.0.1:9432').replace(/\/+$/, '')
const API_KEY = process.env.OPENMEMORY_API_KEY || process.env.OM_API_KEY || ''

async function proxy(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
    const { path = [] } = await ctx.params
    const target = new URL(`${BACKEND}/${path.map(encodeURIComponent).join('/')}`)
    req.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value))

    const headers = new Headers()
    const accept = req.headers.get('accept')
    const contentType = req.headers.get('content-type')
    if (accept) headers.set('accept', accept)
    if (contentType) headers.set('content-type', contentType)
    if (API_KEY) headers.set('x-api-key', API_KEY)

    const init: RequestInit = {
        method: req.method,
        headers,
        redirect: 'manual',
        cache: 'no-store',
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
        init.body = await req.arrayBuffer()
    }

    const res = await fetch(target, init)
    const outHeaders = new Headers(res.headers)
    outHeaders.delete('content-encoding')
    outHeaders.delete('content-length')
    outHeaders.delete('transfer-encoding')
    outHeaders.set('cache-control', 'no-store')
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: outHeaders })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
export const OPTIONS = proxy
