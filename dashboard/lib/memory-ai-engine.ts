interface MemoryReference {
    id: string
    sector: "semantic" | "episodic" | "procedural" | "emotional" | "reflective"
    content: string
    salience: number
    title: string
    last_seen_at?: number
    score?: number
}

interface QueryContext {
    query: string
    queryType: string
    intent: string
    keywords: string[]
    entities: string[]
    complexity: 'simple' | 'moderate' | 'complex'
    temporalContext?: {
        hasTimeReference: boolean
        timeExpressions: string[]
        temporalScope: 'past' | 'present' | 'future' | 'general'
    }
    sentiment?: {
        polarity: 'positive' | 'negative' | 'neutral'
        intensity: number
    }
}

interface MemoryCluster {
    id: string
    centroid: string
    members: MemoryReference[]
    coherence: number
    sector: string
    keywords: string[]
    semanticDensity: number
    importance: number
}

interface AnswerSegment {
    type: 'direct' | 'context' | 'elaboration' | 'reflection' | 'synthesis' | 'transition'
    content: string
    sources: string[]
    confidence: number
    relevance: number
    coherenceScore: number
}

interface GeneratedAnswer {
    segments: AnswerSegment[]
    finalText: string
    confidence: number
    memoryCount: number
    sectorBreakdown: Record<string, number>
    citations: Array<{ id: string; snippet: string; sector: string }>
    reasoning?: string
    alternatives?: string[]
    qualityMetrics: {
        coherence: number
        completeness: number
        relevance: number
        diversity: number
    }
}

interface TextSpan {
    text: string
    start: number
    end: number
    type: 'sentence' | 'phrase' | 'clause'
}

interface SemanticGraph {
    nodes: Map<string, SemanticNode>
    edges: SemanticEdge[]
}

interface SemanticNode {
    id: string
    text: string
    importance: number
    keywords: string[]
    linkedMemories: string[]
}

interface SemanticEdge {
    source: string
    target: string
    weight: number
    type: 'causal' | 'temporal' | 'associative' | 'contrasting'
}

interface ContextWindow {
    memories: MemoryReference[]
    totalTokens: number
    priorityScores: Map<string, number>
    temporalRelevance: Map<string, number>
}

type StopWord = string

const STOP_WORDS: StopWord[] = [
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'will', 'with', 'i', 'you', 'me', 'my', 'we', 'our',
    'this', 'these', 'those', 'can', 'do', 'have', 'had', 'been', 'being',
    'but', 'or', 'if', 'than', 'because', 'while', 'where', 'after', 'so',
    'though', 'since', 'until', 'whether', 'before', 'although', 'nor',
    'like', 'once', 'unless', 'now', 'except', 'also', 'into', 'over',
    'such', 'then', 'them', 'same', 'only', 'may', 'must', 'shall'
]

const TEMPORAL_EXPRESSIONS = [
    'yesterday', 'today', 'tomorrow', 'last week', 'next week', 'last month',
    'next month', 'last year', 'next year', 'ago', 'later', 'soon', 'recently',
    'earlier', 'before', 'after', 'during', 'while', 'when', 'now', 'currently',
    'previously', 'formerly', 'future', 'past', 'present', 'meanwhile'
]

const SENTIMENT_POSITIVE = [
    'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love',
    'happy', 'joy', 'pleased', 'satisfied', 'excited', 'delighted', 'brilliant',
    'perfect', 'best', 'awesome', 'terrific', 'superb', 'outstanding'
]

const SENTIMENT_NEGATIVE = [
    'bad', 'terrible', 'awful', 'horrible', 'poor', 'worst', 'hate', 'sad',
    'angry', 'frustrated', 'disappointed', 'upset', 'annoyed', 'irritated',
    'concerned', 'worried', 'anxious', 'stressed', 'unhappy', 'displeased'
]

const DISCOURSE_MARKERS = {
    causal: ['because', 'therefore', 'thus', 'hence', 'consequently', 'as a result', 'due to'],
    temporal: ['then', 'next', 'after', 'before', 'while', 'during', 'meanwhile', 'subsequently'],
    additive: ['also', 'furthermore', 'moreover', 'additionally', 'besides', 'in addition'],
    contrastive: ['but', 'however', 'although', 'despite', 'yet', 'nevertheless', 'on the other hand'],
    exemplification: ['for example', 'for instance', 'such as', 'like', 'specifically', 'particularly']
}

const COMPLEXITY_INDICATORS = {
    simple: ['what', 'who', 'when', 'where', 'yes', 'no'],
    moderate: ['how', 'why', 'explain', 'describe', 'compare'],
    complex: ['analyze', 'evaluate', 'synthesize', 'critique', 'justify', 'hypothesize']
}

const QUESTION_STARTERS = [
    'what', 'how', 'why', 'when', 'where', 'who', 'which', 'whose',
    'can', 'could', 'should', 'would', 'is', 'are', 'do', 'does', 'did'
]

const INTENT_PATTERNS: Record<string, RegExp> = {
    procedural: /how\s+(do|to|can)|steps|process|procedure|guide|tutorial|instructions|method|way to/i,
    episodic: /remember|recall|when did|last time|previous|earlier|before|history|experience|happened/i,
    emotional: /feel|feeling|emotion|mood|sentiment|happy|sad|anxious|stressed|excited|worried/i,
    reflective: /why|reason|insight|analysis|summary|reflect|think|believe|opinion|lesson|learning/i,
    factual: /what is|define|explain|describe|tell me about|information on|details|fact/i,
    comparative: /compare|difference|better|worse|versus|vs|which one|best|prefer/i,
    actionable: /recommend|suggest|advise|should i|what to|help me|looking for/i
}

const SECTOR_AFFINITIES: Record<string, string[]> = {
    semantic: ['factual', 'comparative', 'actionable'],
    episodic: ['episodic', 'emotional'],
    procedural: ['procedural', 'actionable'],
    emotional: ['emotional', 'reflective'],
    reflective: ['reflective', 'comparative']
}

/**
 * Advanced text processing utilities with NLP capabilities
 */
