import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { announcementKeys } from "./queryKeys";
import type { Announcement, AnnouncementCreateInput, AnnouncementUpdateInput, AnnouncementListResponse } from "./types";

// 获取所有公告列表（管理接口）
export function useAdminAnnouncements(page = 0, limit = 20) {
  return useQuery({
    queryKey: announcementKeys.list(page, limit),
    queryFn: async (): Promise<AnnouncementListResponse> => {
      const res = await api.get<AnnouncementListResponse>(`/admin/announcements?page=${page}&limit=${limit}`);
      return res;
    },
  });
}

// 创建公告
export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AnnouncementCreateInput) => api.post<Announcement>("/admin/announcements", input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: announcementKeys.all });
    },
  });
}

// 更新公告
export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: AnnouncementUpdateInput }) =>
      api.patch<Announcement>(`/admin/announcements/${id}`, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: announcementKeys.all });
    },
  });
}

// 删除公告
export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.del(`/admin/announcements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: announcementKeys.all });
    },
  });
}