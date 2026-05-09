/**
 * 项目功能 API 层
 * 使用 react-query 管理项目列表查询和单个项目详情
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CreateProjectInput, Project, UpdateProjectInput } from "./types";

/**
 * 获取项目列表
 */
export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      try {
        const res = await api.get<{ projects: Project[] }>("/projects");
        return res.projects ?? [];
      } catch {
        return [];
      }
    },
    placeholderData: [],
  });
}

/**
 * 获取单个项目详情
 * @param id 项目 ID
 */
export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => api.get<Project>(`/projects/${id}`),
    enabled: !!id,
  });
}

/**
 * 创建项目
 */
export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectInput) =>
      api.post("/admin/projects", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/**
 * 更新项目
 */
export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectInput }) =>
      api.put(`/admin/projects/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/**
 * 删除项目
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del(`/admin/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}