class TextProcessor {
    /**
     * Tokenize text with stop word filtering
     */
    static tokenize(text: string): string[] {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 2 && !STOP_WORDS.includes(t))
    }

    /**
     * Tokenize text while preserving position information
     */
    static tokenizeWithPosition(text: string): Array<{ token: string; position: number }> {
        const normalized = text.toLowerCase()
        const tokens: Array<{ token: string; position: number }> = []
        let currentPos = 0

        for (const word of normalized.split(/\s+/)) {
            const cleaned = word.replace(/[^\w]/g, '')
            if (cleaned.length > 2 && !STOP_WORDS.includes(cleaned)) {
                tokens.push({ token: cleaned, position: currentPos })
            }
            currentPos++
        }
        return tokens
    }

    /**
     * Extract n-grams from text
     */
    static extractNgrams(text: string, n: number = 2): string[] {
        const tokens = this.tokenize(text)
        if (tokens.length < n) return []

        const ngrams: string[] = []
        for (let i = 0; i <= tokens.length - n; i++) {
            ngrams.push(tokens.slice(i, i + n).join(' '))
        }
        return ngrams
    }

    /**
     * Extract keywords with frequency-based scoring including n-grams
     */
    static extractKeywords(text: string, topN: number = 10): string[] {
        const tokens = this.tokenize(text)
        const bigrams = this.extractNgrams(text, 2)
        const trigrams = this.extractNgrams(text, 3)

        const freq: Record<string, number> = {}

        for (const t of tokens) {
            freq[t] = (freq[t] || 0) + 1.0
        }

        for (const bg of bigrams) {
            freq[bg] = (freq[bg] || 0) + 1.5
        }

        for (const tg of trigrams) {
            freq[tg] = (freq[tg] || 0) + 2.0
        }

        return Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, topN)
            .map(([word]) => word)
    }

    /**
     * Extract meaningful key phrases from text
     */
    static extractKeyPhrases(text: string, topN: number = 5): string[] {
        const sentences = this.sentenceSplit(text)
        const phrases: Map<string, number> = new Map()

        for (const sentence of sentences) {
            const bigrams = this.extractNgrams(sentence, 2)
            const trigrams = this.extractNgrams(sentence, 3)

            for (const phrase of [...bigrams, ...trigrams]) {
                const tokens = phrase.split(' ')
                const hasCapital = /[A-Z]/.test(text.substring(
                    Math.max(0, text.toLowerCase().indexOf(phrase) - 1),
                    text.toLowerCase().indexOf(phrase) + phrase.length + 1
                ))

                const score = tokens.length * (hasCapital ? 1.5 : 1.0)
                phrases.set(phrase, (phrases.get(phrase) || 0) + score)
            }
        }

        return Array.from(phrases.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, topN)
            .map(([phrase]) => phrase)
    }

    /**
     * Extract named entities and important terms
     */
    static extractEntities(text: string): string[] {
        const capitalized = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []
        const quoted = text.match(/"([^"]+)"/g)?.map(q => q.replace(/"/g, '')) || []
        const patterns = [
            /\b[A-Z]{2,}\b/g,
            /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
            /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/g,
        ]

        const entities = [...capitalized, ...quoted]
        for (const pattern of patterns) {
            const matches = text.match(pattern) || []
            entities.push(...matches)
        }

        return [...new Set(entities)]
    }

    /**
     * Compute TF-IDF vectors for a collection of documents
     */
    static computeTfIdf(docs: string[]): Map<string, number[]> {
        const allTokens = docs.map(d => this.tokenize(d))
        const vocab = new Set(allTokens.flat())
        const docCount = docs.length

        const idf: Map<string, number> = new Map()
        for (const term of vocab) {
            const df = allTokens.filter(tokens => tokens.includes(term)).length
            idf.set(term, Math.log((docCount + 1) / (df + 1)))
        }

        const tfidfVectors: Map<string, number[]> = new Map()
        for (let i = 0; i < docs.length; i++) {
            const tokens = allTokens[i]
            const tf: Map<string, number> = new Map()
            for (const t of tokens) {
                tf.set(t, (tf.get(t) || 0) + 1)
            }
            const vector: number[] = []
            for (const term of vocab) {
                const tfVal = tf.get(term) || 0
                const idfVal = idf.get(term) || 0
                vector.push(tfVal * idfVal)
            }
            tfidfVectors.set(docs[i], vector)
        }
        return tfidfVectors
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    static cosineSimilarity(a: number[], b: number[]): number {
        if (!a || !b || a.length !== b.length) return 0
        let dot = 0, magA = 0, magB = 0
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i]
            magA += a[i] * a[i]
            magB += b[i] * b[i]
        }
        const denom = Math.sqrt(magA) * Math.sqrt(magB)
        return denom === 0 ? 0 : dot / denom
    }

    /**
     * Calculate Jaccard similarity between two token sets
     */
    static jaccardSimilarity(a: string[], b: string[]): number {
        const setA = new Set(a)
        const setB = new Set(b)
        const intersection = new Set([...setA].filter(x => setB.has(x)))
        const union = new Set([...setA, ...setB])
        return union.size === 0 ? 0 : intersection.size / union.size
    }

    /**
     * Split text into sentences
     */
    static sentenceSplit(text: string): string[] {
        return text
            .split(/(?<=[.!?])\s+/)
            .map(s => s.trim())
            .filter(s => s.length > 10)
    }

    /**
     * Extract the most informative sentences using keyword density
     */
    static extractMostInformativeSentences(text: string, count: number = 3): string[] {
        const sentences = this.sentenceSplit(text)
        if (sentences.length <= count) return sentences

        const queryTokens = new Set(this.tokenize(text))
        const scored = sentences.map(s => {
            const tokens = this.tokenize(s)
            const uniqueTerms = new Set(tokens).size
            const queryOverlap = tokens.filter(t => queryTokens.has(t)).length
            const lengthPenalty = Math.min(1, tokens.length / 15)
            return {
                sentence: s,
                score: (uniqueTerms * 0.4 + queryOverlap * 0.6) * lengthPenalty
            }
        })

        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, count)
            .map(s => s.sentence)
    }

    /**
     * Calculate semantic density of text (unique meaningful terms per token)
     */
    static calculateSemanticDensity(text: string): number {
        const tokens = this.tokenize(text)
        if (tokens.length === 0) return 0

        const uniqueTokens = new Set(tokens)
        const entities = this.extractEntities(text)
        const keyPhrases = this.extractKeyPhrases(text, 3)

        const densityScore = (uniqueTokens.size / tokens.length) *
            (1 + entities.length * 0.1) *
            (1 + keyPhrases.length * 0.05)

        return Math.min(1.0, densityScore)
    }

    /**
     * Detect discourse markers and their types in text
     */
    static detectDiscourseMarkers(text: string): Map<string, string[]> {
        const lower = text.toLowerCase()
        const detected = new Map<string, string[]>()

        for (const [type, markers] of Object.entries(DISCOURSE_MARKERS)) {
            const found: string[] = []
            for (const marker of markers) {
                if (lower.includes(marker)) {
                    found.push(marker)
                }
            }
            if (found.length > 0) {
                detected.set(type, found)
            }
        }

        return detected
    }

    /**
     * Calculate lexical diversity (type-token ratio)
     */
    static calculateLexicalDiversity(text: string): number {
        const tokens = this.tokenize(text)
        if (tokens.length === 0) return 0

        const uniqueTokens = new Set(tokens)
        return uniqueTokens.size / tokens.length
    }

    /**
     * Extract text spans (sentences with metadata)
     */
    static extractTextSpans(text: string): TextSpan[] {
        const sentences = this.sentenceSplit(text)
        const spans: TextSpan[] = []
        let currentPos = 0

        for (const sentence of sentences) {
            const start = text.indexOf(sentence, currentPos)
            const end = start + sentence.length

            spans.push({
                text: sentence,
                start,
                end,
                type: 'sentence'
            })

            currentPos = end
        }

        return spans
    }

    /**
     * Compute BM25 relevance score for a query against a document
     */
    static computeBM25(query: string, document: string, k1: number = 1.5, b: number = 0.75, avgDocLength: number = 100): number {
        const queryTokens = this.tokenize(query)
        const docTokens = this.tokenize(document)
        const docLength = docTokens.length

        if (docLength === 0) return 0

        const tokenFreq: Map<string, number> = new Map()
        for (const token of docTokens) {
            tokenFreq.set(token, (tokenFreq.get(token) || 0) + 1)
        }

        let score = 0
        for (const qToken of queryTokens) {
            const tf = tokenFreq.get(qToken) || 0
            if (tf === 0) continue

            const idf = Math.log(1 + (1 / (tf + 1)))
            const numerator = tf * (k1 + 1)
            const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength))

            score += idf * (numerator / denominator)
        }

        return score
    }
}

/**
 * Advanced query analysis with intent detection and context extraction
 */
class QueryAnalyzer {
    /**
     * Analyze query and extract comprehensive context
     */
    static analyze(query: string): QueryContext {
        const tokens = TextProcessor.tokenize(query)
        const keywords = TextProcessor.extractKeywords(query, 8)
        const entities = TextProcessor.extractEntities(query)

        const queryLower = query.toLowerCase().trim()
        const isQuestion = queryLower.includes('?') ||
            QUESTION_STARTERS.some(starter => queryLower.startsWith(starter))

        let intent = 'factual'
        let maxScore = 0
        for (const [intentType, pattern] of Object.entries(INTENT_PATTERNS)) {
            if (pattern.test(query)) {
                const match = query.match(pattern)
                const score = match ? match[0].length : 0
                if (score > maxScore) {
                    maxScore = score
                    intent = intentType
                }
            }
        }

        const queryType = isQuestion ? 'interrogative' : 'declarative'

        const complexity = this.detectComplexity(query)
        const temporalContext = this.analyzeTemporalContext(query)
        const sentiment = this.analyzeSentiment(query)

        return {
            query,
            queryType,
            intent,
            keywords,
            entities,
            complexity,
            temporalContext,
            sentiment
        }
    }

    /**
     * Detect query complexity level
     */
    static detectComplexity(query: string): 'simple' | 'moderate' | 'complex' {
        const lower = query.toLowerCase()

        for (const indicator of COMPLEXITY_INDICATORS.complex) {
            if (lower.includes(indicator)) return 'complex'
        }

        for (const indicator of COMPLEXITY_INDICATORS.moderate) {
            if (lower.includes(indicator)) return 'moderate'
        }

        return 'simple'
    }

    /**
     * Analyze temporal context in query
     */
    static analyzeTemporalContext(query: string) {
        const lower = query.toLowerCase()
        const timeExpressions: string[] = []

        for (const expr of TEMPORAL_EXPRESSIONS) {
            if (lower.includes(expr)) {
                timeExpressions.push(expr)
            }
        }

        let temporalScope: 'past' | 'present' | 'future' | 'general' = 'general'

        if (timeExpressions.some(e => ['yesterday', 'last', 'ago', 'earlier', 'before', 'previously', 'past'].includes(e))) {
            temporalScope = 'past'
        } else if (timeExpressions.some(e => ['tomorrow', 'next', 'later', 'soon', 'future'].includes(e))) {
            temporalScope = 'future'
        } else if (timeExpressions.some(e => ['today', 'now', 'currently', 'present'].includes(e))) {
            temporalScope = 'present'
        }

        return {
            hasTimeReference: timeExpressions.length > 0,
            timeExpressions,
            temporalScope
        }
    }

    /**
     * Analyze sentiment in query
     */
    static analyzeSentiment(query: string): { polarity: 'positive' | 'negative' | 'neutral'; intensity: number } {
        const tokens = TextProcessor.tokenize(query)

        let positiveCount = 0
        let negativeCount = 0

        for (const token of tokens) {
            if (SENTIMENT_POSITIVE.includes(token)) positiveCount++
            if (SENTIMENT_NEGATIVE.includes(token)) negativeCount++
        }

        const totalSentiment = positiveCount + negativeCount

        if (totalSentiment === 0) {
            return { polarity: 'neutral', intensity: 0 }
        }

        const polarity = positiveCount > negativeCount ? 'positive' :
            negativeCount > positiveCount ? 'negative' : 'neutral'

        const intensity = Math.min(1.0, totalSentiment / tokens.length * 10)

        return { polarity, intensity }
    }

