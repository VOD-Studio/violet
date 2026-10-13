// 最小宿主:一个自带输入循环的 REPL,把右上角 4 行留给宠物。
import fs from "node:fs";
import readline from "node:readline";
import { initPet } from "@violetjs/pet";
import { mountTerminalPet } from "@violetjs/pet/terminal";

const wasm = fs.readFileSync(new URL("./node_modules/@violetjs/pet/dist/pet_wasm_bg.wasm", import.meta.url));
await initPet(wasm);

const rows = process.stdout.rows ?? 24;
const REGION = 4;
const tty = process.stdout.isTTY;
// 宿主职责:用滚动区域把自己的输出限制在宠物区域之下。
if (tty) process.stdout.write(`\x1b[${REGION + 1};${rows}r\x1b[${REGION + 1};1H`);

const pet = mountTerminalPet({
  region: { row: 1, col: Math.max(1, (process.stdout.columns ?? 40) - 11), width: 11, height: 3 },
  pet: { species: 1, genes: [37, 0, 0, 0, 0, 0, 0, 0] },
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "host> " });
let done = false;
const finish = (code) => {
  if (done) return;
  done = true;
  pet.dispose();
  if (tty) process.stdout.write(`\x1b[r\x1b[${rows};1H\n`);
  rl.close();
  process.exit(code);
};
rl.on("line", (l) => {
  if (l === "quit") return finish(0);
  console.log(`echo: ${l}`);
  rl.prompt();
});
rl.on("SIGINT", () => finish(0));
rl.on("close", () => finish(0));
process.on("SIGTERM", () => finish(0));
rl.prompt();
