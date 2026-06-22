import { httpClient } from "@shared/api/http";
import { useQuery } from "@tanstack/react-query";
import type { ContributionSummary } from "../model/types";
import { githubKeys } from "./keys";

/**
 * fetchContributions - 调 GET /api/v1/github/contributions
 *
 * 后端持有 GitHub token，前端无需传凭证。
 *
 * @returns 贡献图汇总数据
 */
export const fetchContributions = async (): Promise<ContributionSummary> => {
	const res = await httpClient.get<{ data: ContributionSummary }>(
		"/github/contributions",
	);
	return res.data.data;
};

/**
 * useContributions - GitHub 贡献图 hook
 *
 * staleTime 5 分钟（贡献数据更新频率低，无需频繁刷新）。
 */
export const useContributions = () =>
	useQuery({
		queryKey: githubKeys.contributions(),
		queryFn: fetchContributions,
		staleTime: 5 * 60 * 1000,
	});