    /**
     * Compute relevance score for a memory against query context
     */
    static computeRelevanceScore(
        memory: MemoryReference,
        context: QueryContext
    ): number {
        const memTokens = TextProcessor.tokenize(memory.content)
        const queryTokens = TextProcessor.tokenize(context.query)

        const keywordOverlap = context.keywords.filter(kw =>
            memTokens.includes(kw)
        ).length / Math.max(1, context.keywords.length)

        const entityOverlap = context.entities.filter(ent =>
            memory.content.toLowerCase().includes(ent.toLowerCase())
        ).length / Math.max(1, context.entities.length)

        const jaccard = TextProcessor.jaccardSimilarity(memTokens, queryTokens)

        const sectorAffinity = SECTOR_AFFINITIES[memory.sector]?.includes(context.intent) ? 1.2 : 1.0

        const baseScore = memory.score || memory.salience || 0.5

        const bm25Score = TextProcessor.computeBM25(context.query, memory.content) / 10

        return (
            baseScore * 0.25 +
            keywordOverlap * 0.20 +
            entityOverlap * 0.15 +
            jaccard * 0.15 +
            bm25Score * 0.15 +
            (sectorAffinity - 1.0) * 0.10
        )
    }

    /**
     * Compute temporal relevance score based on time context
     */
    static computeTemporalRelevance(
        memory: MemoryReference,
        context: QueryContext
    ): number {
        if (!context.temporalContext?.hasTimeReference || !memory.last_seen_at) {
            return 1.0
        }

        const now = Date.now()
        const age = now - memory.last_seen_at
        const dayMs = 24 * 60 * 60 * 1000

        const scope = context.temporalContext.temporalScope

        if (scope === 'past') {
            return Math.max(0.3, 1 - (age / (30 * dayMs)))
        } else if (scope === 'present') {
            return age < (7 * dayMs) ? 1.0 : Math.max(0.5, 1 - (age / (30 * dayMs)))
        } else if (scope === 'future') {
            return 0.7
        }

        return 1.0
    }
}

/**
 * Context window manager with attention mechanism
 */
class ContextWindowManager {
    private static readonly MAX_CONTEXT_TOKENS = 8000
    private static readonly ATTENTION_DECAY = 0.95

    /**
     * Build optimized context window from memories
     */
    static buildContextWindow(
        memories: MemoryReference[],
        context: QueryContext
    ): ContextWindow {
        const priorityScores = new Map<string, number>()
        const temporalRelevance = new Map<string, number>()

        for (const memory of memories) {
            const relevance = QueryAnalyzer.computeRelevanceScore(memory, context)
            const temporal = QueryAnalyzer.computeTemporalRelevance(memory, context)

            const priority = relevance * 0.7 + temporal * 0.3

            priorityScores.set(memory.id, priority)
            temporalRelevance.set(memory.id, temporal)
        }

        const sortedMemories = [...memories].sort((a, b) =>
            (priorityScores.get(b.id) || 0) - (priorityScores.get(a.id) || 0)
        )

        let totalTokens = 0
        const selectedMemories: MemoryReference[] = []

        for (const memory of sortedMemories) {
            const tokens = TextProcessor.tokenize(memory.content).length

            if (totalTokens + tokens <= this.MAX_CONTEXT_TOKENS) {
                selectedMemories.push(memory)
                totalTokens += tokens
            } else {
                break
            }
        }

        return {
            memories: selectedMemories,
            totalTokens,
            priorityScores,
            temporalRelevance
        }
    }

    /**
     * Apply attention mechanism to weight memories
     */
    static applyAttentionMechanism(
        window: ContextWindow,
        query: string
    ): Map<string, number> {
        const queryEmbedding = TextProcessor.tokenize(query)
        const attentionScores = new Map<string, number>()

        for (let i = 0; i < window.memories.length; i++) {
            const memory = window.memories[i]
            const memoryEmbedding = TextProcessor.tokenize(memory.content)

            const similarity = TextProcessor.jaccardSimilarity(queryEmbedding, memoryEmbedding)
            const positionDecay = Math.pow(this.ATTENTION_DECAY, i)
            const priority = window.priorityScores.get(memory.id) || 0.5

            const attentionScore = similarity * positionDecay * priority

            attentionScores.set(memory.id, attentionScore)
        }

        return attentionScores
    }
}

/**
 * Semantic graph builder for relationship mapping
 */
class SemanticGraphBuilder {
    /**
     * Build semantic graph from memories
     */
    static buildGraph(memories: MemoryReference[]): SemanticGraph {
        const nodes = new Map<string, SemanticNode>()
        const edges: SemanticEdge[] = []

        for (const memory of memories) {
            const keywords = TextProcessor.extractKeywords(memory.content, 5)
            const importance = memory.salience || 0.5

            nodes.set(memory.id, {
                id: memory.id,
                text: memory.content,
                importance,
                keywords,
                linkedMemories: []
            })
        }

        for (let i = 0; i < memories.length; i++) {
            for (let j = i + 1; j < memories.length; j++) {
                const memA = memories[i]
                const memB = memories[j]

                const tokensA = TextProcessor.tokenize(memA.content)
                const tokensB = TextProcessor.tokenize(memB.content)

                const similarity = TextProcessor.jaccardSimilarity(tokensA, tokensB)

                if (similarity > 0.15) {
                    const edgeType = this.detectRelationType(memA.content, memB.content)

                    edges.push({
                        source: memA.id,
                        target: memB.id,
                        weight: similarity,
                        type: edgeType
                    })

                    const nodeA = nodes.get(memA.id)
                    const nodeB = nodes.get(memB.id)

                    if (nodeA) nodeA.linkedMemories.push(memB.id)
                    if (nodeB) nodeB.linkedMemories.push(memA.id)
                }
            }
        }

        return { nodes, edges }
    }

    /**
     * Detect relationship type between two texts
     */
    private static detectRelationType(textA: string, textB: string): 'causal' | 'temporal' | 'associative' | 'contrasting' {
        const combined = `${textA} ${textB}`.toLowerCase()

        const causalMarkers = DISCOURSE_MARKERS.causal.filter(m => combined.includes(m))
        const temporalMarkers = DISCOURSE_MARKERS.temporal.filter(m => combined.includes(m))
        const contrastiveMarkers = DISCOURSE_MARKERS.contrastive.filter(m => combined.includes(m))

        if (contrastiveMarkers.length > 0) return 'contrasting'
        if (causalMarkers.length > 0) return 'causal'
        if (temporalMarkers.length > 0) return 'temporal'

        return 'associative'
    }

    /**
     * Find central nodes (most connected memories)
     */
    static findCentralNodes(graph: SemanticGraph, topN: number = 5): SemanticNode[] {
        const centrality = new Map<string, number>()

        for (const [id, node] of graph.nodes) {
            const connectedness = node.linkedMemories.length
            const importance = node.importance

            centrality.set(id, connectedness * importance)
        }

        return Array.from(graph.nodes.values())
            .sort((a, b) => (centrality.get(b.id) || 0) - (centrality.get(a.id) || 0))
            .slice(0, topN)
    }
}

/**
 * Advanced memory clustering with semantic awareness
 */
