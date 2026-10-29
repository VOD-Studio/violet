import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const batchSize = 200;

export function configuration(root) {
  let file = {};
  try {
    file = JSON.parse(readFileSync(join(root, "omp-usage.json"), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw new Error("Invalid usage configuration");
  }
  const url = process.env.OMP_USAGE_URL ?? file.url;
  const pat = process.env.OMP_USAGE_PAT ?? file.pat;
  if (!url && !pat) return undefined;
  if (typeof url !== "string" || typeof pat !== "string" || !pat || /[\r\n]/.test(pat)) throw new Error("Incomplete usage configuration");
  const base = new URL(url);
  if (base.username || base.password || base.search || base.hash || !["https:", "http:"].includes(base.protocol)) throw new Error("Invalid usage URL");
  if (base.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Usage URL requires HTTPS");
  const endpoint = `${base.href.replace(/\/$/, "")}/api/v1/omp-usage/batch`;
  // 本机摘要同时绑定目标与凭据，不上传。切换 PAT 不能把旧账号队列发给新账号。
  const destination = createHash("sha256").update(JSON.stringify([endpoint, pat])).digest("hex");
  return { endpoint, pat, destination };
}

// 只在服务端确认 accepted + duplicated 恰好覆盖整批时返回，调用方据此才可删除本地记录。
export async function uploadBatch(config, events, signal) {
  const response = await fetch(config.endpoint, {
    method: "POST",
    redirect: "error",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.pat}` },
    body: JSON.stringify({ events }),
    signal,
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw Object.assign(new Error("Usage upload rejected"), { status: response.status });
  }
  const body = await response.json();
  const ack = body?.data;
  if (body?.error !== undefined || !Number.isSafeInteger(ack?.accepted) || !Number.isSafeInteger(ack?.duplicated)
    || ack.accepted < 0 || ack.duplicated < 0 || ack.accepted + ack.duplicated !== events.length) {
    throw new Error("Invalid usage acknowledgement");
  }
  return ack;
}
