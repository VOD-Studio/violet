import { homedir } from "node:os";
import { join } from "node:path";

import { backfill } from "./backfill.mjs";
import { captureEvent, validEvent } from "./events.mjs";
import { acknowledge, appendEvent, pendingCount, pendingEvents } from "./spool.mjs";
import { configuration, batchSize, uploadBatch } from "./transport.mjs";

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
  let backfilling;

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
    for (let offset = 0; offset < pending.events.length && !stopped; offset += batchSize) {
      // 每批重新核对，包括 await 返回后，避免配置切换时发送到另一目标。
      if (loadConfiguration()?.destination !== config.destination) return;
      const events = pending.events.slice(offset, offset + batchSize);
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10_000);
      timeout.unref?.();
      try {
        await uploadBatch(config, events, controller.signal);
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
      backfilling?.abort();
    }
  });

  pi.registerCommand("violet-usage-backfill", {
    description: "补传本机历史会话的用量；不带参数仅预览，apply 才上传",
    handler: async (args, ctx) => {
      context = ctx;
      const mode = args.trim();
      if (mode !== "" && mode !== "apply") return ctx.ui.notify("用法：/violet-usage-backfill [apply]", "warning");
      if (backfilling) return ctx.ui.notify("历史用量补传正在进行。", "warning");
      let config;
      try {
        config = configuration(root);
      } catch {
        // 无效配置按未配置处理。
      }
      if (!config) return ctx.ui.notify("用量上报未配置或配置无效：请检查目标 URL 与 PAT。", "warning");
      const apply = mode === "apply";
      backfilling = new AbortController();
      try {
        const stats = await backfill(config, { directory: join(process.env.PI_CODING_AGENT_DIR ?? join(root, "agent"), "sessions"), apply, signal: backfilling.signal });
        const range = stats.first ? `，${stats.first.slice(0, 10)} 至 ${stats.last.slice(0, 10)}` : "";
        const target = new URL(config.endpoint).host;
        if (stats.failure) {
          const reason = stats.failure.status ? `HTTP ${stats.failure.status}` : stats.failure.message;
          ctx.ui.notify(`历史用量补传中断（${reason}）：已新增 ${stats.accepted}、已存在 ${stats.duplicated}。可重新运行继续，重复事件会被忽略。`, "warning");
        } else if (apply) {
          ctx.ui.notify(`历史用量补传完成：新增 ${stats.accepted}、已存在 ${stats.duplicated}，共 ${stats.events} 条${range}。`, "info");
        } else {
          ctx.ui.notify(`历史用量预览：${stats.files} 个会话中有 ${stats.events} 条可上报（跳过 ${stats.skipped} 条）${range}。运行 /violet-usage-backfill apply 上传到 ${target}。`, "info");
        }
      } finally {
        backfilling = undefined;
      }
    },
  });
}