class MemoryClusterer {
    /**
     * Cluster memories using TF-IDF and cosine similarity
     */
    static cluster(
        memories: MemoryReference[],
        maxClusters: number = 5
    ): MemoryCluster[] {
        if (memories.length === 0) return []

        if (memories.length <= maxClusters) {
            return memories.map((m, i) => ({
                id: `cluster_${i}`,
                centroid: m.content.slice(0, 100),
                members: [m],
                coherence: 1.0,
                sector: m.sector,
                keywords: TextProcessor.extractKeywords(m.content, 5),
                semanticDensity: TextProcessor.calculateSemanticDensity(m.content),
                importance: m.salience || 0.5
            }))
        }

        const docs = memories.map(m => m.content)
        const tfidfVectors = TextProcessor.computeTfIdf(docs)
        const vectors = Array.from(tfidfVectors.values())

        const clusters: MemoryCluster[] = []
        const assigned = new Set<number>()

        for (let i = 0; i < Math.min(maxClusters, memories.length); i++) {
            if (assigned.size >= memories.length) break

            let seedIdx = -1
            let maxAvgDist = -1

            for (let j = 0; j < memories.length; j++) {
                if (assigned.has(j)) continue

                const avgDist = vectors
                    .map((v, k) => assigned.has(k) || !vectors[j] || !v ? 0 : TextProcessor.cosineSimilarity(vectors[j], v))
                    .reduce((a, b) => a + b, 0) / Math.max(1, memories.length - assigned.size)

                if (avgDist > maxAvgDist) {
                    maxAvgDist = avgDist
                    seedIdx = j
                }
            }

            if (seedIdx === -1) break

            const clusterMembers: MemoryReference[] = [memories[seedIdx]]
            assigned.add(seedIdx)

            const similarities = vectors.map((v, idx) => ({
                idx,
                sim: !vectors[seedIdx] || !v ? 0 : TextProcessor.cosineSimilarity(vectors[seedIdx], v)
            }))
                .filter(s => !assigned.has(s.idx))
                .sort((a, b) => b.sim - a.sim)

            const clusterSize = Math.ceil((memories.length - assigned.size) / (maxClusters - i))
            for (let k = 0; k < Math.min(clusterSize - 1, similarities.length); k++) {
                const idx = similarities[k].idx
                clusterMembers.push(memories[idx])
                assigned.add(idx)
            }

            const sectorCounts: Record<string, number> = {}
            clusterMembers.forEach(m => {
                sectorCounts[m.sector] = (sectorCounts[m.sector] || 0) + 1
            })
            const dominantSector = Object.entries(sectorCounts)
                .sort((a, b) => b[1] - a[1])[0][0]

            const allContent = clusterMembers.map(m => m.content).join(' ')
            const keywords = TextProcessor.extractKeywords(allContent, 5)
            const semanticDensity = TextProcessor.calculateSemanticDensity(allContent)

            const coherence = clusterMembers.length === 1 ? 1.0 :
                clusterMembers
                    .map(m => TextProcessor.jaccardSimilarity(
                        TextProcessor.tokenize(m.content),
                        TextProcessor.tokenize(clusterMembers[0].content)
                    ))
                    .reduce((a, b) => a + b, 0) / clusterMembers.length

            const importance = clusterMembers.reduce((sum, m) => sum + (m.salience || 0.5), 0) / clusterMembers.length

            clusters.push({
                id: `cluster_${i}`,
                centroid: clusterMembers[0].content.slice(0, 100),
                members: clusterMembers,
                coherence,
                sector: dominantSector,
                keywords,
                semanticDensity,
                importance
            })
        }

        return clusters.sort((a, b) => (b.coherence * b.importance) - (a.coherence * a.importance))
    }

    /**
     * Select most representative memory from cluster
     */
    static selectRepresentative(cluster: MemoryCluster): MemoryReference {
        if (cluster.members.length === 1) return cluster.members[0]

        return cluster.members.reduce((best, current) => {
            const bestScore = (best.score || best.salience || 0) *
                TextProcessor.extractKeywords(best.content, 5)
                    .filter(kw => cluster.keywords.includes(kw)).length

            const currentScore = (current.score || current.salience || 0) *
                TextProcessor.extractKeywords(current.content, 5)
                    .filter(kw => cluster.keywords.includes(kw)).length

            return currentScore > bestScore ? current : best
        })
    }

    /**
     * Merge similar clusters to improve coherence
     */
    static mergeSimilarClusters(clusters: MemoryCluster[], threshold: number = 0.6): MemoryCluster[] {
        if (clusters.length <= 1) return clusters

        const merged: MemoryCluster[] = []
        const used = new Set<number>()

        for (let i = 0; i < clusters.length; i++) {
            if (used.has(i)) continue

            const baseCluster = clusters[i]
            const mergedMembers = [...baseCluster.members]
            used.add(i)

            for (let j = i + 1; j < clusters.length; j++) {
                if (used.has(j)) continue

                const similarity = TextProcessor.jaccardSimilarity(
                    baseCluster.keywords,
                    clusters[j].keywords
                )

                if (similarity >= threshold) {
                    mergedMembers.push(...clusters[j].members)
                    used.add(j)
                }
            }

            const allContent = mergedMembers.map(m => m.content).join(' ')
            const keywords = TextProcessor.extractKeywords(allContent, 5)

            merged.push({
                ...baseCluster,
                members: mergedMembers,
                keywords,
                semanticDensity: TextProcessor.calculateSemanticDensity(allContent),
                importance: mergedMembers.reduce((sum, m) => sum + (m.salience || 0.5), 0) / mergedMembers.length
            })
        }

        return merged
    }
}

/**
 * Coherence scorer for evaluating text quality
 */
class CoherenceScorer {
    /**
     * Calculate overall coherence score for text
     */
    static scoreTextCoherence(text: string): number {
        const sentences = TextProcessor.sentenceSplit(text)
        if (sentences.length <= 1) return 1.0

        let totalCoherence = 0

        for (let i = 0; i < sentences.length - 1; i++) {
            const current = TextProcessor.tokenize(sentences[i])
            const next = TextProcessor.tokenize(sentences[i + 1])

            const overlap = TextProcessor.jaccardSimilarity(current, next)
            totalCoherence += overlap
        }

        const avgCoherence = totalCoherence / (sentences.length - 1)

        const discourseMarkers = TextProcessor.detectDiscourseMarkers(text)
        const hasDiscourse = discourseMarkers.size > 0 ? 1.1 : 1.0

        const lexicalDiversity = TextProcessor.calculateLexicalDiversity(text)
        const diversityBonus = Math.min(1.2, 1.0 + lexicalDiversity * 0.5)

        return Math.min(1.0, avgCoherence * hasDiscourse * diversityBonus)
    }

    /**
     * Score coherence between segments
     */
    static scoreSegmentCoherence(segments: AnswerSegment[]): number {
        if (segments.length <= 1) return 1.0

        let totalCoherence = 0

        for (let i = 0; i < segments.length - 1; i++) {
            const currentTokens = TextProcessor.tokenize(segments[i].content)
            const nextTokens = TextProcessor.tokenize(segments[i + 1].content)

            const similarity = TextProcessor.jaccardSimilarity(currentTokens, nextTokens)
            totalCoherence += similarity
        }

        return totalCoherence / (segments.length - 1)
    }

    /**
     * Evaluate completeness of answer relative to query
     */
    static scoreCompleteness(answer: string, query: string, memories: MemoryReference[]): number {
        const queryKeywords = TextProcessor.extractKeywords(query, 5)
        const answerTokens = TextProcessor.tokenize(answer)

        const keywordCoverage = queryKeywords.filter(kw =>
            answerTokens.includes(kw)
        ).length / Math.max(1, queryKeywords.length)

        const memoryUtilization = memories.length > 0 ? Math.min(1.0, answer.length / (memories.length * 100)) : 0.5

        const hasStructure = answer.includes('\n\n') ? 1.1 : 1.0

        return Math.min(1.0, keywordCoverage * 0.6 + memoryUtilization * 0.3 * hasStructure)
    }
}

/**
 * Advanced answer synthesizer with multi-strategy composition
 */
class AnswerSynthesizer {
    /**
     * Synthesize comprehensive answer from memories
     */
    static synthesize(
        query: string,
        memories: MemoryReference[],
        context: QueryContext
    ): GeneratedAnswer {
        if (memories.length === 0) {
            return this.generateEmptyResponse()
        }

        type RankedMemory = MemoryReference & { relevance: number }

        const rankedMemories: RankedMemory[] = memories
            .map(m => ({
                ...m,
                relevance: QueryAnalyzer.computeRelevanceScore(m, context)
            }))
            .sort((a, b) => b.relevance - a.relevance)

        const contextWindow = ContextWindowManager.buildContextWindow(rankedMemories, context)
        const attentionScores = ContextWindowManager.applyAttentionMechanism(contextWindow, query)

        const clusters = MemoryClusterer.cluster(contextWindow.memories, 4)
        const mergedClusters = MemoryClusterer.mergeSimilarClusters(clusters, 0.5)

        const segments: AnswerSegment[] = []
        const citations: Array<{ id: string; snippet: string; sector: string }> = []
        const usedMemories = new Set<string>()

        const relevanceMap = new Map<string, number>()
        for (const m of rankedMemories) {
            relevanceMap.set(m.id, m.relevance)
        }

        if (context.queryType === 'interrogative') {
            this.synthesizeInterrogativeAnswer(
                mergedClusters,
                rankedMemories,
                relevanceMap,
                attentionScores,
                segments,
                citations,
                usedMemories
            )
        } else {
            this.synthesizeDeclarativeAnswer(
                mergedClusters,
                rankedMemories,
                relevanceMap,
                attentionScores,
                segments,
                citations,
                usedMemories
            )
        }

        if (context.complexity === 'complex') {
            this.addSynthesisSegment(mergedClusters, segments, citations, usedMemories)
        }

        const sectorBreakdown: Record<string, number> = {}
        for (const mem of memories) {
            sectorBreakdown[mem.sector] = (sectorBreakdown[mem.sector] || 0) + 1
        }

        const avgConfidence = segments.reduce((sum, seg) => sum + seg.confidence, 0) /
            Math.max(1, segments.length)

        const finalText = this.assembleAnswer(segments, context, sectorBreakdown)

        const coherence = CoherenceScorer.scoreTextCoherence(finalText)
        const completeness = CoherenceScorer.scoreCompleteness(finalText, query, memories)
        const relevance = avgConfidence
        const diversity = this.calculateDiversity(segments)

        return {
            segments,
            finalText,
            confidence: avgConfidence,
            memoryCount: memories.length,
            sectorBreakdown,
            citations,
            qualityMetrics: {
                coherence,
                completeness,
                relevance,
                diversity
            }
        }
    }

