export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/openmemory'

export const getHeaders = (): { 'Content-Type': string } => {
    return {
        'Content-Type': 'application/json',
    }
}
