import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";
import type { Repo } from "../model/types";
import { githubKeys } from "./keys";

/**
 * fetchRepos - 调 GET /api/v1/github/repos
 *
 * 后端持有 GitHub token，前端无需传凭证。
 *
 * @returns 公开仓库列表
 */
export const fetchRepos = async (): Promise<Repo[]> => apiGet<Repo[]>("/github/repos");

/**
 * useRepos - GitHub 仓库列表 hook
 *
 * staleTime 5 分钟，仓库元数据更新频率低。
 */
export const useRepos = () =>
	useQuery({
		queryKey: githubKeys.repos(),
		queryFn: fetchRepos,
		staleTime: 5 * 60 * 1000,
	});
