import { host, snapshot } from "./harness.mjs";

const client = host({ session: process.argv[2], kind: "sub" });
await client.start();
process.send("ready");
await new Promise((resolve) => process.once("message", resolve));
for (let i = 0; i < 20; i++) client.emit(snapshot({ timestamp: 1_792_700_000_000 + i }));
// 故意跳过 session_shutdown：已完成的持久化必须能承受进程直接退出。
process.exit(0);
