export interface TemporalFact {
    id: string
    subject: string
    predicate: string
    object: string
    valid_from: Date
    valid_to: Date | null
    confidence: number
    last_updated: Date
    metadata?: Record<string, any>
}

export interface TemporalEdge {
    id: string
    source_id: string
    target_id: string
    relation_type: string
    valid_from: Date
    valid_to: Date | null
    weight: number
    metadata?: Record<string, any>
}

export interface TimelineEntry {
    timestamp: Date
    subject: string
    predicate: string
    object: string
    confidence: number
    change_type: 'created' | 'updated' | 'invalidated'
}

export interface TemporalQuery {
    subject?: string
    predicate?: string
    object?: string
    at?: Date
    from?: Date
    to?: Date
    min_confidence?: number
}
