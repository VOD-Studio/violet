import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { setTimeout as sleep } from "node:timers/promises";

import { captureEvent } from "./events.mjs";
import { batchSize, uploadBatch } from "./transport.mjs";

async function* sessionFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* sessionFiles(path);
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) yield path;
  }
}

// 只保留 captureEvent 读取的字段，避免把消息正文留在内存中。
function slim(message) {
  const { role, provider, model, timestamp, completedAt, responseId, stopReason, usage, duration, ttft } = message;
  return { role, provider, model, timestamp, completedAt, responseId, stopReason, usage, duration, ttft };
}

// 子代理会话由 session_init.agent 标识，可能出现在其首条消息之后，因此整份文件读完才判定。
async function readSession(path) {
  let id;
  let subagent = false;
  let version;
  const messages = [];
  const lines = createInterface({ input: createReadStream(path, "utf8"), crlfDelay: Infinity });
  for await (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      // 正在写入的末行或损坏行不影响其余记录。
      continue;
    }
    if (entry?.type === "session" && typeof entry.id === "string") id ??= entry.id;
    if (typeof entry?.runtime?.version === "string") version = entry.runtime.version;
    if (entry?.type === "session_init" && typeof entry.agent === "string") subagent = true;
    if (entry?.type === "message" && entry.message?.role === "assistant") messages.push({ message: slim(entry.message), version });
  }
  return { id, subagent, messages };
}

export async function* sessionEvents(directory, stats) {
  for await (const path of sessionFiles(directory)) {
    const { id, subagent, messages } = await readSession(path);
    stats.files += 1;
    const context = { sessionManager: { getSessionId: () => id }, agent: { kind: subagent ? "sub" : "main" } };
    for (const { message, version } of messages) {
      stats.messages += 1;
      const event = id === undefined ? undefined : captureEvent(message, context, version);
      if (event) yield event;
      else stats.skipped += 1;
    }
  }
}

/**
 * 扫描历史会话并（apply 时）分批上传。事件由实时采集同一函数生成，id 相同，
 * 服务端按 id 去重，因此可重复执行。失败时停止并把原因放入 stats.failure。
 */
export async function backfill(config, { directory, apply, signal, pause = 1100 }) {
  const stats = { files: 0, messages: 0, skipped: 0, events: 0, accepted: 0, duplicated: 0, first: undefined, last: undefined, failure: undefined };
  const seen = new Set();
  let batch = [];
  let sent = 0;

  async function send() {
    const events = batch;
    batch = [];
    // 上报接口按用户每分钟限流 60 次，批间留出间隔让实时上报仍有余量。
    if (sent > 0) await sleep(pause, undefined, { signal });
    const ack = await uploadBatch(config, events, AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(10_000)]));
    sent += 1;
    stats.accepted += ack.accepted;
    stats.duplicated += ack.duplicated;
  }

  try {
    for await (const event of sessionEvents(directory, stats)) {
      if (seen.has(event.client_event_id)) continue;
      seen.add(event.client_event_id);
      stats.events += 1;
      if (stats.first === undefined || event.occurred_at < stats.first) stats.first = event.occurred_at;
      if (stats.last === undefined || event.occurred_at > stats.last) stats.last = event.occurred_at;
      if (!apply) continue;
      batch.push(event);
      if (batch.length === batchSize) await send();
    }
    if (batch.length > 0) await send();
  } catch (error) {
    stats.failure = error;
  }
  return stats;
}
