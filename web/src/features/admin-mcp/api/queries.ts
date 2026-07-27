import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CreatePATRequest } from "../model/types";
import * as api from "./client";
import { mcpKeys } from "./keys";

/** usePATs - PAT 列表 hook */
export const usePATs = () =>
    useQuery({
        queryKey: mcpKeys.tokens(),
        queryFn: () => api.listPATs(),
    });

/** useCreatePAT - 创建 PAT hook。返回 mutation，onSuccess 含一次性明文 token。 */
export const useCreatePAT = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreatePATRequest) => api.createPAT(body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: mcpKeys.tokens() });
            toast.success("令牌已创建");
        },
        onError: (e: Error) => toast.error(`创建失败：${e.message}`),
    });
};

/** useDeletePAT - 吊销 PAT hook */
export const useDeletePAT = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => api.deletePAT(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: mcpKeys.tokens() });
            toast.success("令牌已吊销");
        },
        onError: (e: Error) => toast.error(`吊销失败：${e.message}`),
    });
};
