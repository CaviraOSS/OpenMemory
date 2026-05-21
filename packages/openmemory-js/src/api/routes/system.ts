import { getEmbeddingInfo } from "../../embeddings/embed";
import { env } from "../../configuration/index";
import { getVectorStoreInfo } from "../../vectorStores";

export function systemRoutes(app: any) {
  app.get("/health", async (_req: any, res: any) => {
    res.json({
      ok: true,
      version: "2.0-durable",
      metadata_backend: "postgres",
      vector_store: getVectorStoreInfo(),
      embedding: getEmbeddingInfo(),
      dim: env.vec_dim,
    });
  });
}
