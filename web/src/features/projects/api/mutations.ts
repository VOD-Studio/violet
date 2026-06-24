import { apiDelete, apiPost, apiPut } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateProject, UpdateProject } from "../model/types";
import { projectKeys } from "./keys";

/**
 * useCreateProject - 调后端 POST /admin/projects 创建项目
 *
 * 后端 RespondMessage 只返回消息无数据载荷，故泛型为 null。
 * 成功后失效项目列表缓存。
 */
export const useCreateProject = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: CreateProject) => apiPost<null>("/admin/projects", body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: projectKeys.lists() });
		},
	});
};

/**
 * useUpdateProject - 调后端 PUT /admin/projects/{id} 更新项目
 *
 * 后端 RespondMessage 只返回消息无数据载荷，故泛型为 null。
 * 成功后失效对应详情与所有列表缓存。
 *
 * @param id 项目 ID
 */
export const useUpdateProject = (id: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: UpdateProject) =>
			apiPut<null>(`/admin/projects/${id}`, body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: projectKeys.detail(id) });
			qc.invalidateQueries({ queryKey: projectKeys.lists() });
		},
	});
};

/**
 * useDeleteProject - 调后端 DELETE /admin/projects/{id} 删除项目
 *
 * 后端 RespondMessage 只返回消息无数据载荷，故泛型为 null。
 * 成功后失效所有项目缓存。
 *
 * @param id 项目 ID
 */
export const useDeleteProject = (id: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => apiDelete<null>(`/admin/projects/${id}`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: projectKeys.all });
		},
	});
};
