import type * as React from "react";
import type { FilePreviewVariant } from "../file-preview-context";

/** 文件预览主组件属性 */
export interface FilePreviewProps {
	/** 文件完整 URL */
	url: string;
	/** 缩略图 URL（用于图片预览占位） */
	thumbnailUrl?: string;
	/** 文件 MIME 类型 */
	mimeType: string;
	/** 文件名称 */
	name?: string;
	/** 文件大小（字节） */
	size?: number;
	/** 是否显示文件信息 */
	showInfo?: boolean;
	/** 展示形态：inline 保留独立卡片 chrome，viewer 嵌入统一媒体查看器。 */
	variant?: FilePreviewVariant;
	/** 自定义类名 */
	className?: string;
	/** 延迟渲染时间（毫秒），用于等待父容器动画完成 */
	delay?: number;
	/** 无外框模式：不渲染外层 border/背景包裹（各预览套件自带边框时使用，避免双层） */
	unframed?: boolean;
	/**
	 * 点击图片触发全屏预览的回调（透传给 ContentImage）。
	 * 调用方应在 modal Dialog 之外的顶层渲染全屏 ImagePreview。
	 */
	onImageClick?: (url: string, trigger?: HTMLElement | null, thumbnailUrl?: string) => void;
}

/** 带转发 ref 的属性（主组件用） */
export interface FilePreviewComponentProps extends FilePreviewProps {
	ref?: React.Ref<HTMLDivElement>;
}

/** 单一媒体预览组件的通用属性 */
export interface MediaPreviewProps {
	/** 文件完整 URL */
	url: string;
	/** 文件 MIME 类型 */
	mimeType: string;
	/** 文件名称 */
	name?: string;
	/** 自定义类名 */
	className?: string;
}

/** 图片预览属性 */
export interface ImagePreviewProps {
	/** 原图 URL */
	url: string;
	/** 缩略图 URL（占位） */
	thumbnailUrl?: string;
	/** 文件名称 */
	name?: string;
	/** 延迟加载原图（毫秒） */
	delay?: number;
	/** 自定义类名 */
	className?: string;
	/**
	 * 点击图片触发全屏预览的回调。
	 * 由调用方在合适层级（通常是顶层、modal Dialog 之外）渲染全屏 ImagePreview，
	 * 避免全屏层嵌在 modal Dialog 内被锁定而无法交互。
	 */
	onImageClick?: (url: string, trigger?: HTMLElement | null, thumbnailUrl?: string) => void;
}

/** 加载/错误状态 */
export type LoadStatus = "loading" | "loaded" | "error";
