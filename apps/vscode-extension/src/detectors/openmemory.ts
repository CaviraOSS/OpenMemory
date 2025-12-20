export async function detectBackend(url: string): Promise<boolean> {
    try {
        const response = await fetch(`${url}/health`, { method: 'GET', signal: AbortSignal.timeout(2000) });
        return response.ok;
    } catch {
        return false;
    }
}

export async function getBackendInfo(url: string) {
    try {
        const response = await fetch(`${url}/health`);
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}
