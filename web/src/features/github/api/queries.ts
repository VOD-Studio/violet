import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";
import type { ContributionSummary, Repo } from "../model/types";
import { githubKeys } from "./keys";

/**
 * fetchContributions - 调 GET /api/v1/github/contributions
 *
 * 后端持有 GitHub token，前端无需传凭证。
 *
 * @returns 贡献图汇总数据
 */
export const fetchContributions = async (): Promise<ContributionSummary> =>
    apiGet<ContributionSummary>("/github/contributions");

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
