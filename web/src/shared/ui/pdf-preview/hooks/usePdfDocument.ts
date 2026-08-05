/**
 * PDF 文档加载与导航 Hook
 *
 * 封装 react-pdf 的 Document/Page，统一管理：
 * - 加载状态（loading/ready/error）与重试
 * - 文档总页数
 * - 当前页码导航（上一页/下一页/跳转）
 * - 缩放（放大/缩小/重置/适宽）
 *
 * 注意：调用方需确保 pdf-worker 已配置（见 file-preview/utils/pdf-worker）。
 */

import { useCallback, useState } from "react";
import type { PdfLoadStatus } from "../types/pdf-preview-types";

/** 缩放档位上下限 */
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
/** 单次缩放步长 */
const SCALE_STEP = 0.25;

interface UsePdfDocumentOptions {
	initialPage?: number;
	initialScale?: number;
}

export function usePdfDocument({ initialPage = 1, initialScale = 1 }: UsePdfDocumentOptions = {}) {
	const [numPages, setNumPages] = useState(0);
	const [currentPage, setCurrentPage] = useState(initialPage);
	const [scale, setScale] = useState(initialScale);
	const [loadStatus, setLoadStatus] = useState<PdfLoadStatus>("loading");
	const [loadError, setLoadError] = useState<Error | null>(null);

	const handleLoadSuccess = useCallback(({ numPages: total }: { numPages: number }) => {
		setNumPages(total);
		setLoadStatus("ready");
		setLoadError(null);
	}, []);

	const handleLoadError = useCallback((error: Error) => {
		setLoadStatus("error");
		setLoadError(error);
	}, []);

	const retry = useCallback(() => {
		setLoadStatus("loading");
		setLoadError(null);
	}, []);

	// ---- 页码导航 ----
	const goToPage = useCallback(
		(page: number) => {
			const clamped = Math.max(1, Math.min(page, numPages || 1));
			setCurrentPage(clamped);
		},
		[numPages],
	);

	const goToPrevPage = useCallback(() => {
		setCurrentPage((prev) => (prev > 1 ? prev - 1 : prev));
	}, []);

	const goToNextPage = useCallback(() => {
		setCurrentPage((prev) => (prev < numPages ? prev + 1 : prev));
	}, [numPages]);

	// ---- 缩放 ----
	const zoomIn = useCallback(() => {
		setScale((prev) => Math.min(prev + SCALE_STEP, MAX_SCALE));
	}, []);

	const zoomOut = useCallback(() => {
		setScale((prev) => Math.max(prev - SCALE_STEP, MIN_SCALE));
	}, []);

	const resetZoom = useCallback(() => setScale(1), []);

	const setFitWidth = useCallback((width: number) => {
		// 适宽：按容器宽度计算缩放（1 个单位 = 假设 PDF 原始 ~ 800px @ scale 1）
		setScale(Math.max(MIN_SCALE, Math.min(width / 800, MAX_SCALE)));
	}, []);

	return {
		numPages,
		currentPage,
		scale,
		loadStatus,
		loadError,
		handleLoadSuccess,
		handleLoadError,
		retry,
		goToPage,
		goToPrevPage,
		goToNextPage,
		zoomIn,
		zoomOut,
		resetZoom,
		setFitWidth,
	};
}
