// @vitest-environment node
// 注入 fake EventSource:transport 层可在 node 环境测试,不依赖浏览器全局
import { describe, expect, it } from "vitest";
import { type AgentStatusMessage, statusMessage } from "../../index";
import { createSseTransport, type EventSourceLike } from "../sse";

class FakeEventSource implements EventSourceLike {
	onmessage: ((ev: { data: string }) => void) | null = null;
	onerror: ((ev: unknown) => void) | null = null;
	closed = false;
	constructor(
		public url: string,
		public instances: FakeEventSource[],
	) {
		instances.push(this);
	}
	close(): void {
		this.closed = true;
	}
	emit(data: string): void {
		this.onmessage?.({ data });
	}
}

function msg(overrides?: Partial<Omit<AgentStatusMessage, "type">>): AgentStatusMessage {
	return statusMessage({ agent: "codex", state: "thinking", seq: 1, ts: 1, ...overrides });
}

function setup() {
	const instances: FakeEventSource[] = [];
	const FakeES = class extends FakeEventSource {
		constructor(url: string) {
			super(url, instances);
		}
	};
	const transport = createSseTransport({
		url: "/api/dev/agent-status",
		eventSource: FakeES,
	});
	return { transport, instances };
}

describe("createSseTransport", () => {
	it("合法 v2 JSON 分发给订阅者", () => {
		const { transport, instances } = setup();
		const got: AgentStatusMessage[] = [];
		transport.subscribe((m) => got.push(m));
		instances[0].emit(JSON.stringify(msg()));
		expect(got).toEqual([msg()]);
	});

	it("多个订阅者均收到,全部退订后关闭连接", () => {
		const { transport, instances } = setup();
		const a: AgentStatusMessage[] = [];
		const b: AgentStatusMessage[] = [];
		const offA = transport.subscribe((m) => a.push(m));
		const offB = transport.subscribe((m) => b.push(m));
		instances[0].emit(JSON.stringify(msg()));
		expect(a).toHaveLength(1);
		expect(b).toHaveLength(1);

		offA();
		expect(instances[0].closed).toBe(false);
		offB();
		expect(instances[0].closed).toBe(true);
	});

	it("退订后不再分发", () => {
		const { transport, instances } = setup();
		const got: AgentStatusMessage[] = [];
		const off = transport.subscribe((m) => got.push(m));
		off();
		instances[0].emit(JSON.stringify(msg()));
		expect(got).toHaveLength(0);
	});

	it("非法 JSON / 非法消息丢弃,不断流", () => {
		const { transport, instances } = setup();
		const got: AgentStatusMessage[] = [];
		transport.subscribe((m) => got.push(m));
		instances[0].emit("{broken");
		instances[0].emit(JSON.stringify({ foo: 1 }));
		instances[0].emit(JSON.stringify(msg()));
		expect(got).toEqual([msg()]);
	});
});
