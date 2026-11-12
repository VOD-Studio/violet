import { type StreamHandlers, streamExec, submitExecStream } from "@entities/code-runner/api/exec";
import type { ExecResult, ResourceLimits } from "@entities/code-runner/model/types";
import { useCallback, useEffect, useRef, useState } from "react";

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
	const generationRef = useRef(0);

	useEffect(() => {
		return () => {
			generationRef.current += 1;
			abortRef.current?.abort();
		};
	}, []);

	const reset = useCallback(() => {
		generationRef.current += 1;
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
			const generation = ++generationRef.current;
			abortRef.current?.abort();
			setState("running");
			setResult(null);
			setError(null);

			try {
				const taskId = await submitExecStream({ language, source, overrides });
				// 提交尚未返回时也可能卸载或换源，不再为旧代码建立流。
				if (generation !== generationRef.current) return null;
				return await new Promise<ExecResult | null>((resolve) => {
					const controller = streamExec(taskId, {
						onStdout: (text) => {
							if (generation === generationRef.current) handlers.onStdout?.(text);
						},
						onStderr: (text) => {
							if (generation === generationRef.current) handlers.onStderr?.(text);
						},
						onDone: (res) => {
							if (generation !== generationRef.current) {
								resolve(null);
								return;
							}
							setResult(res);
							setState("done");
							resolve(res);
						},
						onError: (err) => {
							if (generation !== generationRef.current) {
								resolve(null);
								return;
							}
							setError(err.message);
							setState("done");
							resolve(null);
						},
					});
					abortRef.current = controller;
				});
			} catch (err) {
				if (generation !== generationRef.current) return null;
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
