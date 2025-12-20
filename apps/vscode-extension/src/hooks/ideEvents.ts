import * as crypto from 'crypto';

const recentHashes = new Set<string>();
const HASH_CACHE_SIZE = 1000;
const microVectorCache = new Map<string, { vector: number[], timestamp: number, score: number }>();
const CACHE_MAX_SIZE = 32;

export function generateEventHash(filePath: string, eventType: string, content: string): string {
    const snippet = content.slice(0, 128);
    return crypto.createHash('sha1').update(`${filePath}${eventType}${snippet}`).digest('hex');
}

export function shouldSkipEvent(filePath: string, eventType: string, content: string): boolean {
    const hash = generateEventHash(filePath, eventType, content);

    if (recentHashes.has(hash)) {
        return true;
    }

    recentHashes.add(hash);
    if (recentHashes.size > HASH_CACHE_SIZE) {
        const first = recentHashes.values().next().value;
        if (first) recentHashes.delete(first);
    }

    return false;
}

export function getSectorFilter(eventType: string): string[] {
    switch (eventType) {
        case 'edit':
        case 'save':
            return ['procedural', 'semantic'];
        case 'comment':
            return ['reflective', 'emotional'];
        case 'refactor':
            return ['procedural', 'reflective'];
        case 'debug':
        case 'error':
            return ['emotional', 'procedural'];
        default:
            return ['episodic', 'semantic'];
    }
}

export function updateMicroCache(query: string, vector: number[], score: number) {
    const key = crypto.createHash('md5').update(query).digest('hex');
    microVectorCache.set(key, { vector, timestamp: Date.now(), score });

    if (microVectorCache.size > CACHE_MAX_SIZE) {
        let oldestKey = '';
        let oldestTime = Infinity;
        for (const [k, v] of microVectorCache.entries()) {
            if (v.timestamp < oldestTime) {
                oldestTime = v.timestamp;
                oldestKey = k;
            }
        }
        if (oldestKey) microVectorCache.delete(oldestKey);
    }
}

export function checkMicroCache(query: string, lambda = 0.7, tau = 3600000): { vector: number[], score: number } | null {
    const key = crypto.createHash('md5').update(query).digest('hex');
    const cached = microVectorCache.get(key);

    if (!cached) return null;

    const deltaT = Date.now() - cached.timestamp;
    const cacheScore = lambda * cached.score + (1 - lambda) * Math.exp(-deltaT / tau);

    if (cacheScore > 0.85) {
        return { vector: cached.vector, score: cacheScore };
    }

    return null;
}
