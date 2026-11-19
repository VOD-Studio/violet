import { projectKeys } from "@entities/project/api/keys";
import type { Project } from "@entities/project/model/types";
import { ApiError } from "@shared/api/error";
import { apiGet, apiGetPaged } from "@shared/api/request";
import type { PagedResponse, PageQuery } from "@shared/api/types";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { RoadmapDetail } from "../model/roadmap";
import { roadmapKeys } from "./keys";

/** fetchProjectsPaged - 分页拉取项目列表（后台管理页用） */
export const fetchProjectsPaged = async (query: PageQuery): Promise<PagedResponse<Project>> =>
	apiGetPaged<Project>("/projects", { params: query });

/**
 * useProjectsPaged - 分页项目列表 hook（后台管理页用）
 */
export const useProjectsPaged = (query: PageQuery = {}) =>
	useQuery({
		queryKey: projectKeys.list(query),
		queryFn: () => fetchProjectsPaged(query),
	});

/**
 * fetchProject - 调后端 GET /projects/{id} 按 ID 获取项目详情
 *
 * @param id 项目 ID
 */
export const fetchProject = async (id: string): Promise<Project> =>
	apiGet<Project>(`/projects/${id}`);

/**
 * useProject - 按 ID 获取项目详情 hook
 *
 * @param id 项目 ID，传入空串时不启用查询
 */
export const useProject = (id: string) =>
	useQuery({
		queryKey: projectKeys.detail(id),
		queryFn: () => fetchProject(id),
		enabled: id.length > 0,
	});

/**
 * fetchProjectRoadmap - 调后端 GET /projects/by-slug/{slug}/roadmap 读取公开路线图
 *
 * 未知 slug 后端返回 404（ApiError）。条目的 tags 与 links 在这里规整为数组，调用方不再判空。
 *
 * @param slug 项目 slug
 */
export const fetchProjectRoadmap = async (slug: string): Promise<RoadmapDetail> => {
	const detail = await apiGet<RoadmapDetail>(
		`/projects/by-slug/${encodeURIComponent(slug)}/roadmap`,
	);
	return {
		...detail,
		items: (detail.items ?? []).map((item) => ({
			...item,
			tags: item.tags ?? [],
			links: item.links ?? [],
		})),
		relations: detail.relations ?? [],
	};
};

/**
 * projectRoadmapQueryOptions - 路线图查询配置，loader 预取与 hook 共用
 *
 * @remarks 路线图随时可能被管理员改动，所以窗口重新聚焦时无论新旧都重新拉取。
 */
export const projectRoadmapQueryOptions = (slug: string) =>
	queryOptions({
		queryKey: roadmapKeys.detail(slug),
		queryFn: () => fetchProjectRoadmap(slug),
		refetchOnWindowFocus: "always",
	});

/**
 * useProjectRoadmap - 项目路线图 hook
 *
 * @param slug 项目 slug
 * @param initialData 路由 loader 已取到的数据：客户端的查询缓存不随 SSR 传递，不给它首帧没有数据，
 * 与服务端直出的 HTML 对不上
 */
export const useProjectRoadmap = (slug: string, initialData?: RoadmapDetail) =>
	useQuery({ ...projectRoadmapQueryOptions(slug), initialData });

/** 文章嵌入读到的路线图：项目不存在（或已删除）与读取出错都作为结果返回，由卡片显示占位说明。 */
export type RoadmapEmbedResult =
	| { status: "ok"; detail: RoadmapDetail }
	| { status: "missing" }
	| { status: "error" };

/**
 * 文章嵌入的路线图查询：读阅读时的当前公开数据，不抛错，文章其余部分不受影响。
 *
 * @remarks 同一篇文章里引用同一个项目的嵌入共用这一份缓存。
 */
export const roadmapEmbedQueryOptions = (slug: string) =>
	queryOptions({
		queryKey: roadmapKeys.embed(slug),
		queryFn: async (): Promise<RoadmapEmbedResult> => {
			try {
				return { status: "ok", detail: await fetchProjectRoadmap(slug) };
			} catch (error) {
				if (error instanceof ApiError && error.status === 404) return { status: "missing" };
				return { status: "error" };
			}
		},
		staleTime: 60_000,
	});
