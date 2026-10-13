#!/usr/bin/env node
// 解析当前平台的原生二进制包并转交执行;不存在时给出可操作的错误。
const { spawn } = require("node:child_process");
const key = `${process.platform}-${process.arch}`;
let bin;
try {
  bin = require.resolve(`@violet/pet-cli-${key}/bin/pet-cli`);
} catch {
  console.error(`pet-cli: no prebuilt binary for ${key}. Supported: see optionalDependencies of @violet/pet-cli; build from source with cargo otherwise.`);
  process.exit(1);
}
const child = spawn(bin, process.argv.slice(2), { stdio: "inherit" });
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 128 : 1)));
child.on("error", (e) => { console.error(`pet-cli: cannot start ${bin}: ${e.message}`); process.exit(1); });
