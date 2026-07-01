import { apiGet } from "@shared/api/request";
import { useQuery } from "@tanstack/react-query";
import type { InstantCheckQuery, InstantCheckResult } from "../model/types";
import { uploadKeys } from "./keys";

/**
 * checkInstantUpload - 调后端 GET /admin/files/instant 检查秒传
 *
 * 需管理员身份。hash 命中时返回已存在文件，否则 exists 为 false。
 */
export const checkInstantUpload = async (query: InstantCheckQuery): Promise<InstantCheckResult> =>
    apiGet<InstantCheckResult>("/admin/files/instant", {
        params: { hash: query.hash },
    });

/**
 * useInstantCheck - 秒传检查 hook
 *
 * @param hash 文件哈希，空字符串时不发起请求
 */
export const useInstantCheck = (hash: string) =>
    useQuery({
        queryKey: uploadKeys.instantCheck(hash),
        queryFn: () => checkInstantUpload({ hash }),
        enabled: !!hash,
    });