    /**
     * Generate response for empty memory set
     */
    private static generateEmptyResponse(): GeneratedAnswer {
        return {
            segments: [{
                type: 'direct',
                content: "I don't have relevant memories to answer your question. Try adding more context or rephrasing your query.",
                sources: [],
                confidence: 0,
                relevance: 0,
                coherenceScore: 1.0
            }],
            finalText: "I don't have relevant memories to answer your question.",
            confidence: 0,
            memoryCount: 0,
            sectorBreakdown: {},
            citations: [],
            qualityMetrics: {
                coherence: 1.0,
                completeness: 0,
                relevance: 0,
                diversity: 0
            }
        }
    }

    /**
     * Synthesize answer for interrogative queries
     */
    private static synthesizeInterrogativeAnswer(
        clusters: MemoryCluster[],
        rankedMemories: any[],
        relevanceMap: Map<string, number>,
        attentionScores: Map<string, number>,
        segments: AnswerSegment[],
        citations: Array<{ id: string; snippet: string; sector: string }>,
        usedMemories: Set<string>
    ): void {
        const primaryCluster = clusters[0]
        if (primaryCluster) {
            const repr = MemoryClusterer.selectRepresentative(primaryCluster)
            const sentences = TextProcessor.extractMostInformativeSentences(repr.content, 3)
            const coherence = CoherenceScorer.scoreTextCoherence(sentences.join(' '))

            segments.push({
                type: 'direct',
                content: sentences.join(' '),
                sources: [repr.id],
                confidence: relevanceMap.get(repr.id) || 0.8,
                relevance: relevanceMap.get(repr.id) || 0.8,
                coherenceScore: coherence
            })

            citations.push({
                id: repr.id,
                snippet: repr.content.slice(0, 80) + '...',
                sector: repr.sector
            })
            usedMemories.add(repr.id)
        }

        for (let i = 1; i < Math.min(3, clusters.length); i++) {
            const cluster = clusters[i]
            const repr = MemoryClusterer.selectRepresentative(cluster)
            if (usedMemories.has(repr.id)) continue

            const sentences = TextProcessor.extractMostInformativeSentences(repr.content, 2)
            const coherence = CoherenceScorer.scoreTextCoherence(sentences.join(' '))

            segments.push({
                type: 'context',
                content: sentences.join(' '),
                sources: [repr.id],
                confidence: relevanceMap.get(repr.id) || 0.7,
                relevance: relevanceMap.get(repr.id) || 0.7,
                coherenceScore: coherence
            })

            citations.push({
                id: repr.id,
                snippet: repr.content.slice(0, 80) + '...',
                sector: repr.sector
            })
            usedMemories.add(repr.id)
        }

        const reflectiveMemories = rankedMemories.filter(m =>
            m.sector === 'reflective' && !usedMemories.has(m.id)
        )

        if (reflectiveMemories.length > 0 && segments.length < 5) {
            const best = reflectiveMemories[0]
            const sentences = TextProcessor.extractMostInformativeSentences(best.content, 1)
            const coherence = CoherenceScorer.scoreTextCoherence(sentences[0] || best.content.slice(0, 200))

            segments.push({
                type: 'reflection',
                content: sentences[0] || best.content.slice(0, 200),
                sources: [best.id],
                confidence: best.relevance,
                relevance: best.relevance,
                coherenceScore: coherence
            })

            citations.push({
                id: best.id,
                snippet: best.content.slice(0, 80) + '...',
                sector: best.sector
            })
        }
    }

    /**
     * Synthesize answer for declarative queries
     */
    private static synthesizeDeclarativeAnswer(
        clusters: MemoryCluster[],
        rankedMemories: any[],
        relevanceMap: Map<string, number>,
        attentionScores: Map<string, number>,
        segments: AnswerSegment[],
        citations: Array<{ id: string; snippet: string; sector: string }>,
        usedMemories: Set<string>
    ): void {
        const topMemories = rankedMemories.slice(0, 5)

        for (const mem of topMemories) {
            const sentences = TextProcessor.extractMostInformativeSentences(mem.content, 2)
            const coherence = CoherenceScorer.scoreTextCoherence(sentences.join(' '))

            segments.push({
                type: 'elaboration',
                content: sentences.join(' '),
                sources: [mem.id],
                confidence: mem.relevance,
                relevance: mem.relevance,
                coherenceScore: coherence
            })

            citations.push({
                id: mem.id,
                snippet: mem.content.slice(0, 80) + '...',
                sector: mem.sector
            })
            usedMemories.add(mem.id)
        }
    }

    /**
     * Add synthesis segment for complex queries
     */
    private static addSynthesisSegment(
        clusters: MemoryCluster[],
        segments: AnswerSegment[],
        citations: Array<{ id: string; snippet: string; sector: string }>,
        usedMemories: Set<string>
    ): void {
        if (clusters.length < 2) return

        const topClusters = clusters.slice(0, 2)
        const commonKeywords = topClusters[0].keywords.filter(kw =>
            topClusters[1].keywords.includes(kw)
        )

        if (commonKeywords.length > 0) {
            const synthesisText = `Key connections: ${commonKeywords.slice(0, 3).join(', ')}`

            segments.push({
                type: 'synthesis',
                content: synthesisText,
                sources: topClusters.flatMap(c => c.members.map(m => m.id)).slice(0, 3),
                confidence: 0.8,
                relevance: 0.7,
                coherenceScore: 0.9
            })
        }
    }

    /**
     * Calculate diversity score for segments
     */
    private static calculateDiversity(segments: AnswerSegment[]): number {
        if (segments.length <= 1) return 0

        const uniqueTypes = new Set<string>()

        for (const seg of segments) {
            uniqueTypes.add(seg.type)
        }

        const typeDiversity = uniqueTypes.size / 6
        const lengthVariance = this.calculateLengthVariance(segments)

        return (typeDiversity * 0.6 + lengthVariance * 0.4)
    }

    /**
     * Calculate variance in segment lengths
     */
    private static calculateLengthVariance(segments: AnswerSegment[]): number {
        if (segments.length === 0) return 0

        const lengths = segments.map(s => s.content.length)
        const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length

        const variance = lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length

        return Math.min(1.0, Math.sqrt(variance) / avgLength)
    }

    /**
     * Assemble final answer from segments with transitions
     */
    static assembleAnswer(
        segments: AnswerSegment[],
        context: QueryContext,
        sectorBreakdown: Record<string, number>
    ): string {
        const parts: string[] = []

        const directSegments = segments.filter(s => s.type === 'direct')
        const contextSegments = segments.filter(s => s.type === 'context')
        const elaborationSegments = segments.filter(s => s.type === 'elaboration')
        const reflectionSegments = segments.filter(s => s.type === 'reflection')
        const synthesisSegments = segments.filter(s => s.type === 'synthesis')

        if (directSegments.length > 0) {
            parts.push(directSegments[0].content)
        }

        if (elaborationSegments.length > 0) {
            if (parts.length > 0 && context.complexity !== 'simple') {
                parts.push('\n')
            }
            const combined = elaborationSegments.map(s => s.content).join('\n\n')
            parts.push(combined)
        }

        if (contextSegments.length > 0) {
            for (const seg of contextSegments) {
                const sources = seg.sources.map(id => `[${id.slice(0, 8)}]`).join(' ')
                parts.push(`\n**Additional Context:** ${seg.content}`)
            }
        }

        if (synthesisSegments.length > 0) {
            parts.push(`\n**Analysis:** ${synthesisSegments[0].content}`)
        }

        if (reflectionSegments.length > 0) {
            parts.push(`\n**Insight:** ${reflectionSegments[0].content}`)
        }

        const totalMemories = Object.values(sectorBreakdown).reduce((a, b) => a + b, 0)
        const sectorCount = Object.keys(sectorBreakdown).length
        const topSectors = Object.entries(sectorBreakdown)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([sector, count]) => `${sector}(${count})`)
            .join(', ')

        const confidenceLabel = segments.length > 0 ?
            (segments[0].confidence > 0.7 ? 'high' : segments[0].confidence > 0.5 ? 'moderate' : 'low') :
            'low'

        parts.push(`\n\n---\n*Retrieved ${totalMemories} ${totalMemories === 1 ? 'memory' : 'memories'} across ${sectorCount} ${sectorCount === 1 ? 'sector' : 'sectors'}: ${topSectors} • Confidence: ${confidenceLabel}*`)

        return parts.join('\n\n')
    }
}

/**
 * Main AI Engine facade class
 */
