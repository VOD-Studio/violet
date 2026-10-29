import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";

const eventName = /^[a-f0-9]{64}\.jsonl$/;

function syncDirectory(path) {
  const fd = openSync(path, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

export function appendEvent(root, destination, event) {
  const directory = join(root, destination);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporary = join(directory, `.${process.pid}-${randomUUID()}-${event.client_event_id}.tmp`);
  let fd;
  try {
    fd = openSync(temporary, "wx", 0o600);
    writeFileSync(fd, `${JSON.stringify(event)}\n`);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(temporary, join(directory, `${event.client_event_id}.jsonl`));
    syncDirectory(directory);
    syncDirectory(root);
    syncDirectory(dirname(root));
  } finally {
    if (fd !== undefined) closeSync(fd);
    try {
      unlinkSync(temporary);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

export function acknowledge(root, destination, ids) {
  const directory = join(root, destination);
  for (const id of ids) {
    try {
      unlinkSync(join(directory, `${id}.jsonl`));
    } catch (error) {
      // 另一个上传进程可能已经确认了同一个不可变事件。
      if (error.code !== "ENOENT") throw error;
    }
  }
  syncDirectory(directory);
}

function list(path) {
  try {
    return readdirSync(path);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

export function pendingCount(root, destination) {
  return list(join(root, destination)).filter((name) => eventName.test(name)).length;
}

function ownerIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    return true;
  }
}

export function pendingEvents(root, destination, validate) {
  const directory = join(root, destination);
  const events = new Map();
  let damaged = false;
  for (const name of list(directory).sort()) {
    const temporary = /^\.(\d+)-[a-f0-9-]{36}-([a-f0-9]{64})\.tmp$/.exec(name);
    if (temporary && ownerIsAlive(Number(temporary[1]))) continue;
    if (!eventName.test(name) && !temporary) {
      if (name.endsWith(".tmp")) damaged = true;
      continue;
    }
    let text;
    try {
      text = readFileSync(join(directory, name), "utf8");
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    try {
      const event = JSON.parse(text);
      const expectedID = temporary ? temporary[2] : name.slice(0, -6);
      if (!text.endsWith("\n") || !validate(event) || event.client_event_id !== expectedID) {
        damaged = true;
        continue;
      }
      if (temporary) {
        // 只恢复已退出进程留下的完整记录；绝不移动活进程正在写的临时文件。
        try {
          renameSync(join(directory, name), join(directory, `${event.client_event_id}.jsonl`));
          syncDirectory(directory);
        } catch (error) {
          if (error.code === "ENOENT") continue;
          throw error;
        }
      }
      events.set(event.client_event_id, event);
    } catch {
      damaged = true;
    }
  }
  const foreign = list(root).some((name) => /^[a-f0-9]{64}$/.test(name) && name !== destination && pendingCount(root, name) > 0);
  return { events: [...events.values()], foreign, damaged };
}
