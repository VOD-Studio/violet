import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { captureEvent, validEvent } from "./events.mjs";
import { acknowledge, appendEvent, pendingCount, pendingEvents } from "./spool.mjs";

function configuration(root) {
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

export default function usageExtension(pi) {
  const root = join(homedir(), ".omp");
  const path = join(root, "violet-usage-spool");
  const notices = new Set();
  let context;
  let timer;
  let active;
  let controller;
  let stopped = false;
  let failures = 0;
  let retryAt = 0;
  let appended = false;

  function notice(code, text) {
    if (notices.has(code)) return;
    notices.add(code);
    try {
      context?.ui?.notify?.(text, "warning");
    } catch {
      // UI 已销毁时，通知失败不能把异步上传错误变成宿主崩溃。
    }
  }

  function loadConfiguration() {
    try {
      return configuration(root);
    } catch {
      notice("config", "用量上报已停用：请检查目标 URL 与 PAT 配置。");
      return undefined;
    }
  }

  async function deliver() {
    const config = loadConfiguration();
    if (!config) return;
    const pending = pendingEvents(path, config.destination, validEvent);
    if (pending.foreign) notice("foreign", "本地用量队列包含其他目标或 PAT 的记录，已保留且不会混发。恢复原配置后可继续上报。");
    if (pending.damaged) notice("damaged", "用量队列包含不完整或无效文件。有效事件仍会发送，无法识别的文件保留本地。");
    for (let offset = 0; offset < pending.events.length && !stopped; offset += 200) {
      // 每批重新核对，包括 await 返回后，避免配置切换时发送到另一目标。
      if (loadConfiguration()?.destination !== config.destination) return;
      const events = pending.events.slice(offset, offset + 200);
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10_000);
      timeout.unref?.();
      try {
        const response = await fetch(config.endpoint, {
          method: "POST",
          redirect: "error",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.pat}` },
          body: JSON.stringify({ events }),
          signal: controller.signal,
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error("Usage upload rejected");
        }
        const body = await response.json();
        const ack = body?.data;
        if (body?.error !== undefined || !Number.isSafeInteger(ack?.accepted) || !Number.isSafeInteger(ack?.duplicated)
          || ack.accepted < 0 || ack.duplicated < 0 || ack.accepted + ack.duplicated !== events.length) {
          throw new Error("Invalid usage acknowledgement");
        }
        acknowledge(path, config.destination, events.map((event) => event.client_event_id));
      } finally {
        clearTimeout(timeout);
        controller = undefined;
      }
    }
    failures = 0;
    retryAt = 0;
    const more = appended;
    appended = false;
    if (more && !stopped && pendingCount(path, config.destination) >= 50) await deliver();
  }

  function flush() {
    if (stopped || active || Date.now() < retryAt) return active ?? Promise.resolve();
    active = deliver().catch(() => {
      failures += 1;
      retryAt = Date.now() + Math.min(60_000 * 2 ** Math.min(failures - 1, 4), 900_000);
      notice("delivery", "用量上报未获确认，事件已保留在本地队列，将稍后重试。");
    }).finally(() => { active = undefined; });
    return active;
  }

  pi.on("session_start", (_event, ctx) => {
    context = ctx;
    stopped = false;
    if (timer) ctx.clearTimer(timer);
    timer = ctx.setInterval(() => flush(), 60_000);
    void flush();
  });

  pi.on("message_end", (event, ctx) => {
    context = ctx;
    // 宿主可能先发 shutdown 再中止生成；迟到的最终用量仍须落盘，但不重启发送。
    if (event.message?.role !== "assistant") return;
    const config = loadConfiguration();
    if (!config) return;
    const captured = captureEvent(event.message, ctx, pi.pi.VERSION);
    if (!captured) {
      notice("event", "当前用量快照不符合协议，未记录。请检查扩展与 OMP 版本的兼容性。");
      return;
    }
    try {
      appendEvent(path, config.destination, captured);
      appended = true;
      if (pendingCount(path, config.destination) >= 50) void flush();
    } catch {
      notice("disk", "用量事件未能可靠加入队列，请检查本地队列权限与剩余磁盘空间。");
      return;
    }
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    if (timer) ctx.clearTimer(timer);
    // 比宿主 2 秒的关闭预算提前 200 毫秒结束。
    let deadline;
    try {
      await Promise.race([
        flush(),
        new Promise((resolve) => { deadline = setTimeout(resolve, 1800); }),
      ]);
    } finally {
      stopped = true;
      clearTimeout(deadline);
      controller?.abort();
    }
  });
}
