// 用法: node run.mjs native|wasm  —— 输出完整转录,三端逐字节比较
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const mode = process.argv[2];
const steps = JSON.parse(fs.readFileSync(new URL("./steps.json", import.meta.url)));
let exec;
if (mode === "native") {
  exec = (line) => execFileSync("../target/release/pet-cli", { input: line + "\n", cwd: new URL(".", import.meta.url).pathname }).toString().trim();
} else {
  const m = await import(process.argv[3]);
  exec = m.execute;
}
const birth = { op: "birth", world: "w1", request_id: "r1", server_seed: "aa".repeat(32), client_seed: "bb".repeat(32), born_at: "0" };
const out = [];
let r = exec(JSON.stringify(birth)); out.push(r);
let pet = JSON.parse(r).value.pet;
for (const [, s] of steps) {
  r = exec(JSON.stringify({ op: "act", pet, ...s })); out.push(r);
  const j = JSON.parse(r);
  if (j.ok) pet = j.value.pet;
}
console.log(out.join("\n"));
