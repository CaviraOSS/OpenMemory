import { toDurableRememberInput } from "../src/api/routes/v1";

async function main() {
  const input = toDurableRememberInput({
    content: "Ada wrote notes",
    user_id: "u1",
    project_id: "p1",
    entities: [{ type: "person", name: "Ada", role: "subject" }],
    edges: [{ type: "supports", target_memory_id: "m2" }],
  });

  if (input.entities?.[0]?.name !== "Ada") {
    throw new Error("/v1 memory mapping must preserve entities");
  }
  if (input.edges?.[0]?.target_memory_id !== "m2") {
    throw new Error("/v1 memory mapping must preserve edges");
  }

  console.log("[V1] durable memory mapping verified");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
