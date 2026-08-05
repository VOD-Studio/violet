/**
 * 代码预览类型定义
 */

/** 加载状态 */
export type CodeLoadStatus = "loading" | "ready" | "error";

/** Code 预览组件属性 */
export interface CodePreviewProps {
	/** 代码文件 URL */
	url: string;
	/** 文件名（用于推断语言） */
	name?: string;
	/** 显式指定语言（如 "typescript"），不传则按扩展名推断 */
	language?: string;
	/** 自定义类名 */
	className?: string;
	/** 是否显示行号（默认 true） */
	showLineNumbers?: boolean;
}
