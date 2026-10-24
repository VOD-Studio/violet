import assert from "node:assert/strict";
import { fork, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { environment, host, snapshot, until } from "./harness.mjs";

const expectedKeys = ["client_event_id", "provider", "model", "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens", "reasoning_tokens", "cost_total", "stop_reason", "is_error", "duration_ms", "ttft_ms", "is_subagent", "omp_version", "occurred_at"].sort();

test("public factory records detached assistant snapshots with a strict privacy allowlist", async (t) => {
  const env = await environment(t);
  const client = host({ kind: "sub" });
  await client.start();
  client.emit({ role: "user", content: "secret" });
  client.emit({ role: "toolResult", content: "secret" });
  assert.equal((await env.files()).length, 0);
  const message = snapshot();
  Object.defineProperty(message, "content", { get() { throw new Error("Content must not be read"); } });
  assert.equal(client.emit(message), undefined);
  const files = await env.files();
  assert.equal(files.length, 1);
  assert.equal((await stat(files[0].path)).mode & 0o777, 0o600);
  assert.deepEqual(Object.keys(JSON.parse(files[0].content)).sort(), expectedKeys);
  assert.doesNotMatch(files[0].content, /PRIVATE|private-session|private-response|private-test-pat|credentialId|totalTokens/);
  await client.tick();
  assert.equal((await env.files()).length, 0);
  assert.equal(env.requests.length, 1);
  const sent = env.requests[0];
  assert.equal(sent.url, "/api/v1/omp-usage/batch");
  assert.equal(sent.authorization, "Bearer private-test-pat");
  const event = sent.body.events[0];
  assert.deepEqual(Object.keys(event).sort(), expectedKeys);
  assert.match(event.client_event_id, /^[a-f0-9]{64}$/);
  assert.equal(event.is_subagent, true);
  assert.equal(event.omp_version, "18.12.1");
  assert.equal(event.reasoning_tokens, 10);
  assert.equal(event.input_tokens, 100);
  assert.equal(event.duration_ms, 2000);
  assert.equal(event.ttft_ms, 500);
  assert.equal(event.cost_total, 0.002);
  await client.shutdown();
});

test("missing timing stays null; errors and unknown reasoning are represented honestly", async (t) => {
  const env = await environment(t);
  const client = host();
  await client.start();
  const message = snapshot({ stopReason: "aborted", duration: undefined, ttft: undefined });
  delete message.usage.reasoningTokens;
  client.emit(message);
  await client.shutdown();
  const event = env.requests[0].body.events[0];
  assert.equal(event.duration_ms, null);
  assert.equal(event.ttft_ms, null);
  assert.equal(event.reasoning_tokens, 0);
  assert.equal(event.is_error, true);
  assert.equal(event.is_subagent, false);
});

test("offline capture survives a fresh factory and replay uses the same opaque identity", async (t) => {
  const env = await environment(t, { respond: (_request, res) => res.destroy() });
  const first = host();
  await first.start();
  first.emit(snapshot());
  await first.tick();
  const persisted = (await env.files())[0].content;
  assert.equal(JSON.parse(persisted).client_event_id, env.requests[0].body.events[0].client_event_id);
  await first.shutdown();
  env.setResponder(undefined);
  const second = host();
  await second.start();
  assert.equal((await env.files()).length, 0);
  second.emit(structuredClone(snapshot()));
  await second.tick();
  assert.equal(env.seen.size, 1);
  assert.equal(env.requests.at(-1).body.events[0].client_event_id, JSON.parse(persisted).client_event_id);
  await second.shutdown();
});

test("aborted message after shutdown stays durable without restarting delivery", async (t) => {
  const env = await environment(t);
  const first = host();
  await first.start();
  await first.shutdown();
  first.emit(snapshot({ stopReason: "aborted" }));
  const files = await env.files();
  assert.equal(files.length, 1);
  const pending = JSON.parse(files[0].content);
  assert.equal(pending.is_error, true);
  assert.equal(pending.stop_reason, "aborted");
  assert.equal(env.requests.length, 0);
  const second = host();
  await second.start();
  assert.equal((await env.files()).length, 0);
  assert.equal(env.requests[0].body.events[0].client_event_id, pending.client_event_id);
  assert.equal(env.seen.size, 1);
  await second.shutdown();
});

test("fifty queued events trigger async delivery without awaiting the HTTP request", async (t) => {
  let release;
  const env = await environment(t, { respond: (request, res) => { release = () => res.end(JSON.stringify({ data: { accepted: request.body.events.length, duplicated: 0 } })); } });
  const client = host();
  await client.start();
  for (let i = 0; i < 49; i++) assert.equal(client.emit(snapshot({ timestamp: 1_792_700_000_000 + i })), undefined);
  assert.equal(env.requests.length, 0);
  assert.equal(client.emit(snapshot({ timestamp: 1_792_700_000_049 })), undefined);
  await until(() => Boolean(release));
  assert.equal(env.requests[0].body.events.length, 50);
  assert.equal((await env.files()).length, 50);
  release();
  await client.tick();
  assert.equal((await env.files()).length, 0);
  await client.shutdown();
});

test("acknowledging a batch never removes another factory's concurrent append", async (t) => {
  let release;
  const env = await environment(t, { respond: (request, res) => { release = () => res.end(JSON.stringify({ data: { accepted: request.body.events.length, duplicated: 0 } })); } });
  const main = host();
  const sub = host({ kind: "sub", session: "another-session" });
  await main.start();
  await sub.start();
  main.emit(snapshot());
  const sending = main.tick();
  await until(() => Boolean(release));
  sub.emit(snapshot({ timestamp: 1_792_700_000_010 }));
  release();
  await sending;
  const remaining = await env.files();
  assert.equal(remaining.length, 1);
  assert.equal(JSON.parse(remaining[0].content).is_subagent, true);
  env.setResponder(undefined);
  await sub.tick();
  assert.equal((await env.files()).length, 0);
  await main.shutdown();
  await sub.shutdown();
});

test("invalid acknowledgements never delete pending events", async (t) => {
  const responses = [
    [500, { data: { accepted: 1, duplicated: 0 } }],
    [200, {}],
    [200, { data: { accepted: 0, duplicated: 0 } }],
    [200, { data: { accepted: -1, duplicated: 2 } }],
    [200, { data: { accepted: 0.5, duplicated: 0.5 } }],
    [200, { data: { accepted: "1", duplicated: 0 } }],
    [200, { error: "REJECTED", data: { accepted: 1, duplicated: 0 } }],
  ];
  for (const [status, body] of responses) {
    await t.test(`${status} ${JSON.stringify(body)}`, async (child) => {
      const env = await environment(child, { respond: (_req, res) => { res.statusCode = status; res.end(JSON.stringify(body)); } });
      const client = host();
      await client.start();
      client.emit(snapshot());
      await client.tick();
      assert.equal((await env.files()).length, 1);
      await client.tick();
      assert.equal(env.requests.length, 1, "backoff suppresses immediate retry");
      await client.shutdown();
    });
  }
});

test("backoff recovers in the same lifecycle when the next interval becomes eligible", async (t) => {
  const env = await environment(t, { respond: (_req, res) => { res.statusCode = 503; res.end("offline"); } });
  const client = host();
  await client.start();
  client.emit(snapshot());
  await client.tick();
  assert.equal((await env.files()).length, 1);
  env.setResponder(undefined);
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() + 61_000 });
  await client.tick();
  assert.equal((await env.files()).length, 0);
  assert.equal(env.requests.length, 2);
  await client.shutdown();
});

