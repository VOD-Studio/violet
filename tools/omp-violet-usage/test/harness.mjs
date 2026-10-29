import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import extension from "../violet-usage.ts";

export function snapshot(overrides = {}) {
  return {
    role: "assistant", provider: "openai", model: "gpt-test", timestamp: 1_792_700_000_000,
    completedAt: 1_792_700_002_000, responseId: "private-response-id", stopReason: "stop",
    duration: 2000, ttft: 500,
    usage: { input: 100, output: 30, cacheRead: 50, cacheWrite: 20, reasoningTokens: 10, totalTokens: 999, cost: { total: 0.002 } },
    content: [{ type: "text", text: "PRIVATE PROMPT /private/repository/file.ts" }],
    errorMessage: "PRIVATE PROVIDER ERROR", credentialId: 42,
    ...overrides,
  };
}

export function host({ session = "private-session-id", kind = "main" } = {}) {
  const handlers = new Map();
  const timers = new Map();
  const notices = [];
  const context = {
    agent: { kind, depth: 0 },
    sessionManager: {
      getSessionId: () => session,
      getLeafEntry() { throw new Error("Do not inspect session bodies or assume leaf identity"); },
      getEntries() { throw new Error("Do not inspect session bodies"); },
    },
    get cwd() { throw new Error("Do not inspect working directories"); },
    ui: { notify: (text) => notices.push(text) },
    setInterval(fn, ms) { assert.equal(ms, 60_000); const timer = {}; timers.set(timer, fn); return timer; },
    clearTimer(timer) { timers.delete(timer); },
  };
  const commands = new Map();
  extension({
    pi: { VERSION: "18.12.1" },
    on: (event, handler) => handlers.set(event, handler),
    registerCommand: (name, options) => commands.set(name, options.handler),
  });
  return {
    notices,
    async start() { await handlers.get("session_start")({}, context); await this.tick(); },
    emit(message) { return handlers.get("message_end")({ message }, context); },
    command(name, args = "") { return commands.get(name)(args, context); },
    async tick() { for (const callback of timers.values()) await callback(); },
    async shutdown() { await handlers.get("session_shutdown")({}, context); },
  };
}

export async function environment(t, { respond } = {}) {
  const saved = Object.fromEntries(["HOME", "OMP_USAGE_URL", "OMP_USAGE_PAT", "PI_CODING_AGENT_DIR"].map((key) => [key, process.env[key]]));
  const home = await mkdtemp(join(tmpdir(), "omp-usage-test-"));
  const requests = [];
  const seen = new Set();
  let responder = respond;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const request = { body, authorization: req.headers.authorization, url: req.url };
    requests.push(request);
    if (responder) return responder(request, res);
    let accepted = 0;
    for (const event of body.events) {
      const key = `${req.headers.authorization}:${event.client_event_id}`;
      if (!seen.has(key)) { seen.add(key); accepted++; }
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: { accepted, duplicated: body.events.length - accepted } }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
  process.env.OMP_USAGE_URL = `http://127.0.0.1:${server.address().port}`;
  process.env.OMP_USAGE_PAT = "private-test-pat";
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(home, { recursive: true, force: true });
  });
  return {
    home, requests, seen, server,
    setResponder(value) { responder = value; },
    async config(value) { await mkdir(join(home, ".omp"), { recursive: true }); await writeFile(join(home, ".omp", "omp-usage.json"), JSON.stringify(value), { mode: 0o600 }); },
    async files() {
      const root = join(home, ".omp", "violet-usage-spool");
      try {
        const directories = await readdir(root);
        const result = [];
        for (const directory of directories) {
          for (const name of await readdir(join(root, directory))) {
            result.push({ path: join(root, directory, name), content: await readFile(join(root, directory, name), "utf8") });
          }
        }
        return result;
      } catch (error) { if (error.code === "ENOENT") return []; throw error; }
    },
  };
}

export async function until(predicate) {
  const deadline = Date.now() + 4000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for local HTTP behavior");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
