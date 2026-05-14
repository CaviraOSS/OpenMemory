import { makeDurableExecutor } from "../src/api/routes/v1";

async function main() {
  const calls: string[] = [];
  const db = makeDurableExecutor(
    async (sql, params = []) => {
      calls.push(`run:${sql}:${params.length}`);
    },
    async (sql, params = []) => {
      calls.push(`all:${sql}:${params.length}`);
      return [{ id: "row-1" }];
    },
    {
      begin: async () => {
        calls.push("tx:begin");
      },
      commit: async () => {
        calls.push("tx:commit");
      },
      rollback: async () => {
        calls.push("tx:rollback");
      },
    },
  );

  const selected = await db.query("select * from memories where id = $1", [
    "row-1",
  ]);
  await db.query("BEGIN");
  await db.query("insert into memories(id) values($1)", ["row-2"]);
  await db.query("COMMIT");
  await db.query("ROLLBACK");

  const rows = JSON.stringify((selected as any).rows);
  if (rows !== JSON.stringify([{ id: "row-1" }])) {
    throw new Error("durable route executor must return SELECT rows");
  }
  if (calls[0] !== "all:select * from memories where id = $1:1") {
    throw new Error("durable route executor must use all_async for SELECT");
  }
  if (calls[1] !== "tx:begin") {
    throw new Error("durable route executor must use transaction.begin");
  }
  if (calls[2] !== "run:insert into memories(id) values($1):1") {
    throw new Error("durable route executor must use run_async for writes");
  }
  if (calls[3] !== "tx:commit") {
    throw new Error("durable route executor must use transaction.commit");
  }
  if (calls[4] !== "tx:rollback") {
    throw new Error("durable route executor must use transaction.rollback");
  }

  console.log("[V1] durable executor contract verified");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