test("changing PAT or destination retains old queue and does not cross-upload accounts", async (t) => {
  const env = await environment(t);
  const client = host();
  await client.start();
  client.emit(snapshot());
  process.env.OMP_USAGE_PAT = "different-account-pat";
  client.emit(snapshot({ timestamp: 1_792_700_000_010 }));
  await client.tick();
  assert.equal(env.requests.length, 1);
  assert.equal(env.requests[0].authorization, "Bearer different-account-pat");
  assert.equal(env.requests[0].body.events.length, 1);
  assert.equal((await env.files()).length, 1);
  process.env.OMP_USAGE_PAT = "private-test-pat";
  const originalUrl = process.env.OMP_USAGE_URL;
  process.env.OMP_USAGE_URL = `${originalUrl}/different-site`;
  await client.tick();
  assert.equal(env.requests.length, 1);
  process.env.OMP_USAGE_URL = originalUrl;
  await client.tick();
  assert.equal((await env.files()).length, 0);
  assert.equal(env.requests[1].authorization, "Bearer private-test-pat");
  await client.shutdown();
});

test("JSON configuration works and environment fields take precedence", async (t) => {
  const env = await environment(t);
  await env.config({ url: process.env.OMP_USAGE_URL, pat: "json-config-pat" });
  delete process.env.OMP_USAGE_URL;
  delete process.env.OMP_USAGE_PAT;
  const client = host();
  await client.start();
  client.emit(snapshot());
  await client.tick();
  assert.equal(env.requests[0].authorization, "Bearer json-config-pat");
  process.env.OMP_USAGE_PAT = "env-config-pat";
  client.emit(snapshot({ timestamp: 1_792_700_000_010 }));
  await client.tick();
  assert.equal(env.requests[1].authorization, "Bearer env-config-pat");
  await client.shutdown();
});

