import { apiGet, apiGetPaged } from "@shared/api/request";
import type { PagedResponse, PageQuery } from "@shared/api/types";
import { useQuery } from "@tanstack/react-query";
import type { Project, ProjectListQuery } from "../model/types";
import { projectKeys } from "./keys";

/**
 * fetchProjects - 调后端 GET /projects 拉取项目列表
 *
 * 无分页参数时后端返回全量 ProjectDTO 数组（前台项目页用）；
 * 带 page/limit 时返回 paged 信封（后台项目管理页用 fetchProjectsPaged）。
 *
 * @param query 预留筛选参数
 * @returns 项目数组
 */
export const fetchProjects = async (query: ProjectListQuery = {}): Promise<Project[]> =>
	apiGet<Project[]>("/projects", { params: query });

/** fetchProjectsPaged - 分页拉取项目列表（后台管理页用） */
export const fetchProjectsPaged = async (query: PageQuery): Promise<PagedResponse<Project>> =>
	apiGetPaged<Project>("/projects", { params: query });

/**
 * useProjects - 项目列表 hook
 *
 * 缓存 key 由 query 参数决定。后端返回全量列表，前端可自行排序与切片。
 *
 * @param query 预留分页参数
 */
export const useProjects = (query: ProjectListQuery = {}) =>
	useQuery({
		queryKey: projectKeys.list(query),
		queryFn: () => fetchProjects(query),
	});

/**
 * useProjectsPaged - 分页项目列表 hook（后台管理页用）
 */
export const useProjectsPaged = (query: PageQuery = {}) =>
	useQuery({
		queryKey: [...projectKeys.lists(), query],
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
