import { OpenMemory, SECTORS } from './index'
describe('OpenMemory SDK', () => {
    let client: OpenMemory
    beforeEach(() => {
        client = new OpenMemory({
            baseUrl: 'http://localhost:8080',
            apiKey: 'test-key'
        })
    })
    describe('constructor', () => {
        it('should initialize with default values', () => {
            const defaultClient = new OpenMemory()
            expect(defaultClient).toBeDefined()
        })
        it('should initialize with custom values', () => {
            const customClient = new OpenMemory({
                baseUrl: 'https://api.example.com',
                apiKey: 'custom-key',
                timeout: 30000
            })
            expect(customClient).toBeDefined()
        })
    })
    describe('SECTORS constant', () => {
        it('should have all required sectors', () => {
            expect(SECTORS).toHaveProperty('episodic')
            expect(SECTORS).toHaveProperty('semantic')
            expect(SECTORS).toHaveProperty('procedural')
            expect(SECTORS).toHaveProperty('emotional')
            expect(SECTORS).toHaveProperty('reflective')
        })
        it('should have correct sector properties', () => {
            expect(SECTORS.episodic).toHaveProperty('name', 'episodic')
            expect(SECTORS.episodic).toHaveProperty('decay_lambda', 0.015)
            expect(SECTORS.semantic).toHaveProperty('decay_lambda', 0.005)
            expect(SECTORS.emotional).toHaveProperty('decay_lambda', 0.02)
        })
        it('should have proper sector descriptions', () => {
            expect(SECTORS.episodic.description).toContain('Event memories')
            expect(SECTORS.semantic.description).toContain('Facts')
            expect(SECTORS.procedural.description).toContain('Habits')
            expect(SECTORS.emotional.description).toContain('Sentiment')
            expect(SECTORS.reflective.description).toContain('Meta memory')
        })
    })
    describe('URL construction', () => {
        it('should handle base URL with trailing slash', () => {
            const client1 = new OpenMemory({ baseUrl: 'http://localhost:8080/' })
            const client2 = new OpenMemory({ baseUrl: 'http://localhost:8080' })
            expect(client1).toBeDefined()
            expect(client2).toBeDefined()
        })
    })
})