test("unconfigured or insecure targets do not collect or transmit events", async (t) => {
  const env = await environment(t);
  delete process.env.OMP_USAGE_URL;
  delete process.env.OMP_USAGE_PAT;
  const client = host();
  await client.start();
  client.emit(snapshot());
  process.env.OMP_USAGE_URL = "http://example.org";
  process.env.OMP_USAGE_PAT = "secret";
  client.emit(snapshot());
  await client.tick();
  assert.equal((await env.files()).length, 0);
  assert.equal(env.requests.length, 0);
  assert.ok(client.notices.length > 0);
  assert.ok(client.notices.every((notice) => !notice.includes("secret")));
  await client.shutdown();
});

test("corrupt or expanded spool payload is preserved locally rather than leaked", async (t) => {
  const env = await environment(t);
  const client = host();
  await client.start();
  client.emit(snapshot());
  const [file] = await env.files();
  const injected = { ...JSON.parse(file.content), prompt: "private injected data" };
  await writeFile(file.path, `${JSON.stringify(injected)}\n`);
  await client.tick();
  assert.equal(env.requests.length, 0);
  assert.equal(await readFile(file.path, "utf8"), `${JSON.stringify(injected)}\n`);
  await client.shutdown();
});

test("shutdown is bounded below the host deadline and preserves an unacknowledged request", async (t) => {
  const env = await environment(t, { respond: () => {} });
  const client = host();
  await client.start();
  client.emit(snapshot());
  const started = performance.now();
  await client.shutdown();
  assert.ok(performance.now() - started < 2000);
  assert.equal((await env.files()).length, 1);
});

test("simultaneous processes append safely, survive abrupt exit, and recover all events", { timeout: 10_000 }, async (t) => {
  const env = await environment(t);
  const children = ["process-a", "process-b"].map((session) => fork(fileURLToPath(new URL("./writer.mjs", import.meta.url)), [session], { env: process.env, stdio: ["ignore", "ignore", "pipe", "ipc"] }));
  t.after(() => { for (const child of children) if (child.exitCode === null) child.kill(); });
  const completed = Promise.all(children.map((child) => new Promise((resolve, reject) => {
    let error = "";
    child.stderr.on("data", (chunk) => { error += chunk; });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(error)));
  })));
  await Promise.all(children.map((child) => new Promise((resolve, reject) => {
    child.once("message", resolve);
    child.once("error", reject);
    child.once("exit", (code) => { if (code !== 0) reject(new Error("Writer exited before ready")); });
  })));
  for (const child of children) child.send("append");
  await completed;
  assert.equal((await env.files()).length, 40);
  const client = host();
  await client.start();
  assert.equal((await env.files()).length, 0);
  assert.equal(env.seen.size, 40);
  await client.shutdown();
});

