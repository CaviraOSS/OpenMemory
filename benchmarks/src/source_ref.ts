import { createHash } from "node:crypto";
import type { benchmark_event } from "./types";

export const benchmark_source_ref = (event: Pick<benchmark_event, "id" | "text">): string => createHash("sha256")
    .update(event.id)
    .update("\0")
    .update(event.text)
    .digest("hex");