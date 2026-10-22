/** 工作台的一节：左侧目录的一项，对应一个能力。 */
export interface WorkbenchSection {
	id: SectionId;
	/** 路径段，/inkline/<slug>；画稿一节是 /inkline 本身，为 null */
	slug: string | null;
	title: string;
	/** 舞台标题下的一句说明 */
	summary: string;
}

export type SectionId =
	| "artwork"
	| "export"
	| "quick-start"
	| "pens"
	| "hands"
	| "fills"
	| "redraw"
	| "palette";

export const SECTIONS: readonly WorkbenchSection[] = [
	{
		id: "artwork",
		slug: null,
		title: "画稿与时间轴",
		summary:
			"整幅插画按手绘时间轴落笔：先底纸，再线稿，最后上色。可顺序、并行或交错编排，随时暂停、拖动与变速，重放不重新生成笔画。",
	},
	{
		id: "export",
		slug: "export",
		title: "导出动画",
		summary:
			"把时间轴离线渲染成 GIF 或 WebM，与播放倍率无关；时长可按比例压缩，色表保留画稿原色，帧间只写变化部分。",
	},
	{
		id: "quick-start",
		slug: "quick-start",
		title: "快速上手",
		summary:
			"给形状，拿到手绘墨线。同一输入与 seed 永远得到同一结果，在服务端也能直接输出 SVG 字符串。",
	},
	{
		id: "pens",
		slug: "pens",
		title: "笔与压感",
		summary:
			"签字笔、钢笔、马克笔与 G 笔。笔决定笔尖形状与压力如何作用；压感是笔的属性，不是一种笔。",
	},
	{
		id: "hands",
		slug: "hands",
		title: "手法",
		summary:
			"工整、自然、草稿与勾线。手法决定扰动、弯曲、断笔与复线；换一个 seed 是另一次落笔，结果仍然确定。",
	},
	{
		id: "fills",
		slug: "fills",
		title: "填充与淡彩",
		summary: "排线、交叉线、锯齿、点阵与水彩般的淡彩，组合起来就是线描淡彩风格。",
	},
	{
		id: "redraw",
		slug: "redraw",
		title: "重画已有 SVG",
		summary:
			"inkSvg 把页面上已有的 SVG（Mermaid、Graphviz、D3）原地换成手绘笔触，保留布局、文字与箭头。",
	},
	{
		id: "palette",
		slug: "palette",
		title: "配色与换色",
		summary:
			"笔画只记颜色角色。切换明暗主题时用 updateSvgPalette 换色，几何不变，也不重新生成。",
	},
];

export function findSectionBySlug(slug: string): WorkbenchSection | undefined {
	return SECTIONS.find((section) => section.slug === slug);
}

/** 由当前路径取所在的节；/inkline 与无法识别的路径都落在画稿一节。 */
export function sectionFromPath(pathname: string): WorkbenchSection {
	const slug = pathname.replace(/^\/inkline\/?/, "").replace(/\/$/, "");
	return (slug && findSectionBySlug(slug)) || SECTIONS[0];
}
