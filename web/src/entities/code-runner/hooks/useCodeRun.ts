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
	/** 执行代码。失败、重置、被后续运行替换或卸载时返回 null。 */
	run: (
		language: string,
		source: string,
		handlers: Pick<StreamHandlers, "onStdout" | "onStderr">,
		overrides?: ResourceLimits,
	) => Promise<ExecResult | null>;
	/** 重置状态 */
	reset: () => void;
}

interface ActiveExecution {
	controller: AbortController | null;
	resolve: (result: ExecResult | null) => void;
}

export function useCodeRun(): UseCodeRunResult {
	const [state, setState] = useState<RunState>("idle");
	const [result, setResult] = useState<ExecResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const activeRef = useRef<ActiveExecution | null>(null);

	const cancelCurrent = useCallback(() => {
		const execution = activeRef.current;
		activeRef.current = null;
		execution?.controller?.abort();
		execution?.resolve(null);
	}, []);

	useEffect(() => cancelCurrent, [cancelCurrent]);

	const reset = useCallback(() => {
		cancelCurrent();
		setState("idle");
		setResult(null);
		setError(null);
	}, [cancelCurrent]);

	const run = useCallback(
		(
			language: string,
			source: string,
			handlers: Pick<StreamHandlers, "onStdout" | "onStderr">,
			overrides?: ResourceLimits,
		): Promise<ExecResult | null> => {
			cancelCurrent();
			const completion = Promise.withResolvers<ExecResult | null>();
			const execution: ActiveExecution = { controller: null, resolve: completion.resolve };
			activeRef.current = execution;
			setState("running");
			setResult(null);
			setError(null);

			const finish = (res: ExecResult | null, message: string | null = null) => {
				if (activeRef.current !== execution) {
					return;
				}
				activeRef.current = null;
				setResult(res);
				setError(message);
				setState("done");
				completion.resolve(res);
			};

			void (async () => {
				try {
					const taskId = await submitExecStream({ language, source, overrides });
					// POST 仍可完成服务端任务，但被替换或卸载的调用不再建立流。
					if (activeRef.current !== execution) {
						return;
					}
					const controller = streamExec(taskId, {
						onStdout: (text) => {
							if (activeRef.current === execution) {
								handlers.onStdout(text);
							}
						},
						onStderr: (text) => {
							if (activeRef.current === execution) {
								handlers.onStderr(text);
							}
						},
						onDone: (res) => finish(res),
						onError: (err) => finish(null, err.message),
					});
					execution.controller = controller;
					if (activeRef.current !== execution) {
						controller.abort();
					}
				} catch (err) {
					finish(null, err instanceof Error ? err.message : String(err));
				}
			})();

			return completion.promise;
		},
		[cancelCurrent],
	);

	return { state, result, error, run, reset };
}