export class MemoryAIEngine {
    /**
     * Generate comprehensive response from query and memories
     */
    static async generateResponse(
        query: string,
        memories: MemoryReference[]
    ): Promise<string> {
        const context = QueryAnalyzer.analyze(query)

        const enhancedMemories = memories.map(m => ({
            ...m,
            score: m.score || QueryAnalyzer.computeRelevanceScore(m, context)
        }))

        const answer = AnswerSynthesizer.synthesize(query, enhancedMemories, context)

        return answer.finalText
    }

    /**
     * Generate detailed response with full metadata
     */
    static async generateDetailedResponse(
        query: string,
        memories: MemoryReference[]
    ): Promise<GeneratedAnswer> {
        const context = QueryAnalyzer.analyze(query)

        const enhancedMemories = memories.map(m => ({
            ...m,
            score: m.score || QueryAnalyzer.computeRelevanceScore(m, context)
        }))

        return AnswerSynthesizer.synthesize(query, enhancedMemories, context)
    }

    /**
     * Analyze query and extract context
     */
    static analyzeQuery(query: string): QueryContext {
        return QueryAnalyzer.analyze(query)
    }

    /**
     * Cluster memories semantically
     */
    static clusterMemories(memories: MemoryReference[], maxClusters: number = 5): MemoryCluster[] {
        return MemoryClusterer.cluster(memories, maxClusters)
    }

    /**
     * Compute relevance score for memory against query
     */
    static computeMemoryRelevance(
        memory: MemoryReference,
        query: string
    ): number {
        const context = QueryAnalyzer.analyze(query)
        return QueryAnalyzer.computeRelevanceScore(memory, context)
    }

    /**
     * Build semantic graph from memories
     */
    static buildSemanticGraph(memories: MemoryReference[]): SemanticGraph {
        return SemanticGraphBuilder.buildGraph(memories)
    }

    /**
     * Find most important memories using graph centrality
     */
    static findCentralMemories(memories: MemoryReference[], topN: number = 5): MemoryReference[] {
        const graph = SemanticGraphBuilder.buildGraph(memories)
        const centralNodes = SemanticGraphBuilder.findCentralNodes(graph, topN)

        return centralNodes
            .map(node => memories.find(m => m.id === node.id))
            .filter(m => m !== undefined) as MemoryReference[]
    }

    /**
     * Build optimized context window
     */
    static buildContextWindow(
        memories: MemoryReference[],
        query: string
    ): ContextWindow {
        const context = QueryAnalyzer.analyze(query)
        return ContextWindowManager.buildContextWindow(memories, context)
    }

    /**
     * Evaluate answer quality
     */
    static evaluateAnswerQuality(
        answer: string,
        query: string,
        memories: MemoryReference[]
    ): {
        coherence: number
        completeness: number
        lexicalDiversity: number
        semanticDensity: number
    } {
        return {
            coherence: CoherenceScorer.scoreTextCoherence(answer),
            completeness: CoherenceScorer.scoreCompleteness(answer, query, memories),
            lexicalDiversity: TextProcessor.calculateLexicalDiversity(answer),
            semanticDensity: TextProcessor.calculateSemanticDensity(answer)
        }
    }

