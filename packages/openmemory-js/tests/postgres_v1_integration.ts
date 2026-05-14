async function main() {
  const connectionString = process.env.OM_TEST_POSTGRES_URL;
  if (!connectionString) {
    console.log("[POSTGRES V1] skipped: OM_TEST_POSTGRES_URL not set");
    return;
  }

  const { runPostgresV1Integration } = await import("./support/postgres_v1");
  await runPostgresV1Integration(connectionString);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
