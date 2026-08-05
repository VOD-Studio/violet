/**
 * 压缩包预览类型定义
 */

/** 加载状态 */
export type ArchiveLoadStatus = "loading" | "ready" | "error";

/** 压缩包内单个条目 */
export interface ArchiveEntry {
	/** 相对路径（含目录，如 "src/index.ts"） */
	path: string;
	/** 文件名（路径最后一段） */
	name: string;
	/** 解压后大小（字节），目录为 0 */
	size: number;
	/** 是否为目录 */
	isDirectory: boolean;
}

/** Archive 预览组件属性 */
export interface ArchivePreviewProps {
	/** 压缩包 URL */
	url: string;
	/** 文件名（用于判断压缩格式与显示） */
	name?: string;
	/** MIME 类型 */
	mimeType?: string;
	/** 自定义类名 */
	className?: string;
}