    /**
     * Extract key insights from memories using advanced analysis
     */
    static extractKeyInsights(
        memories: MemoryReference[],
        topN: number = 5
    ): Array<{ insight: string; confidence: number; sources: string[] }> {
        const insights: Array<{ insight: string; confidence: number; sources: string[] }> = []

        const clusters = this.clusterMemories(memories, Math.min(5, Math.ceil(memories.length / 2)))

        for (const cluster of clusters) {
            if (cluster.members.length < 2) continue

            const commonKeywords = cluster.keywords.slice(0, 3)
            const repr = MemoryClusterer.selectRepresentative(cluster)
            const sentences = TextProcessor.extractMostInformativeSentences(repr.content, 1)

            if (sentences.length > 0 && commonKeywords.length > 0) {
                insights.push({
                    insight: `${sentences[0]} (Key themes: ${commonKeywords.join(', ')})`,
                    confidence: cluster.coherence * cluster.importance,
                    sources: cluster.members.map(m => m.id).slice(0, 3)
                })
            }
        }

        return insights
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, topN)
    }

    /**
     * Generate summary of memory collection
     */
    static summarizeMemories(
        memories: MemoryReference[],
        maxLength: number = 500
    ): string {
        if (memories.length === 0) {
            return "No memories available to summarize."
        }

        const clusters = this.clusterMemories(memories, Math.min(3, memories.length))
        const summaryParts: string[] = []

        for (const cluster of clusters) {
            const repr = MemoryClusterer.selectRepresentative(cluster)
            const sentences = TextProcessor.extractMostInformativeSentences(repr.content, 1)

            if (sentences.length > 0) {
                summaryParts.push(sentences[0])
            }
        }

        let summary = summaryParts.join(' ')

        if (summary.length > maxLength) {
            summary = summary.substring(0, maxLength) + '...'
        }

        return summary
    }

    /**
     * Detect memory gaps based on query patterns
     */
    static detectMemoryGaps(
        query: string,
        memories: MemoryReference[]
    ): Array<{ topic: string; confidence: number }> {
        const context = QueryAnalyzer.analyze(query)
        const gaps: Array<{ topic: string; confidence: number }> = []

        const queriedTopics = new Set([...context.keywords, ...context.entities])
        const memoryTopics = new Set<string>()

        for (const memory of memories) {
            const keywords = TextProcessor.extractKeywords(memory.content, 5)
            keywords.forEach(kw => memoryTopics.add(kw))
        }

        for (const topic of queriedTopics) {
            if (!memoryTopics.has(topic)) {
                const partialMatches = Array.from(memoryTopics).filter(mt =>
                    mt.includes(topic) || topic.includes(mt)
                ).length

                const confidence = 1.0 - (partialMatches * 0.2)

                if (confidence > 0.5) {
                    gaps.push({ topic, confidence })
                }
            }
        }

        return gaps.sort((a, b) => b.confidence - a.confidence)
    }

    /**
     * Suggest related queries based on memories
     */
    static suggestRelatedQueries(
        memories: MemoryReference[],
        count: number = 5
    ): string[] {
        if (memories.length === 0) return []

        const suggestions: string[] = []
        const graph = SemanticGraphBuilder.buildGraph(memories)
        const centralNodes = SemanticGraphBuilder.findCentralNodes(graph, count)

        for (const node of centralNodes) {
            const keywords = node.keywords.slice(0, 2)
            if (keywords.length > 0) {
                suggestions.push(`What do you know about ${keywords.join(' and ')}?`)
            }
        }

        const sectors = new Set(memories.map(m => m.sector))
        if (sectors.has('procedural')) {
            suggestions.push("How do I accomplish this task?")
        }
        if (sectors.has('episodic')) {
            suggestions.push("When did this happen?")
        }
        if (sectors.has('reflective')) {
            suggestions.push("What insights can you share?")
        }

        return suggestions.slice(0, count)
    }

    /**
     * Rank memories by multiple criteria
     */
    static rankMemories(
        memories: MemoryReference[],
        criteria: {
            recency?: number
            salience?: number
            relevance?: number
            diversity?: number
        } = {}
    ): MemoryReference[] {
        const weights = {
            recency: criteria.recency || 0.25,
            salience: criteria.salience || 0.35,
            relevance: criteria.relevance || 0.30,
            diversity: criteria.diversity || 0.10
        }

        const now = Date.now()
        const dayMs = 24 * 60 * 60 * 1000

        const scored = memories.map(m => {
            const recencyScore = m.last_seen_at ?
                Math.max(0, 1 - (now - m.last_seen_at) / (30 * dayMs)) : 0.5

            const salienceScore = m.salience || 0.5
            const relevanceScore = m.score || 0.5

            const diversityScore = TextProcessor.calculateLexicalDiversity(m.content)

            const totalScore =
                recencyScore * weights.recency +
                salienceScore * weights.salience +
                relevanceScore * weights.relevance +
                diversityScore * weights.diversity

            return { memory: m, score: totalScore }
        })

        return scored
            .sort((a, b) => b.score - a.score)
            .map(s => s.memory)
    }

    /**
     * Detect duplicate or highly similar memories
     */
    static findSimilarMemories(
        memory: MemoryReference,
        candidates: MemoryReference[],
        threshold: number = 0.7
    ): MemoryReference[] {
        const similar: MemoryReference[] = []
        const targetTokens = TextProcessor.tokenize(memory.content)

        for (const candidate of candidates) {
            if (candidate.id === memory.id) continue

            const candTokens = TextProcessor.tokenize(candidate.content)
            const similarity = TextProcessor.jaccardSimilarity(targetTokens, candTokens)

            if (similarity >= threshold) {
                similar.push(candidate)
            }
        }

        return similar.sort((a, b) => {
            const simA = TextProcessor.jaccardSimilarity(
                targetTokens,
                TextProcessor.tokenize(a.content)
            )
            const simB = TextProcessor.jaccardSimilarity(
                targetTokens,
                TextProcessor.tokenize(b.content)
            )
            return simB - simA
        })
    }

    /**
     * Generate alternative phrasings for a query
     */
    static generateQueryAlternatives(query: string): string[] {
        const context = QueryAnalyzer.analyze(query)
        const alternatives: string[] = []

        if (context.queryType === 'interrogative') {
            const keywords = context.keywords.slice(0, 3).join(' ')
            alternatives.push(`Tell me about ${keywords}`)
            alternatives.push(`Explain ${keywords}`)
            alternatives.push(`What information do you have on ${keywords}?`)
        } else {
            alternatives.push(`What do you know about: ${query}`)
            alternatives.push(`Can you explain ${query}?`)
        }

        if (context.intent === 'procedural') {
            alternatives.push(`What are the steps for ${context.keywords[0]}?`)
        }

        if (context.intent === 'factual') {
            alternatives.push(`Define ${context.keywords[0]}`)
        }

        return alternatives.slice(0, 3)
    }

    /**
     * Extract temporal patterns from memories
     */
    static extractTemporalPatterns(
        memories: MemoryReference[]
    ): {
        recentActivity: number
        oldestMemory?: number
        newestMemory?: number
        averageAge: number
    } {
        const now = Date.now()
        const memoriesWithTime = memories.filter(m => m.last_seen_at)

        if (memoriesWithTime.length === 0) {
            return {
                recentActivity: 0,
                averageAge: 0
            }
        }

        const timestamps = memoriesWithTime.map(m => m.last_seen_at!)
        const oldestMemory = Math.min(...timestamps)
        const newestMemory = Math.max(...timestamps)

        const dayMs = 24 * 60 * 60 * 1000
        const recentCount = memoriesWithTime.filter(m =>
            now - m.last_seen_at! < 7 * dayMs
        ).length

        const recentActivity = recentCount / memories.length

        const ages = memoriesWithTime.map(m => now - m.last_seen_at!)
        const averageAge = ages.reduce((a, b) => a + b, 0) / ages.length

        return {
            recentActivity,
            oldestMemory,
            newestMemory,
            averageAge
        }
    }

    /**
     * Analyze sector distribution and balance
     */
    static analyzeSectorDistribution(
        memories: MemoryReference[]
    ): {
        distribution: Record<string, number>
        dominantSector: string
        balance: number
        recommendations: string[]
    } {
        const distribution: Record<string, number> = {}
        const recommendations: string[] = []

        for (const memory of memories) {
            distribution[memory.sector] = (distribution[memory.sector] || 0) + 1
        }

        const sectors = Object.entries(distribution)
        const dominantSector = sectors.sort((a, b) => b[1] - a[1])[0]?.[0] || 'semantic'

        const total = memories.length
        const idealPercentage = 1 / sectors.length

        let balance = 0
        for (const [sector, count] of sectors) {
            const percentage = count / total
            const deviation = Math.abs(percentage - idealPercentage)
            balance += (1 - deviation)
        }
        balance = balance / sectors.length

        const sectorNames: Record<string, string> = {
            semantic: 'factual knowledge',
            episodic: 'personal experiences',
            procedural: 'how-to information',
            emotional: 'feelings and sentiments',
            reflective: 'insights and analysis'
        }

        for (const [sector, name] of Object.entries(sectorNames)) {
            if (!distribution[sector] || distribution[sector] < total * 0.1) {
                recommendations.push(`Consider adding more ${name} memories`)
            }
        }

        return {
            distribution,
            dominantSector,
            balance,
            recommendations
        }
    }

    /**
     * Generate confidence explanation for an answer
     */
    static explainConfidence(
        answer: GeneratedAnswer,
        query: string
    ): string {
        const explanations: string[] = []

        explanations.push(`Confidence: ${(answer.confidence * 100).toFixed(1)}%`)

        if (answer.memoryCount > 0) {
            explanations.push(`Based on ${answer.memoryCount} relevant ${answer.memoryCount === 1 ? 'memory' : 'memories'}`)
        }

        if (answer.qualityMetrics) {
            if (answer.qualityMetrics.coherence > 0.7) {
                explanations.push("High coherence between information sources")
            } else if (answer.qualityMetrics.coherence < 0.4) {
                explanations.push("Information sources show some inconsistency")
            }

            if (answer.qualityMetrics.completeness > 0.7) {
                explanations.push("Query fully addressed")
            } else if (answer.qualityMetrics.completeness < 0.5) {
                explanations.push("Some aspects of the query may not be fully covered")
            }
        }

        const sectorCount = Object.keys(answer.sectorBreakdown).length
        if (sectorCount > 2) {
            explanations.push(`Drew from ${sectorCount} different memory sectors`)
        }

        return explanations.join('. ') + '.'
    }

    /**
     * Detect answer biases based on memory distribution
     */
    static detectAnswerBiases(
        answer: GeneratedAnswer
    ): Array<{ type: string; severity: number; description: string }> {
        const biases: Array<{ type: string; severity: number; description: string }> = []

        const sectorEntries = Object.entries(answer.sectorBreakdown)
        if (sectorEntries.length > 0) {
            const total = sectorEntries.reduce((sum, [, count]) => sum + count, 0)
            const dominant = sectorEntries.sort((a, b) => b[1] - a[1])[0]

            const dominanceRatio = dominant[1] / total

            if (dominanceRatio > 0.7) {
                biases.push({
                    type: 'sector_imbalance',
                    severity: dominanceRatio,
                    description: `Answer heavily weighted toward ${dominant[0]} memories (${(dominanceRatio * 100).toFixed(1)}%)`
                })
            }
        }

        if (answer.qualityMetrics.diversity < 0.3) {
            biases.push({
                type: 'low_diversity',
                severity: 1 - answer.qualityMetrics.diversity,
                description: 'Answer segments show limited diversity in content'
            })
        }

        if (answer.citations.length < 2 && answer.memoryCount > 3) {
            biases.push({
                type: 'narrow_sourcing',
                severity: 0.6,
                description: 'Answer relies on very few sources despite multiple memories available'
            })
        }

        return biases.sort((a, b) => b.severity - a.severity)
    }

    /**
     * Generate follow-up questions based on answer gaps
     */
    static generateFollowUpQuestions(
        answer: GeneratedAnswer,
        originalQuery: string
    ): string[] {
        const questions: string[] = []

        if (answer.qualityMetrics.completeness < 0.6) {
            questions.push("Could you provide more specific details?")
        }

        if (answer.sectorBreakdown.episodic && answer.sectorBreakdown.episodic > 0) {
            questions.push("Can you share more about your personal experience with this?")
        }

        if (answer.sectorBreakdown.procedural && answer.sectorBreakdown.procedural > 0) {
            questions.push("What are the specific steps involved?")
        }

        if (answer.sectorBreakdown.reflective && answer.sectorBreakdown.reflective > 0) {
            questions.push("What insights or lessons did you learn from this?")
        }

        const context = QueryAnalyzer.analyze(originalQuery)
        if (context.entities.length > 0) {
            questions.push(`Tell me more about ${context.entities[0]}`)
        }

        if (answer.memoryCount < 3) {
            questions.push("Do you have any related memories that might provide more context?")
        }

        return questions.slice(0, 4)
    }

    /**
     * Optimize memory retrieval strategy based on query characteristics
     */
    static optimizeRetrievalStrategy(
        query: string
    ): {
        strategy: 'broad' | 'focused' | 'deep' | 'temporal'
        recommendedCount: number
        sectorPriority: string[]
        explanation: string
    } {
        const context = QueryAnalyzer.analyze(query)

        let strategy: 'broad' | 'focused' | 'deep' | 'temporal' = 'focused'
        let recommendedCount = 10
        let sectorPriority: string[] = []

        if (context.complexity === 'complex') {
            strategy = 'deep'
            recommendedCount = 15
            sectorPriority = ['reflective', 'semantic', 'procedural']
        } else if (context.complexity === 'simple') {
            strategy = 'focused'
            recommendedCount = 5
            sectorPriority = ['semantic']
        } else {
            strategy = 'broad'
            recommendedCount = 10
            sectorPriority = ['semantic', 'episodic']
        }

        if (context.temporalContext?.hasTimeReference) {
            strategy = 'temporal'
            sectorPriority.unshift('episodic')
        }

        switch (context.intent) {
            case 'procedural':
                sectorPriority = ['procedural', 'semantic', 'episodic']
                break
            case 'episodic':
                sectorPriority = ['episodic', 'emotional', 'reflective']
                break
            case 'reflective':
                sectorPriority = ['reflective', 'semantic', 'emotional']
                break
            case 'emotional':
                sectorPriority = ['emotional', 'episodic', 'reflective']
                break
        }

        const explanation = `Using ${strategy} retrieval with focus on ${sectorPriority[0]} memories (${recommendedCount} items)`

        return {
            strategy,
            recommendedCount,
            sectorPriority,
            explanation
        }
    }

    /**
     * Calculate memory freshness score
     */
    static calculateMemoryFreshness(
        memories: MemoryReference[]
    ): {
        overall: number
        bySector: Record<string, number>
        staleMemories: MemoryReference[]
    } {
        const now = Date.now()
        const dayMs = 24 * 60 * 60 * 1000
        const freshnessThreshold = 90 * dayMs

        const bySector: Record<string, number> = {}
        const staleMemories: MemoryReference[] = []

        let totalFreshness = 0
        let countWithTimestamp = 0

        for (const memory of memories) {
            if (!memory.last_seen_at) continue

            const age = now - memory.last_seen_at
            const freshness = Math.max(0, 1 - age / (180 * dayMs))

            totalFreshness += freshness
            countWithTimestamp++

            if (!bySector[memory.sector]) {
                bySector[memory.sector] = 0
            }
            bySector[memory.sector] += freshness

            if (age > freshnessThreshold) {
                staleMemories.push(memory)
            }
        }

        for (const sector in bySector) {
            const count = memories.filter(m => m.sector === sector).length
            bySector[sector] = count > 0 ? bySector[sector] / count : 0
        }

        return {
            overall: countWithTimestamp > 0 ? totalFreshness / countWithTimestamp : 0,
            bySector,
            staleMemories
        }
    }

    /**
     * Generate memory health report
     */
    static generateMemoryHealthReport(
        memories: MemoryReference[]
    ): {
        totalMemories: number
        healthScore: number
        issues: string[]
        strengths: string[]
        recommendations: string[]
    } {
        const issues: string[] = []
        const strengths: string[] = []
        const recommendations: string[] = []

        const sectorAnalysis = this.analyzeSectorDistribution(memories)
        const freshnessAnalysis = this.calculateMemoryFreshness(memories)
        const temporalPatterns = this.extractTemporalPatterns(memories)

        let healthScore = 1.0

        if (memories.length === 0) {
            healthScore = 0
            issues.push("No memories available")
            recommendations.push("Start adding memories to build your knowledge base")
        } else {
            if (memories.length < 10) {
                healthScore *= 0.7
                issues.push("Limited memory collection")
                recommendations.push("Add more memories for better context")
            } else {
                strengths.push(`Good memory collection size (${memories.length} memories)`)
            }

            if (sectorAnalysis.balance < 0.5) {
                healthScore *= 0.9
                issues.push("Unbalanced sector distribution")
                recommendations.push(...sectorAnalysis.recommendations)
            } else {
                strengths.push("Well-balanced memory sectors")
            }

            if (freshnessAnalysis.overall < 0.3) {
                healthScore *= 0.8
                issues.push("Many stale memories detected")
                recommendations.push("Review and update older memories")
            } else if (freshnessAnalysis.overall > 0.7) {
                strengths.push("Memories are generally fresh and up-to-date")
            }

            if (temporalPatterns.recentActivity < 0.2) {
                healthScore *= 0.9
                issues.push("Low recent activity")
                recommendations.push("Consider adding more recent memories")
            } else if (temporalPatterns.recentActivity > 0.5) {
                strengths.push("Active memory maintenance")
            }

            const avgSalience = memories.reduce((sum, m) => sum + (m.salience || 0), 0) / memories.length
            if (avgSalience < 0.3) {
                healthScore *= 0.85
                issues.push("Low average salience scores")
                recommendations.push("Focus on high-quality, important memories")
            } else if (avgSalience > 0.6) {
                strengths.push("High-quality memory collection")
            }
        }

        return {
            totalMemories: memories.length,
            healthScore: Math.max(0, Math.min(1, healthScore)),
            issues,
            strengths,
            recommendations
        }
    }
}

