import { apiPost } from "@shared/api/request";
import { useMutation } from "@tanstack/react-query";

/**
 * useIncrementView - 调后端 POST /posts/{id}/view 增加文章浏览次数
 *
 * 返回 null，无需 invalidate，浏览量在下次详情请求时刷新。
 */
export const useIncrementView = () =>
    useMutation({
        mutationFn: (id: string) => apiPost<null>(`/posts/${id}/view`),
    });
