export interface TocNode {
	id: string;
	title: string;
	children?: TocNode[];
}

export interface ArticleSection {
	id: string;
	title: string;
	lead: string;
	paragraphs: string[];
	children?: ArticleSection[];
}

export type TocVariant = "liquid" | "monograph" | "kinetic" | "capsule" | "minimap";

export const ARTICLE: ArticleSection[] = [
	{
		id: "opening",
		title: "从一张空白地图开始",
		lead: "目录不是文章的缩略图，而是读者此刻所在位置的地图。",
		paragraphs: [
			"一篇长文真正展开时，读者面对的并不只是字数，而是一连串判断：已经读到哪里，前面建立了什么，下一步会进入怎样的论证。好的目录把这些判断变成可见的结构，让阅读不必反复回头确认。",
			"这份演示文章固定使用三层章节。所有目录方案都读取同一棵树，因此视觉变化不会偷换信息，也不会因为切换方案而改变正文位置。",
		],
		children: [
			{
				id: "opening-orientation",
				title: "方向感先于进度",
				lead: "百分比告诉你还有多远，层级告诉你正在经过什么。",
				paragraphs: [
					"传统进度条擅长表达长度，却无法说明结构。读到百分之六十，可能仍在铺垫，也可能已经进入结论。目录高亮把抽象比例还原为语义位置，读者可以据此决定继续、跳读或暂时离开。",
				],
			},
			{
				id: "opening-contract",
				title: "一棵树的共同契约",
				lead: "标题、锚点和父子关系只定义一次。",
				paragraphs: [
					"正文与导航共享节点标识。点击条目时，浏览器直接把对应章节滚入视口；章节进入观察区域后，同一个标识再驱动目录高亮。数据不复制，交互就不会在维护中逐渐分叉。",
				],
			},
		],
	},
	{
		id: "rhythm",
		title: "让结构拥有阅读节奏",
		lead: "层级需要被看见，但不应比文章本身更响亮。",
		paragraphs: [
			"目录的字号、留白、连线和序号共同建立节奏。一级章节负责划分旅程，二级章节提供路标，三级章节只在需要时补充精度。视觉权重必须随层级递减，避免整棵树变成密集的按钮矩阵。",
			"在桌面布局中，目录停留在阅读列旁边，形成稳定参照。窄屏没有足够横向空间，目录退化为正文前的紧凑导航，仍然保留完整结构和点击能力。",
		],
		children: [
			{
				id: "rhythm-active",
				title: "当前章节是一束光",
				lead: "高亮应该明确，但不打断余光中的全局结构。",
				paragraphs: [
					"活动状态可以是细线、圆点、字重或局部底色。最重要的是变化发生在固定几何中，不让目录因高亮而左右跳动。柔和弹簧适合短距离反馈，较大位移则在减少动态偏好下立即完成。",
				],
				children: [
					{
						id: "rhythm-active-quiet",
						title: "安静的确认",
						lead: "反馈服务于定位，不争夺阅读注意力。",
						paragraphs: [
							"当新章节进入观察带，高亮平稳交接。没有闪烁，没有整列位移，也没有需要等待结束的装饰动画。读者只会自然地意识到，地图已经跟上脚步。",
						],
					},
				],
			},
			{
				id: "rhythm-collapse",
				title: "折叠是选择，不是丢失",
				lead: "收起后代只改变密度，不改变追踪状态。",
				paragraphs: [
					"折叠适合章节很多的文章。即便当前小节被隐藏，观察器仍然追踪正文，父级条目也可以提示其分支正在阅读中。再次展开时，精确位置立即恢复。",
				],
			},
		],
	},
	{
		id: "navigation",
		title: "导航动作必须可信",
		lead: "读者点击目录，是在发出明确的位置请求。",
		paragraphs: [
			"点击后的滚动应当温和而直接。系统偏好减少动态时立即跳转，其他情况下使用浏览器原生平滑滚动。标题预留滚动边距，避免停在吸顶区域下方。",
			"方案切换只替换目录表现层。正文节点、滚动容器与观察器持续存在，所以阅读位置不会被重置，当前章节也不会回到开头。",
		],
		children: [
			{
				id: "navigation-observer",
				title: "观察，而不是追赶滚动",
				lead: "IntersectionObserver 让浏览器报告章节交会。",
				paragraphs: [
					"页面不注册持续触发的滚动监听器。观察区域位于视口上半部，当标题穿过这条阅读基线时更新活动章节。这样既减少主线程工作，也让规则与视觉位置保持一致。",
				],
			},
			{
				id: "navigation-return",
				title: "随时回到全局",
				lead: "局部定位之外，目录仍要保留文章全貌。",
				paragraphs: [
					"活动条目之外的节点保持可读，父子缩进清楚但克制。读者可以从细节直接跳到下一章，也可以回到上一节核对前提，不需要先退出当前阅读情境。",
				],
			},
		],
	},
	{
		id: "ending",
		title: "目录最终消失在阅读里",
		lead: "最成熟的导航不会要求读者学习它。",
		paragraphs: [
			"五种方案使用不同隐喻：编辑轨道强调章节序列，生长枝条表达父子关系，极简索引追求低噪声，折叠大纲管理密度，星座则用节点间的距离塑造空间感。它们共享同一交互合同，却给出截然不同的阅读气质。",
			"当目录工作得足够好，读者记住的是文章的结构，而不是控件本身。地图完成了使命，便安静地退到文字旁边。",
		],
	},
];

export const TOC_TREE: TocNode[] = ARTICLE.map(function toNode(section): TocNode {
	return {
		id: section.id,
		title: section.title,
		children: section.children?.map(toNode),
	};
});

export const ALL_SECTION_IDS = TOC_TREE.flatMap(function flatten(node): string[] {
	return [node.id, ...(node.children?.flatMap(flatten) ?? [])];
});
