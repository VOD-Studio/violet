/**
 * 提交执行使用认证 HTTP 客户端；SSE 使用原生 fetch 解帧。
 * 取消 SSE 订阅不会撤销已提交的沙箱任务。
 */

import type { ExecRequest, ExecResult, ExecTask } from "@entities/code-runner/model/types";
import { apiGet, apiPost } from "@shared/api/request";

/** 提交执行的返回值 */
interface SubmitResponse {
	task_id: string;
}

/**
 * 提交执行（轮询路径）。
 *
 * 返回 task_id，前端用它轮询 getExecResult。语言不支持/源码过大时抛 ApiError。
 */
export async function submitExec(req: ExecRequest): Promise<string> {
	const res = await apiPost<SubmitResponse>("/code-runner/run", req);
	return res.task_id;
}

/**
 * 提交流式执行。
 *
 * 返回 task_id，前端用它连 streamExec 接收 SSE。校验链同 submitExec。
 */
export async function submitExecStream(req: ExecRequest): Promise<string> {
	const res = await apiPost<SubmitResponse>("/code-runner/run/stream", req);
	return res.task_id;
}

/**
 * 轮询查询任务结果（兜底路径）。
 *
 * SSE 不可用或编辑器内运行时用。任务不存在抛 ApiError（404）。
 */
export async function getExecResult(taskId: string): Promise<ExecTask> {
	return apiGet<ExecTask>(`/code-runner/tasks/${taskId}`);
}

/** SSE 事件回调集合 */
export interface StreamHandlers {
	/** stdout 输出片段 */
	onStdout: (data: string) => void;
	/** stderr 输出片段 */
	onStderr: (data: string) => void;
	/** 执行完成，携带最终结果 */
	onDone: (result: ExecResult) => void;
	/** 连接/解析错误 */
	onError?: (err: Error) => void;
}

const FRAME_BOUNDARY = /\r?\n\r?\n/u;

/**
 * 消费 SSE 流式输出。
 *
 * 用原生 fetch 连 GET /code-runner/stream?task_id=X（credentials 自动带 cookie），
 * 拿 response.body.getReader() 解 SSE 帧。跨 chunk 边界正确拼接（reader 每次
 * read 可能返回半个事件）。
 *
 * @returns AbortController，调用 .abort() 取消订阅（组件卸载时必须调）。
 */
export function streamExec(taskId: string, handlers: StreamHandlers): AbortController {
	const controller = new AbortController();
	const url = `/api/v1/code-runner/stream?task_id=${encodeURIComponent(taskId)}`;

	void (async () => {
		let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
		let finished = false;
		const cancelReader = () => {
			void reader?.cancel().catch(() => {});
		};
		const streamHandlers: StreamHandlers = {
			onStdout: handlers.onStdout,
			onStderr: handlers.onStderr,
			onDone: (result) => {
				finished = true;
				handlers.onDone(result);
			},
			onError: (error) => {
				finished = true;
				handlers.onError?.(error);
			},
		};

		try {
			const res = await fetch(url, {
				method: "GET",
				credentials: "include",
				signal: controller.signal,
				cache: "no-store",
			});
			if (!res.ok) {
				throw new Error(`SSE 连接失败: ${res.status}`);
			}
			if (!res.body) {
				throw new Error("响应不支持流式读取");
			}

			reader = res.body.getReader();
			controller.signal.addEventListener("abort", cancelReader, { once: true });
			const decoder = new TextDecoder();
			let buffer = "";

			while (!finished && !controller.signal.aborted) {
				const { done, value } = await reader.read();
				if (controller.signal.aborted) {
					break;
				}
				buffer += decoder.decode(value, { stream: !done });

				// 保留原始行尾，CR 与 LF 分属不同网络分片时也能识别空行。
				let separator = FRAME_BOUNDARY.exec(buffer);
				while (separator && !finished && !controller.signal.aborted) {
					const frame = buffer.slice(0, separator.index);
					buffer = buffer.slice(separator.index + separator[0].length);
					parseSSEFrame(frame, streamHandlers);
					separator = FRAME_BOUNDARY.exec(buffer);
				}
				if (done) {
					if (!finished && !controller.signal.aborted && buffer.trim()) {
						parseSSEFrame(buffer, streamHandlers);
					}
					if (!finished && !controller.signal.aborted) {
						throw new Error("执行流在返回最终结果前已关闭");
					}
					break;
				}
			}
		} catch (err) {
			if (!controller.signal.aborted && !finished) {
				finished = true;
				handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
			}
		} finally {
			controller.signal.removeEventListener("abort", cancelReader);
			controller.abort();
			if (reader) {
				try {
					await reader.cancel();
				} catch {
					// 断流或主动取消后仍须释放 reader 的独占锁。
				} finally {
					reader.releaseLock();
				}
			}
		}
	})();

	return controller;
}

/**
 * 解析单个 SSE 帧，支持 LF 与 CRLF 行尾。
 *
 * 帧格式：
 *   event: stdout
 *   data: hello
 *
 * 或多行 data（拼接）：
 *   event: done
 *   data: {"status":"success",...}
 */
export function parseSSEFrame(frame: string, handlers: StreamHandlers): void {
	let eventType = "";
	const dataLines: string[] = [];

	for (const line of frame.split(/\r?\n/)) {
		// 跳过空行和注释（: keep-alive）
		if (line === "" || line.startsWith(":")) {
			continue;
		}
		if (line.startsWith("event:")) {
			eventType = line.slice(6).trim();
		} else if (line.startsWith("data:")) {
			// data: 后有一个空格，slice(5) 去掉 "data:"，再处理可选前导空格
			dataLines.push(line.slice(5).replace(/^ /, ""));
		}
	}

	if (eventType === "") {
		return;
	}
	const data = dataLines.join("\n");

	switch (eventType) {
		case "stdout":
			handlers.onStdout(data);
			break;
		case "stderr":
			handlers.onStderr(data);
			break;
		case "done":
			try {
				handlers.onDone(JSON.parse(data) as ExecResult);
			} catch {
				handlers.onError?.(new Error("done 事件 JSON 解析失败"));
			}
			break;
	}
}
