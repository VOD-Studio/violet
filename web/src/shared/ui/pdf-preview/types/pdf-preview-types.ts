/**
 * PDF 预览组件类型定义
 */

/** 加载状态 */
export type PdfLoadStatus = "loading" | "ready" | "error";

/** PDF 预览组件属性 */
export interface PdfPreviewProps {
	/** PDF 文件 URL */
	url: string;
	/** 标题（用于 aria-label） */
	name?: string;
	/** 自定义类名 */
	className?: string;
	/** 初始缩放比例（默认 1，按 fit-width 自适应时可忽略） */
	initialScale?: number;
	/** 初始页码（从 1 开始，默认 1） */
	initialPage?: number;
}
