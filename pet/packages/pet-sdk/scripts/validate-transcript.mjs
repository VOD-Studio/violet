// 用真实三端转录校验 schema:每行响应必须符合对应 op 的结果类型或错误信封。
import fs from "node:fs";
import Ajv from "ajv/dist/2020.js";

const schema = JSON.parse(fs.readFileSync(new URL("../schema/pet.schema.json", import.meta.url)));
const ajv = new Ajv({ strict: false, validateFormats: false });
ajv.addSchema(schema, "pet");
const check = (name) => ajv.getSchema(`pet#/$defs/${name}`);

const transcript = fs.readFileSync(new URL("../../../target/out-native.txt", import.meta.url), "utf8").trim().split("\n");
const ops = ["birth", ...JSON.parse(fs.readFileSync(new URL("../../../scenario/steps.json", import.meta.url))).map(() => "act"), "verify_birth", "verify_birth", "verify_birth", ...Array(5).fill("frame"), ...Array(6).fill("sprite"), "grant", "evolution_options", "act", "capabilities"];
if (ops.length !== transcript.length) throw new Error(`op count ${ops.length} != transcript ${transcript.length}`);

let n = 0;
transcript.forEach((line, i) => {
  const j = JSON.parse(line);
  const validate = j.ok ? check(schema["x-op-results"][ops[i]]) : check("ErrorBody");
  if (!validate(j)) throw new Error(`line ${i} (${ops[i]}) violates schema: ${ajv.errorsText(validate.errors)}`);
  n++;
});

// 输入侧:场景里发出的命令也必须符合 Command。
const cmd = check("Command");
const fx = JSON.parse(fs.readFileSync(new URL("../../../scenario/cert.json", import.meta.url)));
const inputs = [
  { op: "birth", world: "w1", request_id: "r1", server_seed: "aa".repeat(32), client_seed: "bb".repeat(32), born_at: "0" },
  { op: "verify_birth", ...fx },
  { op: "capabilities" },
  { op: "evolution_options", pet: JSON.parse(transcript[0]).value.pet },
  { op: "frame", species: 5, genes: [1, 2, 3, 4, 5, 6, 7, 8], pose: "idle", charset: "ascii", w: 10, h: 4, t: "0" },
  { op: "sprite", species: 5, genes: [1, 2, 3, 4, 5, 6, 7, 8], pose: "idle", stage: 1, w: 14, h: 16, t: "0" },
];
for (const c of inputs) if (!cmd(c)) throw new Error(`${c.op} input violates Command: ${ajv.errorsText(cmd.errors)}`);
const bad = { op: "frame", species: 5, genes: [1], pose: "idle", charset: "ascii", w: 10, h: 4, t: 0 };
if (cmd(bad)) throw new Error("Command schema accepted an invalid frame input");
const badSprite = { op: "sprite", species: 5, genes: [1, 2, 3, 4, 5, 6, 7, 8], pose: "idle", stage: "adult", w: 14, h: 16, t: "0" };
if (cmd(badSprite)) throw new Error("Command schema accepted a non-numeric sprite stage");
console.log(`schema OK: ${n} responses and ${inputs.length} inputs validated; invalid input rejected`);
