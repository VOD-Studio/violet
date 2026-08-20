// @vitest-environment node
// node 环境跑包测试:证明映射层零 react/DOM 依赖
import { AGENT_STATES, type AgentStatusMessage, statusMessage } from "@violet/agent-status";
import { describe, expect, it } from "vitest";
import { DEFAULT_EMOTION_BY_STATE, resolveEmotionId } from "../agent-state";

function msg(overrides?: Partial<Omit<AgentStatusMessage, "type">>): AgentStatusMessage {
	return statusMessage({ agent: "codex", state: "thinking", seq: 1, ts: 1, ...overrides });
}

describe("resolveEmotionId", () => {
	it("五个语义状态走默认映射", () => {
		for (const state of AGENT_STATES) {
			expect(resolveEmotionId(msg({ state }))).toBe(DEFAULT_EMOTION_BY_STATE[state]);
		}
	});

	it("emotionId 覆盖优先于 state 映射", () => {
		expect(resolveEmotionId(msg({ state: "done", emotionId: "36" }))).toBe("36");
	});

	it("消费端可整体覆盖映射表", () => {
		const custom = { thinking: "t", executing: "e", error: "r", done: "d", idle: "i" };
		expect(resolveEmotionId(msg({ state: "thinking" }), custom)).toBe("t");
		// emotionId 仍然最优先
		expect(resolveEmotionId(msg({ state: "thinking", emotionId: "x" }), custom)).toBe("x");
	});
});
