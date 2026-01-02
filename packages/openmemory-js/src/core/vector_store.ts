export interface VectorStore {
    storeVector(id: string, sector: string, vector: number[], dim: number, tenant_id: string, user_id?: string): Promise<void>;
    deleteVector(id: string, sector: string, tenant_id: string): Promise<void>;
    deleteVectors(id: string, tenant_id: string): Promise<void>;
    searchSimilar(sector: string, queryVec: number[], topK: number, tenant_id: string): Promise<Array<{ id: string; score: number }>>;
    getVector(id: string, sector: string, tenant_id: string): Promise<{ vector: number[]; dim: number } | null>;
    getVectorsById(id: string, tenant_id: string): Promise<Array<{ sector: string; vector: number[]; dim: number }>>;
    getVectorsBySector(sector: string, tenant_id: string): Promise<Array<{ id: string; vector: number[]; dim: number }>>;
}
