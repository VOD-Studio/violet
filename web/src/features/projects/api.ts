/**
 * 项目功能 API 层
 * 使用 react-query 管理项目列表查询和单个项目详情
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Project } from "./types";

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