/** 手册站点入口；章节页 URL 为 `${base}/${chapter.id}`。 */
export const EDITOR_GUIDE_BASE = "/editor-guide";

export interface EditorGuideChapter {
	/** URL 段，与 `web/src/features/editor/docs/` 下的 md 文件名一致 */
	id: string;
	/** 章节标题；页头、索引卡片与前后章导航共用 */
	title: string;
	/** 一句话范围说明 */
	description: string;
}

/** 章节清单；站内导航与索引页的唯一事实源，顺序即阅读顺序。 */
export const EDITOR_GUIDE_CHAPTERS: readonly EditorGuideChapter[] = [
	{
		id: "syntax",
		title: "基础语法",
		description:
			"文本样式、标题与目录、列表、引用与提示块、代码块、图片、表格、输入规则、Slash 菜单与脚注",
	},
	{
		id: "math",
		title: "数学公式",
		description: "KaTeX + mhchem + 物理宏表全清单，分学科综合实例画廊",
	},
	{
		id: "diagram",
		title: "图块与流程图",
		description: "Mermaid 全部图型示例、手绘渲染管线、渲染器注册表与扩展路线图",
	},
	{
		id: "persona-cards",
		title: "人物与语义内容卡片",
		description: "人物提及、对话气泡、GitHub 项目卡、推文与社交链接组、文章签名",
	},
	{
		id: "storage",
		title: "存储与有损",
		description: "content_html / content_md 双写边界、旧文章脚注修复指引、暂不支持清单",
	},
];

/**
 * 按 URL 段查章节；未知段返回 undefined，路由层据此 404。
 *
 * @param id - URL 中的章节段（与 md 文件名一致）
 */
export function findEditorGuideChapter(id: string): EditorGuideChapter | undefined {
	return EDITOR_GUIDE_CHAPTERS.find((chapter) => chapter.id === id);
}

/**
 * 章内互链改写为站内路由：`(./x.md)` → `(/editor-guide/x)`、`(./README.md)` → `(/editor-guide)`；
 * 仓库内阅读时仍是可点的相对链接。
 */
export function rewriteChapterLinks(source: string): string {
	let out = source.replaceAll("(./README.md)", `(${EDITOR_GUIDE_BASE})`);
	for (const chapter of EDITOR_GUIDE_CHAPTERS) {
		out = out.replaceAll(`(./${chapter.id}.md)`, `(${EDITOR_GUIDE_BASE}/${chapter.id})`);
	}
	return out;
}
