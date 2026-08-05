/**
 * Word 文档预览类型定义
 */

/** 加载状态 */
export type DocxLoadStatus = "loading" | "ready" | "error";

/** Docx 预览组件属性 */
export interface DocxPreviewProps {
	/** .docx 文件 URL */
	url: string;
	/** 文件标题 */
	name?: string;
	/** 自定义类名 */
	className?: string;
}
