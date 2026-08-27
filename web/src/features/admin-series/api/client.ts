import { apiDelete, apiGet, apiGetPaged, apiPatch, apiPost, apiPut } from "@shared/api/request";

import type {
	AdminSeriesDetail,
	AdminSeriesListItem,
	AdminSeriesListQuery,
	AttachChaptersInput,
	ReorderScope,
} from "../model/types";

const BASE = "/admin/series";

export function listSeries(query: AdminSeriesListQuery) {
	return apiGetPaged<AdminSeriesListItem>(`${BASE}/`, { params: query });
}

export function getSeries(id: string) {
	return apiGet<AdminSeriesDetail>(`${BASE}/${id}`);
}

export interface CreateSeriesInput {
	title: string;
	slug: string;
	description?: string;
	cover_image?: string;
}

export function createSeries(input: CreateSeriesInput) {
	return apiPost<AdminSeriesListItem>(`${BASE}/`, input);
}

export interface UpdateSeriesInput {
	title?: string;
	description?: string;
	cover_image?: string;
	/** nil=不改；true=发布；false=收回 */
	publish?: boolean;
}

export function updateSeries(id: string, input: UpdateSeriesInput) {
	return apiPatch<AdminSeriesListItem>(`${BASE}/${id}`, input);
}

export function deleteSeries(id: string) {
	return apiDelete(`${BASE}/${id}`);
}

// ---- 卷管理 ----

export function addSection(id: string, title: string) {
	return apiPost(`${BASE}/${id}/sections`, { title });
}

export function removeSection(id: string, sectionId: string) {
	return apiDelete(`${BASE}/${id}/sections/${sectionId}`);
}

export function reorderSections(id: string, orderedSectionIds: string[]) {
	return apiPut(`${BASE}/${id}/sections/order`, { ordered_section_ids: orderedSectionIds });
}

// ---- 章节归属 ----

export function attachChapters(id: string, input: AttachChaptersInput) {
	return apiPost<AdminSeriesDetail>(`${BASE}/${id}/chapters`, input);
}

export function detachChapter(id: string, postId: string) {
	return apiDelete(`${BASE}/${id}/chapters/${postId}`);
}

export function reorderChapters(id: string, plans: ReorderScope[]) {
	return apiPut(`${BASE}/${id}/chapters/order`, { plans });
}

// ---- AI 封面生成 ----

export function generateCovers(id: string, prompt?: string, count?: number) {
	return apiPost<{ urls: string[] }>(`${BASE}/${id}/cover/generate`, {
		prompt: prompt || undefined,
		count: count ?? undefined,
	});
}

/**
 * 建书流程创建态生图（书未落库，无 id）：prompt 由表单当前书名/简介构造后整体传入。
 */
export function generateCoversStandalone(prompt: string, count?: number) {
	return apiPost<{ urls: string[] }>(`${BASE}/cover/generate`, {
		prompt,
		count: count ?? undefined,
	});
}
