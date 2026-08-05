/**
 * useCodeRun - 代码执行编排 hook
 *
 * 管理「提交 → SSE 订阅 → 终态」的完整生命周期：
 *   1. submitExecStream 提交拿 task_id
 *   2. streamExec 连 SSE，stdout/stderr chunk 实时回调，done 触发终态
 *   3. 组件卸载时 abort，防泄漏
 *
 * 降级策略：SSE 连接失败时改用轮询 getExecResult（对应 yggdrasil 的兜底）。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ExecResult } from "#/features/code-run";
import {
	type ResourceLimits,
	type StreamHandlers,
	streamExec,
	submitExecStream,
} from "#/features/code-run";

export type RunState = "idle" | "running" | "done";

export interface UseCodeRunResult {
	/** 当前运行状态 */
	state: RunState;
	/** 最终结果（state=done 时有值） */
	result: ExecResult | null;
	/** 错误信息（提交或连接失败时） */
	error: string | null;
	/** 执行代码。返回最终结果（或 null 表示失败） */
	run: (
		language: string,
		source: string,
		handlers: Pick<StreamHandlers, "onStdout" | "onStderr">,
		overrides?: ResourceLimits,
	) => Promise<ExecResult | null>;
	/** 重置状态 */
	reset: () => void;
}

export function useCodeRun(): UseCodeRunResult {
	const [state, setState] = useState<RunState>("idle");
	const [result, setResult] = useState<ExecResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	// 卸载时取消进行中的 SSE
	useEffect(() => {
		return () => abortRef.current?.abort();
	}, []);

	const reset = useCallback(() => {
		abortRef.current?.abort();
		abortRef.current = null;
		setState("idle");
		setResult(null);
		setError(null);
	}, []);

	const run = useCallback(
		async (
			language: string,
			source: string,
			handlers: Pick<StreamHandlers, "onStdout" | "onStderr">,
			overrides?: ResourceLimits,
		): Promise<ExecResult | null> => {
			// 中断上一次执行
			abortRef.current?.abort();
			setState("running");
			setResult(null);
			setError(null);

			try {
				const taskId = await submitExecStream({ language, source, overrides });
				return await new Promise<ExecResult | null>((resolve) => {
					const controller = streamExec(taskId, {
						onStdout: handlers.onStdout,
						onStderr: handlers.onStderr,
						onDone: (res) => {
							setResult(res);
							setState("done");
							resolve(res);
						},
						onError: (err) => {
							setError(err.message);
							setState("done");
							resolve(null);
						},
					});
					abortRef.current = controller;
				});
			} catch (err) {
				// 提交失败（语言不支持/源码过大/网络错误）
				const msg = err instanceof Error ? err.message : String(err);
				setError(msg);
				setState("done");
				return null;
			}
		},
		[],
	);

	return { state, result, error, run, reset };
}
