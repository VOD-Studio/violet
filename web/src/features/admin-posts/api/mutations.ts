import { clientQueryClient as queryClient } from "@shared/api/query-client";
import { apiDelete, apiPatch, apiPost, apiPut } from "@shared/api/request";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
	AdminPost,
	CreatePost,
	PostBatchAction,
	SetFeatured,
	UpdatePost,
	UpdatePostStatus,
} from "../model/types";
import { adminPostKeys } from "./keys";

/** useInvalidateAdminPosts - 失效后台文章全部列表与详情缓存 */
const useInvalidateAdminPosts = () => {
	const qc = useQueryClient();
	return () => {
		qc.invalidateQueries({ queryKey: adminPostKeys.lists() });
		qc.invalidateQueries({ queryKey: adminPostKeys.details() });
	};
};

/**
 * useCreatePost - 调后端 POST /admin/posts 创建文章
 *
 * 成功后失效后台文章缓存。成功提示由调用方按上下文给出，故此处不 toast。
 */
export const useCreatePost = () => {
	const invalidate = useInvalidateAdminPosts();
	return useMutation({
		mutationFn: (body: CreatePost) => apiPost<AdminPost>("/admin/posts", body),
		onSuccess: () => invalidate(),
	});
};

/**
 * useUpdatePost - 调后端 PUT /admin/posts/{id} 更新文章
 *
 * @param id 文章 ID
 */
export const useUpdatePost = (id: string) => {
	const invalidate = useInvalidateAdminPosts();
	return useMutation({
		mutationFn: (body: UpdatePost) => apiPut<null>(`/admin/posts/${id}`, body),
		onSuccess: () => invalidate(),
	});
};

/**
 * useUpdatePostStatus - 调后端 PATCH /admin/posts/{id}/status 更新文章状态
 *
 * @param id 文章 ID
 */
export const useUpdatePostStatus = (id: string) => {
	const invalidate = useInvalidateAdminPosts();
	return useMutation({
		mutationFn: (body: UpdatePostStatus) =>
			apiPatch<AdminPost>(`/admin/posts/${id}/status`, body),
		onSuccess: () => invalidate(),
	});
};

/**
 * useSetFeatured - 调后端 PATCH /admin/posts/{id}/featured 切换精选标记
 *
 * 服务端返回最新详情，直接写入 detail 缓存，避免进入编辑页时
 * 因 staleTime 窗口先渲染旧精选状态、再被表单一次性守卫锁死。
 * 列表项结构与详情不同，仍走 invalidate 触发 refetch。
 *
 * @param id 文章 ID
 */
export const useSetFeatured = (id: string) => {
	const qc = useQueryClient();
	const invalidate = useInvalidateAdminPosts();
	return useMutation({
		mutationFn: (body: SetFeatured) => apiPatch<AdminPost>(`/admin/posts/${id}/featured`, body),
		onSuccess: (data) => {
			qc.setQueryData(adminPostKeys.detail(id), data);
			invalidate();
		},
	});
};

/**
 * useDeletePost - 调后端 DELETE /admin/posts/{id} 删除文章 (移至回收站)
 *
 * @param id 文章 ID
 */
export const useDeletePost = (id: string) => {
	const invalidate = useInvalidateAdminPosts();
	return useMutation({
		mutationFn: () => apiDelete<null>(`/admin/posts/${id}`),
		onSuccess: () => invalidate(),
	});
};

/**
 * useRestorePost - 调后端 POST /admin/posts/{id}/restore 恢复文章
 *
 * @param id 文章 ID
 */
export const useRestorePost = (id: string) => {
	const invalidate = useInvalidateAdminPosts();
	return useMutation({
		mutationFn: () => apiPost<null>(`/admin/posts/${id}/restore`),
		onSuccess: () => invalidate(),
	});
};

/**
 * useHardDeletePost - 调后端 DELETE /admin/posts/{id}/hard 彻底删除文章
 *
 * @param id 文章 ID
 */
