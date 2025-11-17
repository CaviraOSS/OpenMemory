import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const ENV_PATH = path.resolve(process.cwd(), '../.env')

function parseEnvFile(content: string): Record<string, string> {
    const result: Record<string, string> = {}
    const lines = content.split('\n')

    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue

        const equalIndex = trimmed.indexOf('=')
        if (equalIndex === -1) continue

        const key = trimmed.substring(0, equalIndex).trim()
        const value = trimmed.substring(equalIndex + 1).trim()
        result[key] = value
    }

    return result
}

function serializeEnvFile(updates: Record<string, string>): string {
    const lines: string[] = []

    for (const [key, value] of Object.entries(updates)) {
        lines.push(`${key}=${value}`)
    }

    return lines.join('\n')
}

export async function GET() {
    try {
        if (!fs.existsSync(ENV_PATH)) {
            return NextResponse.json({
                exists: false,
                settings: {}
            })
        }

        const content = fs.readFileSync(ENV_PATH, 'utf-8')
        const settings = parseEnvFile(content)

        const masked = { ...settings }
        if (masked.OPENAI_API_KEY) masked.OPENAI_API_KEY = '***'
        if (masked.GEMINI_API_KEY) masked.GEMINI_API_KEY = '***'
        if (masked.AWS_SECRET_ACCESS_KEY) masked.AWS_SECRET_ACCESS_KEY = "***"
        if (masked.OM_API_KEY) masked.OM_API_KEY = '***'

        return NextResponse.json({
            exists: true,
            settings: masked
        })
    } catch (e: any) {
        console.error('[Settings API] read error:', e)
        return NextResponse.json(
            { error: 'internal', message: e.message },
            { status: 500 }
        )
    }
}

export async function POST(request: Request) {
    try {
        const updates = await request.json()

        if (!updates || typeof updates !== 'object') {
            return NextResponse.json(
                { error: 'invalid_body' },
                { status: 400 }
            )
        }

        let content = ''
        let envExists = false

        if (fs.existsSync(ENV_PATH)) {
            content = fs.readFileSync(ENV_PATH, 'utf-8')
            envExists = true
        } else {
            const examplePath = path.resolve(process.cwd(), '../.env.example')
            if (fs.existsSync(examplePath)) {
                content = fs.readFileSync(examplePath, 'utf-8')
            }
        }

        const existing = content ? parseEnvFile(content) : {}
        const merged = { ...existing, ...updates }
        const newContent = serializeEnvFile(merged)

        fs.writeFileSync(ENV_PATH, newContent, 'utf-8')

        return NextResponse.json({
            ok: true,
            created: !envExists,
            message: 'Settings saved. Restart the backend to apply changes.'
        })
    } catch (e: any) {
        console.error('[Settings API] write error:', e)
        return NextResponse.json(
            { error: 'internal', message: e.message },
            { status: 500 }
        )
    }
}