/**
 * Utility functions for advanced memory operations
 */
export class MemoryUtils {
    /**
     * Merge duplicate memories based on similarity
     */
    static mergeDuplicates(
        memories: MemoryReference[],
        threshold: number = 0.85
    ): MemoryReference[] {
        const merged: MemoryReference[] = []
        const processed = new Set<string>()

        for (const memory of memories) {
            if (processed.has(memory.id)) continue

            const similar = MemoryAIEngine.findSimilarMemories(
                memory,
                memories,
                threshold
            )

            if (similar.length > 0) {
                const allContent = [memory, ...similar]
                    .map(m => m.content)
                    .join(' ')

                const avgSalience = [memory, ...similar]
                    .reduce((sum, m) => sum + m.salience, 0) / (similar.length + 1)

                const mostRecent = [memory, ...similar]
                    .filter(m => m.last_seen_at)
                    .sort((a, b) => (b.last_seen_at || 0) - (a.last_seen_at || 0))[0]

                merged.push({
                    ...memory,
                    content: TextProcessor.extractMostInformativeSentences(allContent, 3).join(' '),
                    salience: avgSalience,
                    last_seen_at: mostRecent?.last_seen_at || memory.last_seen_at
                })

                processed.add(memory.id)
                similar.forEach(s => processed.add(s.id))
            } else {
                merged.push(memory)
                processed.add(memory.id)
            }
        }

        return merged
    }

    /**
     * Expand memory with related context
     */
    static expandMemoryContext(
        memory: MemoryReference,
        allMemories: MemoryReference[],
        maxExpansion: number = 3
    ): { original: MemoryReference; related: MemoryReference[]; context: string } {
        const similar = MemoryAIEngine.findSimilarMemories(
            memory,
            allMemories,
            0.3
        ).slice(0, maxExpansion)

        const contextParts = [
            memory.content,
            ...similar.map(m => TextProcessor.extractMostInformativeSentences(m.content, 1)[0])
        ]

        return {
            original: memory,
            related: similar,
            context: contextParts.filter(Boolean).join(' ')
        }
    }

    /**
     * Score memory importance using multiple factors
     */
    static scoreMemoryImportance(
        memory: MemoryReference,
        allMemories: MemoryReference[]
    ): {
        score: number
        factors: {
            salience: number
            connectivity: number
            uniqueness: number
            recency: number
        }
    } {
        const graph = SemanticGraphBuilder.buildGraph(allMemories)
        const node = graph.nodes.get(memory.id)

        const salience = memory.salience || 0.5
        const connectivity = node ? node.linkedMemories.length / Math.max(1, allMemories.length) : 0

        const tokens = TextProcessor.tokenize(memory.content)
        const allTokens = new Set(allMemories.flatMap(m => TextProcessor.tokenize(m.content)))
        const uniqueTokens = tokens.filter(t => {
            const count = allMemories.filter(m =>
                TextProcessor.tokenize(m.content).includes(t)
            ).length
            return count === 1
        }).length
        const uniqueness = tokens.length > 0 ? uniqueTokens / tokens.length : 0

        const now = Date.now()
        const dayMs = 24 * 60 * 60 * 1000
        const recency = memory.last_seen_at ?
            Math.max(0, 1 - (now - memory.last_seen_at) / (90 * dayMs)) : 0.5

        const score = (
            salience * 0.35 +
            connectivity * 0.25 +
            uniqueness * 0.20 +
            recency * 0.20
        )

        return {
            score,
            factors: {
                salience,
                connectivity,
                uniqueness,
                recency
            }
        }
    }

    /**
     * Validate memory quality
     */
    static validateMemoryQuality(
        memory: MemoryReference
    ): {
        isValid: boolean
        issues: string[]
        suggestions: string[]
        qualityScore: number
    } {
        const issues: string[] = []
        const suggestions: string[] = []
        let qualityScore = 1.0

        if (!memory.content || memory.content.trim().length === 0) {
            issues.push("Empty content")
            qualityScore = 0
            return { isValid: false, issues, suggestions, qualityScore }
        }

        if (memory.content.length < 20) {
            issues.push("Very short content")
            qualityScore *= 0.6
            suggestions.push("Consider adding more details")
        }

        if (memory.content.length > 2000) {
            issues.push("Very long content")
            qualityScore *= 0.9
            suggestions.push("Consider breaking into smaller memories")
        }

        const sentences = TextProcessor.sentenceSplit(memory.content)
        if (sentences.length === 0) {
            issues.push("No complete sentences")
            qualityScore *= 0.5
            suggestions.push("Format content into complete sentences")
        }

        const lexicalDiversity = TextProcessor.calculateLexicalDiversity(memory.content)
        if (lexicalDiversity < 0.3) {
            issues.push("Low lexical diversity (repetitive content)")
            qualityScore *= 0.8
            suggestions.push("Use more varied vocabulary")
        }

        const semanticDensity = TextProcessor.calculateSemanticDensity(memory.content)
        if (semanticDensity < 0.2) {
            issues.push("Low semantic density")
            qualityScore *= 0.7
            suggestions.push("Include more meaningful information")
        }

        if (memory.salience < 0.1) {
            issues.push("Very low salience score")
            suggestions.push("This memory may not be significant enough to retain")
        }

        return {
            isValid: issues.length === 0 || qualityScore > 0.5,
            issues,
            suggestions,
            qualityScore
        }
    }
}

export type {
    MemoryReference,
    QueryContext,
    MemoryCluster,
    AnswerSegment,
    GeneratedAnswer,
    SemanticGraph,
    SemanticNode,
    SemanticEdge,
    ContextWindow,
    TextSpan
}
