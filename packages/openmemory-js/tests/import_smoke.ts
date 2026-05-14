import http from "node:http";

let listenCalls = 0;
const originalListen = http.Server.prototype.listen;

(http.Server.prototype.listen as any) = function patchedListen(...args: any[]) {
  listenCalls++;
  return originalListen.apply(this, args as any);
};

async function main() {
  await import("../src/index");

  if (listenCalls !== 0) {
    console.error(`FAIL: importing package started ${listenCalls} server listener(s)`);
    process.exit(1);
  }

  console.log("[IMPORT] package import did not start HTTP server");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
