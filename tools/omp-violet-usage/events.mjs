import { createHash } from "node:crypto";

const keys = ["client_event_id", "provider", "model", "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens", "reasoning_tokens", "cost_total", "stop_reason", "is_error", "duration_ms", "ttft_ms", "is_subagent", "omp_version", "occurred_at"];
const count = (value) => Number.isSafeInteger(value) && value >= 0;
const number = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
const timing = (value) => number(value) && value <= Number.MAX_SAFE_INTEGER;
const label = (value, max) => typeof value === "string" && value.trim().length > 0 && Buffer.byteLength(value, "utf8") <= max && !/\p{Cc}/u.test(value);

export function validEvent(event) {
  return event !== null && typeof event === "object"
    && Object.keys(event).length === keys.length && keys.every((key) => Object.hasOwn(event, key))
    && /^[a-f0-9]{64}$/.test(event.client_event_id)
    && label(event.provider, 128) && label(event.model, 256) && label(event.omp_version, 64)
    && [event.input_tokens, event.output_tokens, event.cache_read_tokens, event.cache_write_tokens, event.reasoning_tokens].every(count)
    && event.reasoning_tokens <= event.output_tokens && number(event.cost_total) && event.cost_total <= 1e12
    && label(event.stop_reason, 32) && typeof event.is_error === "boolean" && typeof event.is_subagent === "boolean"
    && (event.duration_ms === null || timing(event.duration_ms)) && (event.ttft_ms === null || timing(event.ttft_ms))
    && typeof event.occurred_at === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(event.occurred_at)
    && Number.isFinite(Date.parse(event.occurred_at));
}

export function captureEvent(message, context, version) {
  if (message?.role !== "assistant") return undefined;
  const usage = message.usage;
  if (!usage || !Number.isSafeInteger(message.timestamp) || message.timestamp < 0 || message.timestamp > 8_640_000_000_000_000) return undefined;
  const session = context.sessionManager.getSessionId();
  if (typeof session !== "string" || !session) return undefined;
  // message_end 没有 entry ID，且可能先于持久化完成。沿用宿主
  // sessionMessagePersistenceKey 的字段，再加入完成时间与用量以缩小碰撞范围。
  const identity = ["omp-usage-v1", session, message.timestamp, message.provider, message.model,
    message.responseId ?? "", message.stopReason, message.completedAt ?? null,
    usage.input, usage.output, usage.cacheRead, usage.cacheWrite];
  const event = {
    client_event_id: createHash("sha256").update(JSON.stringify(identity)).digest("hex"),
    provider: message.provider,
    model: message.model,
    input_tokens: usage.input,
    output_tokens: usage.output,
    cache_read_tokens: usage.cacheRead,
    cache_write_tokens: usage.cacheWrite,
    reasoning_tokens: usage.reasoningTokens ?? 0,
    cost_total: usage.cost?.total,
    stop_reason: message.stopReason,
    is_error: message.stopReason === "error" || message.stopReason === "aborted",
    duration_ms: timing(message.duration) ? message.duration : null,
    ttft_ms: timing(message.ttft) ? message.ttft : null,
    is_subagent: context.agent.kind === "sub",
    omp_version: version,
    occurred_at: new Date(message.timestamp).toISOString(),
  };
  return validEvent(event) ? event : undefined;
}
