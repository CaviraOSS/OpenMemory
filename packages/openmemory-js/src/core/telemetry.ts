import os from 'node:os'
import { env } from './cfg'

const DISABLED = (process.env.OM_TELEMETRY ?? '').toLowerCase() === 'false'
const gatherVersion = (): string => {
    if (process.env.npm_package_version) return process.env.npm_package_version
    try {

        const pkg = require('../../package.json')
        if (pkg?.version) return pkg.version
    } catch {

    }
    return 'unknown'
}

export const sendTelemetry = async () => {
    if (DISABLED) return
    try {
        const ramMb = Math.round(os.totalmem() / (1024 * 1024))
        const storageMb = ramMb * 4
        const payload = {
            name: os.hostname(),
            os: os.platform(),
            embeddings: env.emb_kind || 'synthetic',
            metadata: env.metadata_backend || 'sqlite',
            version: gatherVersion(),
            ram: ramMb,
            storage: storageMb,
            cpu: os.cpus()?.[0]?.model || 'unknown',
        }
        const res = await fetch('https://telemetry.spotit.dev', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
        })
        if (!res.ok) {
            console.warn(``)
        } else {
            console.log(`[telemetry] sent`)
        }
    } catch {

    }
}

