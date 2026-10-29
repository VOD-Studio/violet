import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { backfill } from "../backfill.mjs";
import { configuration } from "../transport.mjs";
import { environment, host, snapshot } from "./harness.mjs";

const command = "violet-usage-backfill";

async function session(env, path, { id, version = "18.12.1", subagent = false, messages = [], tail = "" }) {
  const file = join(env.home, ".omp", "agent", "sessions", path);
  await mkdir(join(file, ".."), { recursive: true });
  const lines = [
    { type: "title", v: 1, title: "", pad: " ".repeat(200) },
    { type: "session", version: 3, id, timestamp: "2026-10-20T00:00:00.000Z", cwd: "/work" },
    { type: "thinking_level_change", id: "a0", parentId: null, runtime: { version }, thinkingLevel: "high" },
    ...(subagent ? [{ type: "session_init", id: "a1", parentId: "a0", agent: "task", task: "x" }] : []),
    { type: "message", id: "u1", parentId: null, message: { role: "user", content: "PRIVATE" } },
    ...messages.map((message, index) => ({ type: "message", id: `m${index}`, parentId: "u1", runtime: { version }, message })),
  ];
  await writeFile(file, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n${tail}`);
}

test("backfilled events match live capture byte for byte, so the server deduplicates them", async (t) => {
  const env = await environment(t);
  const live = host({ session: "s-main" });
  await live.start();
  const message = snapshot();
  live.emit(message);
  await live.tick();
  const liveEvent = env.requests[0].body.events[0];
  await session(env, "-work/a.jsonl", { id: "s-main", messages: [message] });
  await live.command(command, "apply");
  assert.equal(env.requests.length, 2);
  assert.deepEqual(env.requests[1].body.events, [liveEvent]);
  assert.match(live.notices.at(-1), /新增 0、已存在 1/);
  assert.equal((await env.files()).length, 0);
  await live.shutdown();
});

test("subagent sessions are marked even when session_init follows the first message", async (t) => {
  const env = await environment(t);
  const client = host();
  await client.start();
  await session(env, "-work/main.jsonl", { id: "s-main", messages: [snapshot()] });
  await session(env, "-work/nested/sub.jsonl", { id: "s-sub", subagent: true, messages: [snapshot({ timestamp: 1_792_700_100_000 })] });
  await client.command(command, "apply");
  const flags = env.requests[0].body.events.map((event) => event.is_subagent).sort();
  assert.deepEqual(flags, [false, true]);
});

test("without apply nothing is sent and the notice names the target and count", async (t) => {
  const env = await environment(t);
  const client = host();
  await client.start();
  await session(env, "-work/a.jsonl", { id: "s1", messages: [snapshot(), snapshot({ timestamp: 1_792_700_100_000 })] });
  await client.command(command);
  assert.equal(env.requests.length, 0);
  assert.match(client.notices.at(-1), /2 条可上报.*127\.0\.0\.1/);
});

test("partial last lines, non-assistant entries and unusable snapshots are skipped without aborting", async (t) => {
  const env = await environment(t);
  const client = host();
  await client.start();
  await session(env, "-work/a.jsonl", {
    id: "s1",
    messages: [snapshot(), snapshot({ timestamp: 1_792_700_100_000, usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, cost: {} } })],
    tail: '{"type":"message","message":{"role":"assist',
  });
  await client.command(command, "apply");
  assert.equal(env.requests[0].body.events.length, 1);
  assert.match(client.notices.at(-1), /新增 1、已存在 0，共 1 条/);
});

test("large histories upload in batches of at most 200 and stop at the first rejection", async (t) => {
  const env = await environment(t);
  const messages = Array.from({ length: 450 }, (_, index) => snapshot({ timestamp: 1_792_700_000_000 + index }));
  await session(env, "-work/a.jsonl", { id: "s1", messages });
  const config = configuration(join(env.home, ".omp"));
  const complete = await backfill(config, { directory: join(env.home, ".omp", "agent", "sessions"), apply: true, pause: 0 });
  assert.deepEqual(env.requests.map((request) => request.body.events.length), [200, 200, 50]);
  assert.equal(complete.accepted, 450);

  env.requests.length = 0;
  env.setResponder((_request, response) => { response.statusCode = 429; response.end("{}"); });
  const rejected = await backfill(config, { directory: join(env.home, ".omp", "agent", "sessions"), apply: true, pause: 0 });
  assert.equal(env.requests.length, 1);
  assert.equal(rejected.failure.status, 429);
  assert.equal(rejected.accepted, 0);
});

test("a rejected upload is reported with its status and does not leak the PAT", async (t) => {
  const env = await environment(t, { respond: (_request, response) => { response.statusCode = 500; response.end("{}"); } });
  const client = host();
  await client.start();
  await session(env, "-work/a.jsonl", { id: "s1", messages: [snapshot()] });
  await client.command(command, "apply");
  assert.match(client.notices.at(-1), /中断（HTTP 500）/);
  assert.doesNotMatch(client.notices.join("\n"), /private-test-pat/);
});

test("unconfigured usage and unknown arguments are refused without reading sessions", async (t) => {
  const env = await environment(t);
  const client = host();
  await client.start();
  await client.command(command, "apply now");
  assert.match(client.notices.at(-1), /用法/);
  delete process.env.OMP_USAGE_URL;
  delete process.env.OMP_USAGE_PAT;
  await client.command(command, "apply");
  assert.match(client.notices.at(-1), /未配置/);
  assert.equal(env.requests.length, 0);
});