test("HTTP redirects never forward the PAT or acknowledge pending events", async (t) => {
  const env = await environment(t, { respond: (_req, res) => {
    res.statusCode = 307;
    res.setHeader("Location", "/credential-leak");
    res.end();
  } });
  const client = host();
  await client.start();
  client.emit(snapshot());
  await client.tick();
  assert.equal(env.requests.length, 1);
  assert.equal(env.requests[0].url, "/api/v1/omp-usage/batch");
  assert.equal((await env.files()).length, 1);
  await client.shutdown();
});

test("concurrent duplicate uploads are harmless and large backlogs stay within 200 events", async (t) => {
  let release;
  const env = await environment(t, { respond: (request, res) => {
    release = () => res.end(JSON.stringify({ data: { accepted: request.body.events.length, duplicated: 0 } }));
  } });
  const client = host();
  await client.start();
  for (let i = 0; i < 50; i++) client.emit(snapshot({ timestamp: 1_792_700_000_000 + i }));
  await until(() => Boolean(release));
  for (let i = 50; i < 280; i++) client.emit(snapshot({ timestamp: 1_792_700_000_000 + i }));
  env.setResponder(undefined);
  release();
  await client.tick();
  assert.equal((await env.files()).length, 0);
  assert.equal(env.requests.reduce((count, request) => count + request.body.events.length, 0), 280);
  assert.ok(env.requests.every((request) => request.body.events.length <= 200));
  const other = host();
  await other.start();
  const replay = snapshot({ timestamp: 1_792_700_000_100 });
  client.emit(replay);
  other.emit(structuredClone(replay));
  await Promise.all([client.tick(), other.tick()]);
  assert.equal((await env.files()).length, 0);
  assert.equal(env.seen.size, 230);
  await client.shutdown();
  await other.shutdown();
});

test("complete temporary files from dead processes recover, while live writers remain untouched", async (t) => {
  const env = await environment(t);
  const client = host();
  await client.start();
  client.emit(snapshot());
  const [file] = await env.files();
  const id = JSON.parse(file.content).client_event_id;
  const liveTemporary = join(dirname(file.path), `.${process.pid}-${randomUUID()}-${id}.tmp`);
  await rename(file.path, liveTemporary);
  await client.tick();
  assert.equal(env.requests.length, 0);
  assert.equal((await env.files()).length, 1);
  const exited = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  await new Promise((resolve, reject) => {
    exited.once("error", reject);
    exited.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Child failed")));
  });
  const deadTemporary = join(dirname(file.path), `.${exited.pid}-${randomUUID()}-${id}.tmp`);
  await rename(liveTemporary, deadTemporary);
  await client.tick();
  assert.equal(env.requests.length, 1);
  assert.equal(env.requests[0].body.events[0].client_event_id, id);
  assert.equal((await env.files()).length, 0);
  await client.shutdown();
});

test("unsupported numeric and label snapshots cannot poison a valid delivery batch", async (t) => {
  const env = await environment(t);
  const client = host();
  await client.start();
  const expensive = snapshot();
  expensive.usage.cost.total = 1e12 + 1;
  client.emit(expensive);
  for (const model of ["   ", "\u00a0\u2003", "model\u0085name", "model\u009fname"]) {
    client.emit(snapshot({ model }));
  }
  assert.equal((await env.files()).length, 0);
  client.emit(snapshot({ duration: 1e99, ttft: Number.POSITIVE_INFINITY }));
  await client.tick();
  assert.equal(env.requests[0].body.events.length, 1);
  assert.equal(env.requests[0].body.events[0].duration_ms, null);
  assert.equal(env.requests[0].body.events[0].ttft_ms, null);
  assert.equal((await env.files()).length, 0);
  await client.shutdown();
});
