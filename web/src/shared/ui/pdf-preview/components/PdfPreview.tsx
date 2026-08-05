/**
 * PDF 预览主组件（react-pdf）
 *
 * 完整功能：
 * - 分页导航（上/下页 + 跳转 + 页码显示）
 * - 缩放（放大/缩小/重置，0.5x - 3x）
 * - 加载/错误状态 + 重试
 * - 下载
 *
 * 依赖 pdfjs worker 配置（file-preview/utils/pdf-worker），此处 import 触发配置。
 */

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Document, Page } from "react-pdf";
import { usePdfDocument } from "../hooks/usePdfDocument";
import { PdfOverlay } from "./PdfOverlay";
import { PdfToolbar } from "./PdfToolbar";
import "@/shared/ui/file-preview/utils/pdf-worker";
import type { PdfPreviewProps } from "../types/pdf-preview-types";

export function PdfPreview({ url, name, className, initialPage, initialScale }: PdfPreviewProps) {
	const pdf = usePdfDocument({ initialPage, initialScale });

	function handleDownload() {
		const a = document.createElement("a");
		a.href = url;
		a.download = name ?? "document.pdf";
		a.click();
	}

	return (
		<div
			className={`flex flex-col overflow-hidden rounded-lg border bg-background ${className ?? ""}`}
		>
			{/* 工具栏（就绪后显示） */}
			{pdf.loadStatus === "ready" ? (
				<PdfToolbar
					currentPage={pdf.currentPage}
					numPages={pdf.numPages}
					scale={pdf.scale}
					onPrevPage={pdf.goToPrevPage}
					onNextPage={pdf.goToNextPage}
					onGoToPage={pdf.goToPage}
					onZoomIn={pdf.zoomIn}
					onZoomOut={pdf.zoomOut}
					onResetZoom={pdf.resetZoom}
					onDownload={handleDownload}
				/>
			) : null}

			{/* 文档区（Document 必须始终渲染，否则 onLoadSuccess 永不触发 → 死锁 loading） */}
			<div className="flex-1 overflow-auto bg-muted/30 p-4">
				<Document
					file={url}
					onLoadSuccess={pdf.handleLoadSuccess}
					onLoadError={pdf.handleLoadError}
					loading={<PdfOverlay loadStatus="loading" onRetry={pdf.retry} />}
					error={<PdfOverlay loadStatus="error" onRetry={pdf.retry} />}
					className="flex justify-center"
				>
					<Page
						pageNumber={pdf.currentPage}
						scale={pdf.scale}
						renderTextLayer
						renderAnnotationLayer
						className="shadow-md"
					/>
				</Document>
			</div>
		</div>
	);
}
