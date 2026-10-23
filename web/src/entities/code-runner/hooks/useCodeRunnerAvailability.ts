import type { CodeRunnerPolicyProjection } from "@entities/runtime-policy/model/types";
import { apiGet } from "@shared/api/request";
import { parseFenceInfo } from "@shared/lib/markdown/fence-info";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";

/** 有效策略的查询状态，以及当前围栏语言的执行许可。 */
export type CodeRunnerAvailability = UseQueryResult<CodeRunnerPolicyProjection> & {
	canonical: string;
	/** null 表示有效策略允许执行，否则为直接展示的禁用原因。 */
	reason: string | null;
	allowed: boolean;
};

/** 前台投影只决定交互状态，后端仍对每次提交执行同样的约束。 */
export function useCodeRunnerAvailability(
	language: string,
	enabled = true,
): CodeRunnerAvailability {
	const query = useQuery({
		queryKey: ["runtime-policy", "code-runner-projection"],
		queryFn: () => apiGet<CodeRunnerPolicyProjection>("/code-runner/policy"),
		enabled,
		retry: false,
		refetchInterval: 2000,
	});
	const canonical = parseFenceInfo(`${language} run`).language;
	const reason = query.isError
		? "策略读取失败"
		: !query.data
			? "策略加载中…"
			: !query.data.enabled
				? "运行器已关闭"
				: !(query.data.languages ?? []).includes(canonical)
					? "此语言已禁用"
					: null;
	return { ...query, canonical, reason, allowed: enabled && reason === null };
}
