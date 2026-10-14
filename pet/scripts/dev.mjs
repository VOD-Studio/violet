// 本地开发入口:不依赖 Violet,也能启动服务、模拟接入方签发断言并换取令牌。
// 用法: node scripts/dev.mjs <init|serve|assertion|token> [sub]
// 状态保存在 .dev/(已忽略):密钥、环境变量文件、SQLite 库。
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, ".dev");
const files = { env: path.join(dir, "env.json"), key: path.join(dir, "issuer.pem") };
const b64 = (b) => Buffer.from(b).toString("base64url");
const hex = () => crypto.randomBytes(32).toString("hex");

function init({ force = false } = {}) {
  if (!force && fs.existsSync(files.env)) return JSON.parse(fs.readFileSync(files.env, "utf8"));
  fs.mkdirSync(dir, { recursive: true });
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  fs.writeFileSync(files.key, privateKey.export({ format: "pem", type: "pkcs8" }), { mode: 0o600 });
  const pub = Buffer.from(publicKey.export({ format: "jwk" }).x, "base64url").toString("hex");
  // PET_DEV_TRUST_KEY:信任真实接入方(如本机 Violet)的公钥,而不是本脚本生成的模拟发行者。
  const trusted = process.env.PET_DEV_TRUST_KEY || pub;
  const env = {
    PET_LISTEN: "127.0.0.1:8787",
    PET_DB: path.join(dir, "pet.db"),
    PET_WORLD: "dev",
    PET_AUDIENCE: "pet-dev",
    PET_ISSUER_NAME: "pet-dev",
    PET_KID: "dev1",
    PET_SIGNING_SEED: hex(),
    PET_TOKEN_SECRET: hex(),
    PET_ELIGIBILITY_SECRET: hex(),
    PET_TRUSTED_ISSUERS: JSON.stringify([{ iss: "violet", keys: [{ kid: "v1", public_key: trusted, not_before: "0" }] }]),
  };
  fs.writeFileSync(files.env, JSON.stringify(env, null, 2));
  return env;
}

function assertion(sub) {
  if (!fs.existsSync(files.key)) throw new Error("先运行 `node scripts/dev.mjs init`");
  const env = init();
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iss: "violet", sub, aud: env.PET_AUDIENCE, kid: "v1", jti: crypto.randomUUID(), iat: now, exp: now + 120 }));
  const msg = Buffer.concat([Buffer.from("pet/assertion/v1\n"), payload]);
  const key = crypto.createPrivateKey(fs.readFileSync(files.key));
  return `v1.${b64(payload)}.${b64(crypto.sign(null, msg, key))}`;
}

const [cmd, arg] = process.argv.slice(2);
switch (cmd) {
  case "init": {
    const env = init({ force: arg === "--force" });
    console.log(`已写入 ${path.relative(root, dir)}/(监听 ${env.PET_LISTEN},世界 ${env.PET_WORLD},受众 ${env.PET_AUDIENCE})`);
    break;
  }
  case "serve": {
    const env = init();
    const child = spawn("cargo", ["run", "-q", "-p", "pet-service"], { cwd: root, env: { ...process.env, ...env }, stdio: "inherit" });
    child.on("exit", (code) => process.exit(code ?? 0));
    for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => child.kill(s));
    break;
  }
  case "assertion":
    console.log(assertion(arg || "alice"));
    break;
  case "token": {
    const env = init();
    const res = await fetch(`http://${env.PET_LISTEN}/v1/auth/exchange`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assertion: assertion(arg || "alice") }) });
    const body = await res.json();
    if (!body.ok) { console.error(JSON.stringify(body)); process.exit(1); }
    console.log(body.value.access_token);
    break;
  }
  default:
    console.error("用法: node scripts/dev.mjs <init [--force]|serve|assertion [sub]|token [sub]>");
    process.exit(2);
}
