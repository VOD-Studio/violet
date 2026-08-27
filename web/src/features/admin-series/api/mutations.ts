import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { AttachChaptersInput, ReorderScope } from "../model/types";
import type { CreateSeriesInput, UpdateSeriesInput } from "./client";
import {
	addSection,
	attachChapters,
	createSeries,
	deleteSeries,
	detachChapter,
	generateCovers,
	removeSection,
	reorderChapters,
	reorderSections,
	updateSeries,
} from "./client";
import { adminSeriesKeys } from "./keys";

const useInvalidateSeries = () => {
	const qc = useQueryClient();
	return () => {
		qc.invalidateQueries({ queryKey: adminSeriesKeys.lists() });
		qc.invalidateQueries({ queryKey: adminSeriesKeys.details() });
	};
};

export const useCreateSeries = () => {
	const invalidate = useInvalidateSeries();
	return useMutation({
		mutationFn: (input: CreateSeriesInput) => createSeries(input),
		onSuccess: () => invalidate(),
	});
};

export const useUpdateSeries = (id: string) => {
	const invalidate = useInvalidateSeries();
	return useMutation({
		mutationFn: (input: UpdateSeriesInput) => updateSeries(id, input),
		onSuccess: () => invalidate(),
	});
};

export const useDeleteSeries = () => {
	const invalidate = useInvalidateSeries();
	return useMutation({
		mutationFn: (id: string) => deleteSeries(id),
		onSuccess: () => {
			toast.success("书已解散，全部章节已解绑");
			invalidate();
		},
		onError: (err) => toast.error(err.message),
	});
};

export const usePublishSeries = (id: string) => {
	const invalidate = useInvalidateSeries();
	return useMutation({
		mutationFn: (publish: boolean) => updateSeries(id, { publish }),
		onSuccess: (_data, publish) => {
			toast.success(publish ? "书已发布" : "书已收回草稿");
			invalidate();
		},
		onError: (err) => toast.error(err.message),
	});
};

export const useAddSection = (id: string) => {
	const invalidate = useInvalidateSeries();
	return useMutation({
		mutationFn: (title: string) => addSection(id, title),
		onSuccess: () => {
			toast.success("卷已添加");
			invalidate();
		},
		onError: (err) => toast.error(err.message),
	});
};

export const useRemoveSection = (id: string) => {
	const invalidate = useInvalidateSeries();
	return useMutation({
		mutationFn: (sectionId: string) => removeSection(id, sectionId),
		onSuccess: () => {
			toast.success("卷已删除");
			invalidate();
		},
		onError: (err) => toast.error(err.message),
	});
};

export const useReorderSections = (id: string) => {
	const invalidate = useInvalidateSeries();
	return useMutation({
		mutationFn: (orderedSectionIds: string[]) => reorderSections(id, orderedSectionIds),
		onSuccess: () => {
			toast.success("卷顺序已更新");
			invalidate();
		},
		onError: (err) => toast.error(err.message),
	});
};

export const useAttachChapters = (id: string) => {
	const invalidate = useInvalidateSeries();
	return useMutation({
		mutationFn: (input: AttachChaptersInput) => attachChapters(id, input),
		onSuccess: () => {
			toast.success("章节已挂入");
			invalidate();
		},
		onError: (err) => toast.error(err.message),
	});
};

export const useDetachChapter = (id: string) => {
	const invalidate = useInvalidateSeries();
	return useMutation({
		mutationFn: (postId: string) => detachChapter(id, postId),
		onSuccess: () => {
			toast.success("章节已摘除");
			invalidate();
		},
		onError: (err) => toast.error(err.message),
	});
};

/** 全树调序：乐观不适用（服务端为事务全量重写），提交后 invalidate。 */
export const useReorderChapters = (id: string) => {
	const invalidate = useInvalidateSeries();
	return useMutation({
		mutationFn: (plans: ReorderScope[]) => reorderChapters(id, plans),
		onSuccess: () => {
			toast.success("章节顺序已更新");
			invalidate();
		},
		onError: (err) => toast.error(err.message),
	});
};

/**
 * AI 生成封面候选并落素材库。返回站内 URL 列表，调用方挑选后
 * 走 updateSeries 回填 cover_image；不直接改书。
 */
export function useGenerateCovers(id: string) {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (input: { prompt?: string; count?: number }) =>
			generateCovers(id, input.prompt, input.count),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ["media", "list"] });
		},
	});
}
