/**
 * Markdown 预览类型定义
 */

/** 加载状态 */
export type MarkdownLoadStatus = "loading" | "ready" | "error";

/** Markdown 预览组件属性 */
export interface MarkdownPreviewProps {
    /** Markdown 文件 URL */
    url: string;
    /** 文件标题 */
    name?: string;
    /** 自定义类名 */
    className?: string;
}
