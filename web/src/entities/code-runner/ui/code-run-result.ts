import type { ExecResult } from "@entities/code-runner/model/types";
import type { CodeBlockRunResult } from "@violet/ui";

/** 排队与执行中不产生结果；缺失的退出码保持未知，不当作成功退出。 */
export function toCodeBlockRunResult(
	result: Pick<ExecResult, "status" | "exit_code" | "duration_ms" | "stderr"> | null,
	error?: string | null,
): CodeBlockRunResult | undefined {
	if (error) return { status: "failed", message: error };
	if (!result) return undefined;
	switch (result.status) {
		case "success":
		case "error":
			return {
				status: result.status,
				exitCode: result.exit_code ?? null,
				durationMs: result.duration_ms,
			};
		case "timeout":
		case "oom_killed":
			return { status: result.status };
		case "failed":
			return { status: "failed", message: result.stderr || "系统暂时不可用" };
		default:
			return undefined;
	}
}
