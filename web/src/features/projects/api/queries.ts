import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";
import type { Project, ProjectListQuery } from "../model/types";
import { projectKeys } from "./keys";

/**
 * fetchProjects - 调后端 GET /projects 拉取项目列表
 *
 * 后端 ListProjects handler 直接返回全量 ProjectDTO 数组，未做分页，
 * 故此处用 apiGet 解包出数组而非 apiGetPaged。ProjectListQuery 的 page/limit
 * 参数当前会被后端忽略，待后端补齐分页后再切换为 apiGetPaged。
 *
 * @param query 预留分页参数，当前不生效
 * @returns 项目数组
 */
export const fetchProjects = async (query: ProjectListQuery = {}): Promise<Project[]> =>
    apiGet<Project[]>("/projects", { params: query });

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
