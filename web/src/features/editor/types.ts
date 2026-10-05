import type { EditorFeature } from "./lib/features";

/** 命令式取值始终包含当前源码模式下尚未退出的修改。 */
export interface RichTextEditorHandle {
	insertImages: (images: Array<{ src: string; alt?: string }>) => void;
	getHTML: () => string;
	/** 源码模式返回当前输入；富文本模式返回节点序列化结果。 */
	getMarkdown: () => string;
}

export interface RichTextEditorProps {
	value: string;
	onChange: (content: string) => void;
	/** 默认 HTML；Markdown 场景同样通过 onChange 实时同步源码。 */
	contentType?: "html" | "markdown";
	/** 缺省全量启用；禁用项同时从工具栏和节点 schema 移除。 */
	disabledFeatures?: readonly EditorFeature[];
	placeholder?: string;
	/** 下载文件名，不含扩展名。 */
	exportName?: string;
	/** 不传时使用编辑器自带的本地图片上传。 */
	onPickImage?: () => void;
	/** 不传则隐藏入口；返回 null 表示取消或失败。 */
	onImportUrl?: (url: string, opts: ImportUrlOpts) => Promise<ImportUrlResult | null>;
	onImportUrlMeta?: (meta: ImportUrlMeta) => void;
	onImportUrlWarnings?: (warnings: string[]) => void;
	className?: string;
	/** 最小高度，单位 px，默认 420。 */
	minHeight?: number;
	/** 内容撑开高度，交由外层容器滚动。 */
	autoGrow?: boolean;
}

export interface ImportUrlOpts {
	/** 通过站点配置的 LLM 还原无法直接提取源码的公式。 */
	aiRestoreFormula: boolean;
}

export interface ImportUrlResult {
	html: string;
	/** 供父级回填表单空字段。 */
	meta?: ImportUrlMeta;
	/** 非致命导入提示，不阻止内容回填。 */
	warnings?: string[];
}

export interface ImportUrlMeta {
	title?: string;
	excerpt?: string;
	seo_title?: string;
	seo_description?: string;
}
