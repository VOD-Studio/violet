// @vitest-environment node
// node 环境跑包测试:证明协议层零 react/DOM 依赖(issue #246 验收)
import { describe, expect, it } from "vitest";
import {
	AGENT_STATUS_MESSAGE_TYPE,
	type AgentStatusMessage,
	DEFAULT_STATE_TTL_MS,
	isAgentStatusMessage,
	statusMessage,
} from "../index";

function msg(overrides?: Partial<Omit<AgentStatusMessage, "type">>): AgentStatusMessage {
	return statusMessage({
		agent: "codex",
		state: "executing",
		seq: 1,
		ts: Date.now(),
		...overrides,
	});
}

describe("statusMessage", () => {
	it("自动填 type 判别标识", () => {
		expect(msg().type).toBe(AGENT_STATUS_MESSAGE_TYPE);
	});
});

describe("isAgentStatusMessage", () => {
	it("合法 v2 消息通过", () => {
		expect(isAgentStatusMessage(msg())).toBe(true);
	});

	it("缺 type / type 不符拒绝", () => {
		const { type: _type, ...rest } = msg();
		expect(isAgentStatusMessage({ ...rest })).toBe(false);
		expect(isAgentStatusMessage({ ...msg(), type: "other" })).toBe(false);
	});

	it("state 非枚举拒绝", () => {
		expect(isAgentStatusMessage({ ...msg(), state: "running" })).toBe(false);
	});

	it("agent 空串 / seq 或 ts 非有限数拒绝", () => {
		expect(isAgentStatusMessage({ ...msg(), agent: "" })).toBe(false);
		expect(isAgentStatusMessage({ ...msg(), seq: Number.NaN })).toBe(false);
		expect(isAgentStatusMessage({ ...msg(), ts: Number.POSITIVE_INFINITY })).toBe(false);
	});

	it("非对象拒绝", () => {
		expect(isAgentStatusMessage(null)).toBe(false);
		expect(isAgentStatusMessage("x")).toBe(false);
	});
});

describe("DEFAULT_STATE_TTL_MS 契约", () => {
	it("done/error 短寿命,thinking/executing 长防呆,idle 永不过期", () => {
		expect(DEFAULT_STATE_TTL_MS.done).toBe(6_000);
		expect(DEFAULT_STATE_TTL_MS.error).toBe(6_000);
		expect(DEFAULT_STATE_TTL_MS.thinking).toBe(120_000);
		expect(DEFAULT_STATE_TTL_MS.executing).toBe(120_000);
		expect(DEFAULT_STATE_TTL_MS.idle).toBe(0);
	});
});
