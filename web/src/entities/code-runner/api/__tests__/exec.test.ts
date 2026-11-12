import type { StreamHandlers } from "@entities/code-runner/api/exec";
import { parseSSEFrame, streamExec } from "@entities/code-runner/api/exec";
import type { ExecResult } from "@entities/code-runner/model/types";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/** 构造测试用 handlers，捕获所有调用 */
function makeHandlers() {
	const stdout: string[] = [];
	const stderr: string[] = [];
	const done: unknown[] = [];
	const errors: Error[] = [];
	const handlers: StreamHandlers = {
		onStdout: (d) => stdout.push(d),
		onStderr: (d) => stderr.push(d),
		onDone: (r) => done.push(r),
		onError: (e) => errors.push(e),
	};
	return { handlers, stdout, stderr, done, errors };
}

describe("parseSSEFrame", () => {
	it("解析 stdout 事件", () => {
		const { handlers, stdout } = makeHandlers();
		parseSSEFrame("event: stdout\ndata: hello world", handlers);
		expect(stdout).toEqual(["hello world"]);
	});

	it("解析 stderr 事件", () => {
		const { handlers, stderr } = makeHandlers();
		parseSSEFrame("event: stderr\ndata: traceback", handlers);
		expect(stderr).toEqual(["traceback"]);
	});

	it("解析 done 事件（JSON 载荷）", () => {
		const { handlers, done } = makeHandlers();
		const payload = JSON.stringify({
			status: "success",
			stdout: "ok",
			stderr: "",
			exit_code: 0,
			duration_ms: 42,
			language: "python",
		});
		parseSSEFrame(`event: done\ndata: ${payload}`, handlers);
		expect(done).toHaveLength(1);
		expect(done[0]).toMatchObject({ status: "success", stdout: "ok", language: "python" });
	});

	it("多行 data 拼接", () => {
		const { handlers, stdout } = makeHandlers();
		parseSSEFrame("event: stdout\ndata: line1\ndata: line2\ndata: line3", handlers);
		expect(stdout).toEqual(["line1\nline2\nline3"]);
	});

	it("跳过注释行（keep-alive）", () => {
		const { handlers, stdout } = makeHandlers();
		parseSSEFrame(": keep-alive\nevent: stdout\ndata: ok", handlers);
		expect(stdout).toEqual(["ok"]);
	});

	it("无 event 字段的帧被忽略", () => {
		const { handlers, stdout } = makeHandlers();
		parseSSEFrame("data: orphan", handlers);
		expect(stdout).toHaveLength(0);
	});

	it("data 前导空格被去除（SSE 规范）", () => {
		const { handlers, stdout } = makeHandlers();
		parseSSEFrame("event: stdout\ndata:    indented", handlers);
		expect(stdout).toEqual(["   indented"]); // 只去一个前导空格
	});

	it("空帧不触发回调", () => {
		const { handlers, stdout } = makeHandlers();
		parseSSEFrame("", handlers);
		parseSSEFrame("   ", handlers);
		expect(stdout).toHaveLength(0);
	});

	it("done 事件 JSON 格式错误触发 onError", () => {
		const { handlers, errors } = makeHandlers();
		parseSSEFrame("event: done\ndata: {invalid json}", handlers);
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain("JSON");
	});

	it("exit_code 为 null 的 done 事件", () => {
		const { handlers, done } = makeHandlers();
		parseSSEFrame(
			'event: done\ndata: {"status":"failed","stdout":"","stderr":"系统暂时不可用","exit_code":null,"duration_ms":100,"language":"python"}',
			handlers,
		);
		expect(done).toHaveLength(1);
		expect((done[0] as { exit_code: unknown }).exit_code).toBeNull();
	});
});

const finalResult: ExecResult = {
	status: "success",
	stdout: "你好",
	stderr: "",
	exit_code: 0,
	duration_ms: 4,
	language: "python",
};

function openStream() {
	const input = Promise.withResolvers<ReadableStreamDefaultController<Uint8Array>>();
	const cancelled = vi.fn();
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			input.resolve(controller);
		},
		cancel: cancelled,
	});
	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
	return { input: input.promise, body, cancelled };
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("streamExec", () => {
	it("UTF-8 字节与 CRLF 分隔符跨分片仍逐段输出，done 无需连接关闭", async () => {
		const { input, body, cancelled } = openStream();
		const { handlers, stdout, stderr, done, errors } = makeHandlers();
		const subscription = streamExec("task-1", handlers);
		const controller = await input;
		const bytes = new TextEncoder().encode(
			`event: stdout\r\ndata: 你好\r\n\r\nevent: stderr\r\ndata: 警告\r\n\r\nevent: done\r\ndata: ${JSON.stringify(finalResult)}\r\n\r\n`,
		);
		for (const byte of bytes) {
			controller.enqueue(Uint8Array.of(byte));
		}
		await waitFor(() => expect(done).toEqual([finalResult]));
		expect(stdout).toEqual(["你好"]);
		expect(stderr).toEqual(["警告"]);
		expect(errors).toEqual([]);
		await waitFor(() => expect(body.locked).toBe(false));
		expect(cancelled).toHaveBeenCalledOnce();
		expect(subscription.signal.aborted).toBe(true);
	});

	it("done 后同一分片里的旧输出与重复终态不再通知消费方", async () => {
		const { input } = openStream();
		const { handlers, stdout, done, errors } = makeHandlers();
		streamExec("task-1", handlers);
		const controller = await input;
		controller.enqueue(
			new TextEncoder().encode(
				`event: done\ndata: ${JSON.stringify(finalResult)}\n\nevent: stdout\ndata: stale\n\nevent: done\ndata: ${JSON.stringify(finalResult)}\n\n`,
			),
		);
		await waitFor(() => expect(done).toEqual([finalResult]));
		expect(stdout).toEqual([]);
		expect(errors).toEqual([]);
	});

	it("没有 done 就断流时报告一次错误并释放读取器", async () => {
		const { input, body } = openStream();
		const { handlers, stdout, done, errors } = makeHandlers();
		streamExec("task-1", handlers);
		const controller = await input;
		controller.enqueue(new TextEncoder().encode("event: stdout\ndata: partial\n\n"));
		controller.close();
		await waitFor(() => expect(errors).toHaveLength(1));
		expect(stdout).toEqual(["partial"]);
		expect(done).toEqual([]);
		await waitFor(() => expect(body.locked).toBe(false));
	});

	it("终态 JSON 损坏时结束订阅，不继续推送后续输出", async () => {
		const { input, body } = openStream();
		const { handlers, stdout, errors } = makeHandlers();
		streamExec("task-1", handlers);
		const controller = await input;
		controller.enqueue(
			new TextEncoder().encode(
				"event: done\ndata: {broken}\n\nevent: stdout\ndata: stale\n\n",
			),
		);
		await waitFor(() => expect(errors).toHaveLength(1));
		expect(stdout).toEqual([]);
		await waitFor(() => expect(body.locked).toBe(false));
	});

	it("主动取消等待中的读取会释放连接且不报告执行错误", async () => {
		const { input, body, cancelled } = openStream();
		const { handlers, done, errors } = makeHandlers();
		const subscription = streamExec("task-1", handlers);
		await input;
		await waitFor(() => expect(body.locked).toBe(true));
		subscription.abort();
		await waitFor(() => expect(body.locked).toBe(false));
		expect(cancelled).toHaveBeenCalledOnce();
		expect(done).toEqual([]);
		expect(errors).toEqual([]);
	});
});
