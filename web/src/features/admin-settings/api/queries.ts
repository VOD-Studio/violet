import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { UpdateSettingsRequest } from "../model/types";
import * as api from "./client";
import { settingsKeys } from "./keys";

/** useAdminSettings - 站点配置 hook */
export const useAdminSettings = () =>
    useQuery({
        queryKey: settingsKeys.detail(),
        queryFn: () => api.getSettings(),
    });

/** useUpdateSettings - 更新站点配置 hook */
export const useUpdateSettings = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: UpdateSettingsRequest) => api.updateSettings(body),
        onSuccess: (data) => {
            // 用返回的最新配置直接覆盖缓存，避免二次请求
            qc.setQueryData(settingsKeys.detail(), data);
            toast.success("站点设置已保存");
        },
        onError: (e: Error) => toast.error(`保存失败：${e.message}`),
    });
};
