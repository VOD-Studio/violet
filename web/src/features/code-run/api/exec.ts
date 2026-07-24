/**
 * 代码执行 API client
 *
 * 不复用 axios httpClient（那是同步 envelope 拆解，不适合 SSE 流式）。
 * 提交执行走 apiPost（自动注入 CSRF + cookie），SSE 消费走原生 fetch
 * + ReadableStream 解帧。
 *
 * 后端路由（见 cmd/server/main.go）：
 *   POST /api/v1/code-runner/run          提交（轮询路径），返回 { task_id }
 *   POST /api/v1/code-runner/run/stream   提交（流式路径），返回 { task_id }
 *   GET  /api/v1/code-runner/stream       SSE 消费（?task_id=X）
 *   GET  /api/v1/code-runner/tasks/{id}   轮询查询结果
 */
import { apiGet, apiPost } from "#/shared/api/request";
import type { ExecRequest, ExecResult, ExecTask, StreamChunk } from "./types";

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
        try {
            const res = await fetch(url, {
                method: "GET",
                credentials: "include",
                signal: controller.signal,
                // SSE 不缓存
                cache: "no-store",
            });
            if (!res.ok) {
                throw new Error(`SSE 连接失败: ${res.status}`);
            }
            if (!res.body) {
                throw new Error("响应不支持流式读取");
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            // SSE 解析：按 \n\n 分帧，每帧含 event:/data: 行
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;

                const decoded = decoder.decode(value, { stream: true });
                buffer += decoded;

                // 按事件分隔符（空行）切帧
                let frameEnd = buffer.indexOf("\n\n");
                while (frameEnd >= 0) {
                    const frame = buffer.slice(0, frameEnd);
                    buffer = buffer.slice(frameEnd + 2);
                    parseSSEFrame(frame, handlers);
                    frameEnd = buffer.indexOf("\n\n");
                }
            }
            // 处理缓冲区剩余
            if (buffer.trim()) {
                parseSSEFrame(buffer, handlers);
            }
        } catch (err) {
            // abort 不算错误
            if ((err as Error).name === "AbortError") return;
            handlers.onError?.(err as Error);
        }
    })();

    return controller;
}

/**
 * 解析单个 SSE 帧（已按 \n\n 切出）。
 *
 * 帧格式：
 *   event: stdout
 *   data: hello
 *
 * 或多行 data（拼接）：
 *   event: done
 *   data: {"status":"success",...}
 *
 * 导出供测试（SSE 解析是核心逻辑）。
 */
export function parseSSEFrame(frame: string, handlers: StreamHandlers): void {
    let eventType = "";
    const dataLines: string[] = [];

    for (const line of frame.split("\n")) {
        // 跳过空行和注释（: keep-alive）
        if (line === "" || line.startsWith(":")) continue;
        if (line.startsWith("event:")) {
            eventType = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
            // data: 后有一个空格，slice(5) 去掉 "data:"，再处理可选前导空格
            dataLines.push(line.slice(5).replace(/^ /, ""));
        }
    }

    if (eventType === "") return;
    const data = dataLines.join("\n");

    const chunk: StreamChunk = { type: eventType as StreamChunk["type"], data };
    switch (chunk.type) {
        case "stdout":
            handlers.onStdout(chunk.data);
            break;
        case "stderr":
            handlers.onStderr(chunk.data);
            break;
        case "done":
            try {
                handlers.onDone(JSON.parse(chunk.data) as ExecResult);
            } catch {
                handlers.onError?.(new Error("done 事件 JSON 解析失败"));
            }
            break;
    }
}
