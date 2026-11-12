/**
 * 六款当季花形的矢量定义，取自 UED 设计稿「指示器」页。
 *
 * 每款是一组 SVG 节点描述：`draw` 类节点参与描线动画（依 `index` 顺序错开），
 * `pop` 类节点在描线后淡入；`dot` 节点填充实色。坐标均基于 24×24 视窗，
 * `branch`（梅枝）例外，用 48×16 横幅视窗。
 */

/** 参与描线动画的节点；`index` 越大起描越晚。 */
export interface DrawNode {
	kind: "draw";
	index: number;
	/** 节点转成 SVG 的渲染属性 */
	props: Record<string, string | number>;
}

/** 描线完成后淡入的节点组。 */
export interface PopNode {
	kind: "pop";
	index: number;
	props: Record<string, string | number>;
	children?: PopNode[];
}

export type FlowerNode = DrawNode | PopNode;

/** 梅花：五瓣圆弧绕心开放，花心一点。 */
const plum: FlowerNode[] = [
	...Array.from(
		{ length: 5 },
		(_, i): FlowerNode => ({
			kind: "draw",
			index: i,
			props: {
				cx: 12,
				cy: 6.4,
				r: 3.6,
				pathLength: 1,
				transform: `rotate(${i * 72} 12 12)`,
			},
		}),
	),
	{
		kind: "pop",
		index: 3,
		props: { cx: 12, cy: 12, r: 1.3, className: "v-flower__dot" },
	},
];

/** 樱花：五瓣尖萼交替，中心花蕊点点。 */
const sakuraPetal = "M12 11.4 C9 9.2 8.4 5.2 10.1 2.6 L12 4.2 L13.9 2.6 C15.6 5.2 15 9.2 12 11.4 Z";
const sakura: FlowerNode[] = [
	...Array.from(
		{ length: 5 },
		(_, i): FlowerNode => ({
			kind: "draw",
			index: i,
			props: { d: sakuraPetal, pathLength: 1, transform: `rotate(${i * 72} 12 12)` },
		}),
	),
	...Array.from(
		{ length: 5 },
		(_, i): FlowerNode => ({
			kind: "pop",
			index: 5 + i * 0.6,
			props: {
				cx: 12 + 2.6 * Math.sin(((i * 72 + 36) * Math.PI) / 180),
				cy: 12 - 2.6 * Math.cos(((i * 72 + 36) * Math.PI) / 180),
				r: 0.55,
				className: "v-flower__dot",
			},
		}),
	),
];

/** 荷花：三瓣托二瓣，水面一横。 */
const lotus: FlowerNode[] = [
	{
		kind: "draw",
		index: 0,
		props: { d: "M4 22 C8 21 16 21 20 22", className: "v-flower__base" },
	},
	{
		kind: "draw",
		index: 0,
		props: { d: "M12 19.5 C9.6 16 9.6 9.5 12 4.2 C14.4 9.5 14.4 16 12 19.5 Z", pathLength: 1 },
	},
	{
		kind: "draw",
		index: 1,
		props: { d: "M12 19.5 C8 17.8 5.8 13 7.2 8.6 C9.8 10.4 11.4 14 12 19.5 Z", pathLength: 1 },
	},
	{
		kind: "draw",
		index: 1,
		props: {
			d: "M12 19.5 C16 17.8 18.2 13 16.8 8.6 C14.2 10.4 12.6 14 12 19.5 Z",
			pathLength: 1,
		},
	},
	{
		kind: "draw",
		index: 2.4,
		props: { d: "M12 19.5 C6.4 19.6 3 16.4 3 12.6 C6.2 12.2 10 15 12 19.5 Z", pathLength: 1 },
	},
	{
		kind: "draw",
		index: 2.4,
		props: {
			d: "M12 19.5 C17.6 19.6 21 16.4 21 12.6 C17.8 12.2 14 15 12 19.5 Z",
			pathLength: 1,
		},
	},
];

/** 桂花：一条花茎，簇簇四瓣小花点缀其上。 */
const osmanthusCluster = (cx: number, cy: number): PopNode => ({
	kind: "pop",
	index: 0,
	props: {},
	children: [
		{ kind: "pop", index: 0, props: { cx, cy, r: 1.15 } },
		{ kind: "pop", index: 0, props: { cx: cx + 2.6, cy, r: 1.15 } },
		{ kind: "pop", index: 0, props: { cx: cx + 1.3, cy: cy - 1.3, r: 1.15 } },
		{ kind: "pop", index: 0, props: { cx: cx + 1.3, cy: cy + 1.3, r: 1.15 } },
		{ kind: "pop", index: 0, props: { cx: cx + 1.3, cy, r: 0.6, className: "v-flower__dot" } },
	],
});
const osmanthus: FlowerNode[] = [
	{
		kind: "draw",
		index: 0,
		props: {
			d: "M3.5 20.5 C9 18.5 14.5 13 20.5 4.5",
			pathLength: 1,
			className: "v-flower__stem",
		},
	},
	osmanthusCluster(6.9, 17),
	osmanthusCluster(12.3, 12.3),
	osmanthusCluster(15.7, 8.2),
];

/** 雪花：六向枝干带分叉，整朵缓慢旋转。 */
const snowArm = "M12 12 V3 M12 6.8 L9.9 4.8 M12 6.8 L14.1 4.8";
const snow: FlowerNode[] = Array.from(
	{ length: 6 },
	(_, i): FlowerNode => ({
		kind: "draw",
		index: i * 0.7,
		props: { d: snowArm, pathLength: 1, transform: `rotate(${i * 60} 12 12)` },
	}),
);

/** 梅枝：一条横伸的枝，三朵梅花先后开放（48×16 横幅）。 */
const branchBloom = (cx: number, cy: number): PopNode => ({
	kind: "pop",
	index: 0,
	props: {},
	children: [
		{ kind: "pop", index: 0, props: { cx, cy, r: 2.4 } },
		{ kind: "pop", index: 0, props: { cx, cy, r: 0.7, className: "v-flower__dot" } },
	],
});
const branch: FlowerNode[] = [
	{
		kind: "draw",
		index: 0,
		props: {
			d: "M2 13 C10 13 13 8.5 21 9 C29 9.5 31 5 39 5 L46 4.2",
			pathLength: 1,
			className: "v-flower__stem",
		},
	},
	branchBloom(13.5, 9.9),
	branchBloom(27.5, 8.2),
	branchBloom(41, 4.6),
];

/** 花形全集：plum 梅花、sakura 樱花、lotus 荷花、osmanthus 桂花、snow 雪花、branch 梅枝。 */
export const FLOWERS = {
	plum,
	sakura,
	lotus,
	osmanthus,
	snow,
	branch,
} as const;

export type FlowerKind = keyof typeof FLOWERS;

/** 花形的季节默认：春樱花、夏荷花、秋桂花、冬梅花。 */
export const SEASON_FLOWER: Record<"spring" | "summer" | "autumn" | "winter", FlowerKind> = {
	spring: "sakura",
	summer: "lotus",
	autumn: "osmanthus",
	winter: "plum",
};

/** 各花形的视窗。 */
export const FLOWER_VIEWBOX: Record<FlowerKind, string> = {
	branch: "0 0 48 16",
	plum: "0 0 24 24",
	sakura: "0 0 24 24",
	lotus: "0 0 24 24",
	osmanthus: "0 0 24 24",
	snow: "0 0 24 24",
};
