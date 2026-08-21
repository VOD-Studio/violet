// @vitest-environment node
// node 环境跑包测试:证明状态机零 react/DOM 依赖(issue #246 验收)
import { describe, expect, it } from "vitest";
import { type AgentStatusMessage, AgentStatusStore, statusMessage } from "../index";

interface FakeClock {
	now: number;
	timers: Map<number, () => void>;
	nextId: number;
}

function fakeClock(start = 1_000_000): FakeClock {
	return { now: start, timers: new Map(), nextId: 1 };
}

function createStore(clock: FakeClock) {
	const changes: AgentStatusMessage[] = [];
	const store = new AgentStatusStore({
		now: () => clock.now,
		setTimer: (fn, ms) => {
			const id = clock.nextId++;
			clock.timers.set(id, () => {
				clock.now += ms;
				clock.timers.delete(id);
				fn();
			});
			return id;
		},
		clearTimer: (handle) => {
			clock.timers.delete(handle as number);
		},
		onStateChange: (m) => changes.push(m),
	});
	return { store, changes };
}

function fire(clock: FakeClock, id: number) {
	const t = clock.timers.get(id);
	if (!t) throw new Error(`timer ${id} 不存在`);
	t();
}

function msg(overrides?: Partial<Omit<AgentStatusMessage, "type">>): AgentStatusMessage {
	return statusMessage({
		agent: "codex",
		state: "executing",
		seq: 1,
		ts: 1_000_000,
		...overrides,
	});
}

describe("初始状态", () => {
	it("构造后为 system idle", () => {
		const { store } = createStore(fakeClock());
		expect(store.current().agent).toBe("system");
		expect(store.current().state).toBe("idle");
	});
});

describe("accept 去重与过期", () => {
	it("正常消息应用并触发 onStateChange", () => {
		const { store, changes } = createStore(fakeClock());
		const m = msg();
		const r = store.accept(m);
		expect(r).toEqual({ applied: true, message: m });
		expect(store.current()).toBe(m);
		expect(changes).toHaveLength(1);
	});

	it("重复 seq 丢弃(stale-seq)", () => {
		const { store } = createStore(fakeClock());
		store.accept(msg({ seq: 3 }));
		expect(store.accept(msg({ seq: 3 }))).toEqual({
			applied: false,
			reason: "stale-seq",
		});
	});

	it("回退 seq 丢弃,前进 seq 应用", () => {
		const { store } = createStore(fakeClock());
		store.accept(msg({ seq: 5 }));
		expect(store.accept(msg({ seq: 4 })).applied).toBe(false);
		expect(store.accept(msg({ seq: 6 })).applied).toBe(true);
	});

	it("seq 按 agent 分流,互不干扰", () => {
		const { store } = createStore(fakeClock());
		store.accept(msg({ agent: "codex", seq: 10 }));
		const r = store.accept(msg({ agent: "claude", seq: 1 }));
		expect(r.applied).toBe(true);
		expect(store.current().agent).toBe("claude");
	});

	it("超过寿命的旧消息丢弃(expired-ts)", () => {
		const clock = fakeClock();
		const { store } = createStore(clock);
		// done 默认 ttl 6s;消息 ts 距今 7s
		clock.now = 1_007_000;
		expect(store.accept(msg({ state: "done", seq: 1, ts: 1_000_000 }))).toEqual({
			applied: false,
			reason: "expired-ts",
		});
	});

	it("ttl=0 的消息不做过期判定(永不丢弃)", () => {
		const clock = fakeClock();
		const { store } = createStore(clock);
		clock.now = 1_900_000;
		const r = store.accept(msg({ state: "executing", ttlMs: 0 }));
		expect(r.applied).toBe(true);
	});
});

describe("TTL 到期回 idle", () => {
	it("done 默认 6s 后自动回 idle,同 agent 且不占外部 seq 轴", () => {
		const clock = fakeClock();
		const { store, changes } = createStore(clock);
		store.accept(msg({ state: "done", seq: 7 }));
		expect(store.current().state).toBe("done");

		fire(clock, 1); // 唯一的 TTL 定时器
		expect(store.current().state).toBe("idle");
		expect(store.current().agent).toBe("codex");
		expect(changes.map((m) => m.state)).toEqual(["done", "idle"]);

		// 合成 idle 不记 seq:适配器下一条 seq=8 正常应用
		expect(store.accept(msg({ state: "thinking", seq: 8, ts: clock.now })).applied).toBe(true);
	});

	it("显式 ttlMs 覆盖默认 TTL", () => {
		const clock = fakeClock();
		const { store } = createStore(clock);
		store.accept(msg({ state: "executing", ttlMs: 50 }));
		fire(clock, 1);
		expect(store.current().state).toBe("idle");
	});

	it("ttl=0 不设定时器,保持到下一条消息", () => {
		const clock = fakeClock();
		const { store } = createStore(clock);
		store.accept(msg({ state: "error", ttlMs: 0 }));
		expect(clock.timers.size).toBe(0);
		expect(store.current().state).toBe("error");
	});

	it("新消息覆盖旧 TTL 定时器", () => {
		const clock = fakeClock();
		const { store } = createStore(clock);
		store.accept(msg({ state: "done", seq: 1 })); // 定时器 A
		store.accept(msg({ state: "executing", seq: 2 })); // 覆盖为 B
		expect(clock.timers.size).toBe(1);
		fire(clock, 2); // 剩余的唯一定时器
		expect(store.current().state).toBe("idle");
	});

	it("dispose 清除定时器,不再自动回 idle", () => {
		const clock = fakeClock();
		const { store } = createStore(clock);
		store.accept(msg({ state: "done", seq: 1 }));
		store.dispose();
		expect(clock.timers.size).toBe(0);
		expect(store.current().state).toBe("done");
	});
});

describe("v1 兼容 inject", () => {
	it("emotionId 生效,resolveEmotionId 走覆盖路径", () => {
		const { store } = createStore(fakeClock());
		const applied = store.inject({ emotionId: "36", tips: "喵~" });
		expect(applied.emotionId).toBe("36");
		expect(applied.tips).toBe("喵~");
		// 合成 executing 仅满足协议必填,表现必走 emotionId
		expect(applied.state).toBe("executing");
		expect(applied.ttlMs).toBe(0);
	});

	it("多次 inject 独立 seq 轴,互不阻塞", () => {
		const { store } = createStore(fakeClock());
		store.inject({ emotionId: "10" });
		store.inject({ emotionId: "20" });
		store.inject({ emotionId: "30" });
		expect(store.current().emotionId).toBe("30");
	});

	it("inject 不阻塞其他 agent 的 v2 消息", () => {
		const clock = fakeClock();
		const { store } = createStore(clock);
		store.inject({ emotionId: "10" });
		const r = store.accept(msg({ agent: "codex", seq: 1, ts: clock.now }));
		expect(r.applied).toBe(true);
	});
});
