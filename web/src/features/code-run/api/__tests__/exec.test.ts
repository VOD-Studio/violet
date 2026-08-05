import { describe, expect, it } from "vitest";
import type { StreamHandlers } from "../exec";
import { parseSSEFrame } from "../exec";

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
