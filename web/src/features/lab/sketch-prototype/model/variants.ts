import { externalRibbonPen } from "@features/lab/sketch-prototype/external/ribbon";
import type { Pen } from "@violet/sketch";
import {
	createComicPen,
	createNaturalPen,
	createPencilPen,
	createPressurePen,
} from "@violet/sketch";

/** 实验页面的笔迹陈列配置，不限定核心支持的算法。 */
export interface Variant {
	key: string;
	title: string;
	note: string;
	createPen(): Pen;
}

/** 陈列配置不是引擎支持名单；任何满足 Pen 的对象都能生成同一种矢量数据。 */
export const variants: Variant[] = [
	{
		key: "natural",
		title: "自然线条",
		note: "保留精确端点和切线，局部弯曲表达手感，不做全局随机抖动。",
		createPen: () => createNaturalPen({ passes: 1, deviation: 1.1 }),
	},
	{
		key: "draft",
		title: "草稿速写",
		note: "主线之外保留独立复线；种子、复线与颜色互不耦合。",
		createPen: () => createNaturalPen({ passes: 3, deviation: 3.8 }),
	},
	{
		key: "pencil",
		title: "铅笔与纤维",
		note: "断续石墨纤维与独立颗粒；纯矢量而非贴一张纹理图片。",
		createPen: createPencilPen,
	},
	{
		key: "pressure",
		title: "书写压感",
		note: "沿弧长改变宽度；扁笔方向与短轴比例独立，不靠多画两条线模拟。",
		createPen: createPressurePen,
	},
	{
		key: "comic",
		title: "手绘彩漫",
		note: "完整彩色场景、矢量阴影和高光、压感轮廓；不是黑白漫画加色描边。",
		createPen: createComicPen,
	},
];

export const externalPen = externalRibbonPen;