export const useHardDeletePost = (id: string) => {
	const invalidate = useInvalidateAdminPosts();
	return useMutation({
		mutationFn: () => apiDelete<null>(`/admin/posts/${id}/hard`),
		onSuccess: () => invalidate(),
	});
};

/**
 * useBatchAction - 调后端 POST /admin/posts/batch 批量操作文章
 *
 * 成功后失效后台文章列表与详情缓存，选中态清理由调用方处理。
 */
export const useBatchAction = () => {
	const invalidate = useInvalidateAdminPosts();
	return useMutation({
		mutationFn: (params: { ids: string[]; action: PostBatchAction }) =>
			apiPost<{ affected: number }>("/admin/posts/batch", params),
		onSuccess: () => invalidate(),
	});
};

/**
 * publishPost - 调状态切换接口发布文章
 *
 * Create 接口恒为草稿，发布走 PATCH /admin/posts/{id}/status。
 * 用裸 apiPatch 以便在 mutation onSuccess 回调里调用，手动失效缓存。
 */
export async function publishPost(id: string): Promise<void> {
	await apiPatch<AdminPost>(`/admin/posts/${id}/status`, { status: "published" });
	queryClient.invalidateQueries({ queryKey: adminPostKeys.detail(id) });
	queryClient.invalidateQueries({ queryKey: adminPostKeys.lists() });
}

/** ImportPostUrlResult - 远程链接文档解析结果 */
export interface ImportPostUrlResult {
	/** 文章正文标题（og:title → JSON-LD → H1 → <title> 兜底），可为空 */
	title?: string;
	/** 提取出的正文 HTML */
	html: string;
	/** 摘要（SEO description → 正文首段回退） */
	excerpt?: string;
	/** SEO 标题，社交分享用，可与正文不同 */
	seo_title?: string;
	/** SEO 描述 */
	seo_description?: string;
	/** 非致命提示（如 AI 还原失败的公式数） */
	warnings?: string[];
}

/** ImportPostUrlOpts - 远程链接导入的可选行为开关 */
export interface ImportPostUrlOpts {
	/** 为 true 时调 LLM 反推无源码公式的 LaTeX（需管理员配置 llm_*） */
	ai_restore_formula?: boolean;
}

/**
 * importPostUrl - 调后端 POST /admin/posts/import-url 解析远程链接正文
 *
 * 后端 readability 代理解析，返回标题、正文 HTML、摘要与 SEO 元信息，
 * 供编辑器 setContent 插入并自动填入表单空字段。
 */
export async function importPostUrl(
	url: string,
	opts?: ImportPostUrlOpts,
): Promise<ImportPostUrlResult> {
	// 长耗时操作：远程代理 + readability + 可选 AI 公式还原，单独传 5 分钟超时
	return apiPost<ImportPostUrlResult>(
		"/admin/posts/import-url",
		{ url, ai_restore_formula: opts?.ai_restore_formula ?? false },
		{ timeout: 300000 },
	);
}

/**
 * slugifyPost - 调后端 POST /admin/posts/slugify 把标题转 ASCII slug
 *
 * 后端中文走无声调全拼（go-pinyin），保证产出符合 [a-z0-9-] 契约。
 * 供 PostEditor 标题输入后 debounce 调用，预填 slug 输入框；
 * 替代前端本地 slugify（保留 Unicode 中文，与后端契约冲突）。
 */
export async function slugifyPost(title: string): Promise<{ slug: string }> {
	return apiPost<{ slug: string }>("/admin/posts/slugify", { title });
}

export function useRestoreVersion(postId: string, versionId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			await apiPost(`/admin/posts/${postId}/versions/${versionId}/restore`);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: adminPostKeys.detail(postId) });
			queryClient.invalidateQueries({ queryKey: adminPostKeys.versions(postId) });
		},
	});
}
