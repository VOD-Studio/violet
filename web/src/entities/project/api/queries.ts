import { apiGet } from "@shared/api/request";
import type { PageQuery } from "@shared/api/types";
import { queryOptions, useQuery } from "@tanstack/react-query";
import type { Project } from "../model/types";
import { projectKeys } from "./keys";

/** 保留后端的展示顺序；分页参数仅限定返回范围，不返回分页元数据。 */
export const fetchProjects = async (query: PageQuery = {}): Promise<Project[]> =>
	apiGet<Project[]>("/projects", { params: query });

export const projectsQueryOptions = (query: PageQuery = {}) =>
	queryOptions({
		queryKey: projectKeys.list(query),
		queryFn: () => fetchProjects(query),
	});

/**
 * 默认读全量目录，与项目页路由 loader 共用缓存。
 *
 * @param initialData - 路由 loader 取到的数据，用于对齐服务端输出与客户端水合首帧。
 */
export const useProjects = (query: PageQuery = {}, initialData?: Project[]) =>
	useQuery({ ...projectsQueryOptions(query), initialData });
