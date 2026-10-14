// 端到端：真实的 pet-service 二进制 + 真实 HTTP + 重启 + 用 WebAssembly 验证器核验证书。
// 用法: node service-e2e.mjs <二进制路径> <数据库(SQLite 路径或 Postgres 连接串)>
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const [bin, db] = process.argv.slice(2);
const { execute } = createRequire(import.meta.url)("../target/pkg-node/pet_wasm.js");

// 扮演 Violet：持有断言签名密钥。
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
const violetPub = Buffer.from(publicKey.export({ format: "jwk" }).x, "base64url").toString("hex");
const b64 = (b) => Buffer.from(b).toString("base64url");
let jti = 0;
function assertion(sub, now = Math.floor(Date.now() / 1000)) {
  const payload = Buffer.from(JSON.stringify({ iss: "violet", sub, aud: "pet-e2e", kid: "v1", jti: `j${Date.now()}-${jti++}`, iat: now, exp: now + 120 }));
  const msg = Buffer.concat([Buffer.from("pet/assertion/v1\n"), payload]);
  return `v1.${b64(payload)}.${b64(crypto.sign(null, msg, privateKey))}`;
}

const port = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PET_LISTEN: `127.0.0.1:${port}`, PET_DB: db, PET_WORLD: "e2e", PET_AUDIENCE: "pet-e2e", PET_ISSUER_NAME: "pet-service", PET_KID: "p1",
  PET_SIGNING_SEED: crypto.randomBytes(32).toString("hex"), PET_TOKEN_SECRET: crypto.randomBytes(32).toString("hex"), PET_ELIGIBILITY_SECRET: crypto.randomBytes(32).toString("hex"),
  PET_TRUSTED_ISSUERS: JSON.stringify([{ iss: "violet", keys: [{ kid: "v1", public_key: violetPub, not_before: "0" }] }]),
};

let child;
async function start() {
  child = spawn(bin, [], { env, stdio: ["ignore", "ignore", "pipe"] });
  let err = "";
  child.stderr.on("data", (d) => (err += d));
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/healthz`)).ok) return; } catch {}
    if (child.exitCode !== null) throw new Error(`service exited: ${err}`);
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`service did not start: ${err}`);
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGINT");
  await new Promise((r) => child.once("exit", r));
}
async function api(method, path, token, body) {
  const r = await fetch(base + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const login = async (sub) => (await api("POST", "/v1/auth/exchange", null, { assertion: assertion(sub) })).body.value.access_token;

try {
  await start();
  const alice = await login("alice");
  const bob = await login("bob");

  // 领取：承诺 → （重启）→ 接受
  const created = await api("POST", "/v1/births", alice);
  assert.equal(created.status, 201);
  const id = created.body.value.request_id;
  await stop();
  await start();
  const alice2 = await login("alice"); // 令牌无状态，重启前后都有效；重新登录只是为了换一枚新断言
  assert.equal((await api("GET", "/v1/pets/me", alice, undefined)).status, 404, "token from before the restart still authenticates");
  const clientSeed = crypto.randomBytes(32).toString("hex");
  const accepted = await api("POST", `/v1/births/${id}/accept`, alice2, { client_seed: clientSeed });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  const cert = accepted.body.value.certificate;
  assert.equal(cert.commitment, created.body.value.commitment, "the reveal matches the commitment published before the restart");

  // 证书由 WebAssembly 验证器核验——与服务端是两套独立的编译产物。
  const keys = (await api("GET", "/v1/issuer-keys")).body.value;
  const verdict = (c) => JSON.parse(execute(JSON.stringify({ op: "verify_birth", certificate: c, issuer_keys: keys })));
  assert.deepEqual(verdict(cert), { ok: true, value: "valid" });
  assert.equal(verdict({ ...cert, rarity: (cert.rarity + 1) % 5 }).value, "result_mismatch");
  assert.equal(verdict({ ...cert, client_seed: "00".repeat(32) }).value, "accept_signature");

  // 动作与幂等
  const feed = { action: "feed", request_id: "e2e-1" };
  const a1 = await api("POST", "/v1/pets/me/actions", alice2, feed);
  const a2 = await api("POST", "/v1/pets/me/actions", alice2, feed);
  assert.equal(a1.status, 200);
  assert.deepEqual(a2.body, a1.body, "a retry returns the stored result");
  assert.equal((await api("GET", "/v1/pets/me", alice2)).body.value.pet.food, 4);

  // 隔离
  assert.equal((await api("GET", "/v1/pets/me", bob)).status, 404);
  assert.equal((await api("GET", `/v1/births/${id}`, bob)).status, 404);

  // 重启后状态仍在
  await stop();
  await start();
  const after = await api("GET", "/v1/pets/me", alice2);
  assert.equal(after.body.value.pet.food, 4);
  assert.equal(after.body.value.pet.id, cert.id);
  console.log(`PASS: service e2e on ${db.startsWith("postgres") || db.includes("host=") ? "postgres" : "sqlite"} — adopt across a restart, wasm-verified certificate, idempotent action, isolation`);
} finally {
  await stop();
}
