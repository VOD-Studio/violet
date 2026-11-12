import type { ExecResult } from "@entities/code-runner/model/types";
import { apiPost } from "@shared/api/request";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type UseCodeRunResult, useCodeRun } from "../useCodeRun";

vi.mock("@shared/api/request", () => ({
	apiGet: vi.fn(),
	apiPost: vi.fn(),
}));

const finalResult: ExecResult = {
	status: "success",
	stdout: "new output",
	stderr: "",
	exit_code: 0,
	duration_ms: 3,
	language: "python",
};

function connection() {
	const input = Promise.withResolvers<ReadableStreamDefaultController<Uint8Array>>();
	const body = new ReadableStream<Uint8Array>({
		start(controller) {
			input.resolve(controller);
		},
	});
	return { input: input.promise, body, response: new Response(body) };
}

function startRun(hook: { current: UseCodeRunResult }, output: string[], source = "print(1)") {
	let completion!: Promise<ExecResult | null>;
	act(() => {
		completion = hook.current.run("python", source, {
			onStdout: (text) => output.push(text),
			onStderr: (text) => output.push(text),
		});
	});
	return completion;
}

beforeEach(() => {
	vi.mocked(apiPost).mockReset();
	vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("useCodeRun POST → SSE 生命周期", () => {
	it("提交未返回就卸载会立即结束调用，迟到的 task_id 不再建立连接", async () => {
		const submission = Promise.withResolvers<{ task_id: string }>();
		vi.mocked(apiPost).mockReturnValueOnce(submission.promise);
		const { result, unmount } = renderHook(useCodeRun);
		const completion = startRun(result, []);
		unmount();
		await expect(completion).resolves.toBeNull();
		await act(async () => {
			submission.resolve({ task_id: "late-task" });
			await submission.promise;
		});
		expect(fetch).not.toHaveBeenCalled();
	});

	it("重置尚未提交完成的执行会立即结束等待并恢复空闲状态", async () => {
		const submission = Promise.withResolvers<{ task_id: string }>();
		vi.mocked(apiPost).mockReturnValueOnce(submission.promise);
		const { result } = renderHook(useCodeRun);
		const completion = startRun(result, []);
		act(() => result.current.reset());
		await expect(completion).resolves.toBeNull();
		expect(result.current.state).toBe("idle");
		await act(async () => {
			submission.resolve({ task_id: "reset-task" });
			await submission.promise;
		});
		expect(fetch).not.toHaveBeenCalled();
	});

	it("再次运行立即结束旧流等待，排队中的旧输出与终态不能污染新执行", async () => {
		const oldConnection = connection();
		const nextConnection = connection();
		vi.mocked(apiPost)
			.mockResolvedValueOnce({ task_id: "old-task" })
			.mockResolvedValueOnce({ task_id: "new-task" });
		vi.mocked(fetch)
			.mockResolvedValueOnce(oldConnection.response)
			.mockResolvedValueOnce(nextConnection.response);
		const { result } = renderHook(useCodeRun);
		const output: string[] = [];
		const oldCompletion = startRun(result, output);
		await waitFor(() => expect(oldConnection.body.locked).toBe(true));
		const oldInput = await oldConnection.input;
		oldInput.enqueue(
			new TextEncoder().encode(
				`event: stdout\ndata: stale output\n\nevent: done\ndata: ${JSON.stringify({ ...finalResult, stdout: "old output" })}\n\n`,
			),
		);
		const nextCompletion = startRun(result, output, "print(2)");
		await expect(oldCompletion).resolves.toBeNull();
		await waitFor(() => expect(nextConnection.body.locked).toBe(true));
		expect(output).toEqual([]);
		expect(result.current.state).toBe("running");
		expect(result.current.result).toBeNull();
		const nextInput = await nextConnection.input;
		await act(async () => {
			nextInput.enqueue(
				new TextEncoder().encode(
					`event: stdout\ndata: new output\n\nevent: done\ndata: ${JSON.stringify(finalResult)}\n\n`,
				),
			);
			await expect(nextCompletion).resolves.toEqual(finalResult);
		});
		expect(output).toEqual(["new output"]);
		expect(result.current.result).toEqual(finalResult);
		expect(result.current.state).toBe("done");
		expect(result.current.error).toBeNull();
	});

	it("被替换的提交不等待 HTTP 返回，迟到失败也不会覆盖新结果", async () => {
		const submission = Promise.withResolvers<{ task_id: string }>();
		const nextConnection = connection();
		vi.mocked(apiPost)
			.mockReturnValueOnce(submission.promise)
			.mockResolvedValueOnce({ task_id: "new-task" });
		vi.mocked(fetch).mockResolvedValueOnce(nextConnection.response);
		const { result } = renderHook(useCodeRun);
		const oldCompletion = startRun(result, []);
		const nextCompletion = startRun(result, [], "print(2)");
		await expect(oldCompletion).resolves.toBeNull();
		const nextInput = await nextConnection.input;
		await act(async () => {
			nextInput.enqueue(
				new TextEncoder().encode(`event: done\ndata: ${JSON.stringify(finalResult)}\n\n`),
			);
			await nextCompletion;
		});
		await act(async () => {
			submission.reject(new Error("old submission failed"));
			await submission.promise.catch(() => {});
		});
		expect(result.current.result).toEqual(finalResult);
		expect(result.current.error).toBeNull();
	});

	it.each(["reset", "unmount"] as const)("%s 会结束活跃 SSE 的等待调用", async (action) => {
		const activeConnection = connection();
		vi.mocked(apiPost).mockResolvedValueOnce({ task_id: "active-task" });
		vi.mocked(fetch).mockResolvedValueOnce(activeConnection.response);
		const { result, unmount } = renderHook(useCodeRun);
		const completion = startRun(result, []);
		await waitFor(() => expect(activeConnection.body.locked).toBe(true));
		act(() => {
			if (action === "reset") {
				result.current.reset();
			} else {
				unmount();
			}
		});
		await expect(completion).resolves.toBeNull();
		await waitFor(() => expect(activeConnection.body.locked).toBe(false));
	});

	it("无终态断流结束本次等待并进入错误终态", async () => {
		const activeConnection = connection();
		vi.mocked(apiPost).mockResolvedValueOnce({ task_id: "active-task" });
		vi.mocked(fetch).mockResolvedValueOnce(activeConnection.response);
		const { result } = renderHook(useCodeRun);
		const completion = startRun(result, []);
		const input = await activeConnection.input;
		await act(async () => {
			input.close();
			await expect(completion).resolves.toBeNull();
		});
		expect(result.current.state).toBe("done");
		expect(result.current.error).not.toBeNull();
		expect(result.current.result).toBeNull();
	});
});
