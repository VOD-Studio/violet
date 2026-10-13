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
const fx = JSON.parse(fs.readFileSync(new URL("./cert.json", import.meta.url)));
out.push(exec(JSON.stringify({ op: "verify_birth", ...fx })));
const bad = structuredClone(fx); bad.certificate.rarity = (bad.certificate.rarity + 1) % 5;
out.push(exec(JSON.stringify({ op: "verify_birth", ...bad })));
const bad2 = structuredClone(fx); bad2.certificate.client_seed = "00".repeat(32);
out.push(exec(JSON.stringify({ op: "verify_birth", ...bad2 })));
for (const [w, h, t, pose, cs] of [[40, 8, "0", "idle", "unicode"], [40, 8, "37", "idle", "ascii"], [20, 5, "1000003", "sick", "ascii"], [3, 2, "5", "sleep", "unicode"], [200, 60, "99", "idle", "ascii"]])
  out.push(exec(JSON.stringify({ op: "frame", species: 5, genes: [37, 1, 2, 3, 4, 5, 6, 7], pose, charset: cs, w, h, t })));
console.log(out.join("\n"));
