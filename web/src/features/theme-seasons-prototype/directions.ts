/**
 * PROTOTYPE（#645 四季主题样稿）：一次性代码，只在 prototype/theme-seasons 分支保留。
 *
 * 春夏秋三季已定 A「意象」（花朝、荷风、桂月），保留 B、C 作对照；冬季按冷、墨、暖三种气质重出六个候选。
 */

export type SeasonKey = "spring" | "summer" | "autumn" | "winter";
export type DirectionKey = "A" | "B" | "C" | "D" | "E" | "F";

export interface Season {
	key: SeasonKey;
	label: string;
	months: string;
	/** 与首页 HomeClosing 的季节寄语一致 */
	greeting: [string, string];
}

export interface Direction {
	id: `${SeasonKey}-${DirectionKey}`;
	season: SeasonKey;
	key: DirectionKey;
	name: string;
	seed: string;
	neutralChroma: number;
	note: string;
	/** 冬季候选的气质分组 */
	group?: string;
}

export const SEASONS: Season[] = [
	{ key: "spring", label: "春", months: "3–5 月", greeting: ["花朝如约", "春山可望"] },
	{ key: "summer", label: "夏", months: "6–8 月", greeting: ["熏风入弦", "荷风送香"] },
	{ key: "autumn", label: "秋", months: "9–11 月", greeting: ["桂月流光", "掬光以待"] },
	{ key: "winter", label: "冬", months: "12–2 月", greeting: ["梅信岁寒", "围炉夜话"] },
];

export const SETS: Record<"A" | "B" | "C", { name: string; summary: string }> = {
	A: { name: "意象", summary: "取寄语里的花木：桃花、荷叶、桂花、梅花" },
	B: { name: "对照", summary: "另一族色相：新柳、晴空、枫叶、霁雪" },
	C: { name: "紫系", summary: "四季都在紫色附近，只换冷暖与明度" },
};

export const DIRECTIONS: Direction[] = [
	{
		id: "spring-A",
		season: "spring",
		key: "A",
		name: "花朝",
		seed: "#f47983",
		neutralChroma: 0.02,
		note: "桃花粉。实色明亮，按钮配深色字。",
	},
	{
		id: "spring-B",
		season: "spring",
		key: "B",
		name: "新柳",
		seed: "#7fb53b",
		neutralChroma: 0.015,
		note: "嫩柳绿。实色明亮，按钮配深色字。",
	},
	{
		id: "spring-C",
		season: "spring",
		key: "C",
		name: "紫藤",
		seed: "#8a6fd1",
		neutralChroma: 0.015,
		note: "偏粉的浅紫，与现有 Violet 紫最接近。",
	},
	{
		id: "summer-A",
		season: "summer",
		key: "A",
		name: "荷风",
		seed: "#2f9e7a",
		neutralChroma: 0.012,
		note: "荷叶青绿。白字实色，偏沉静。",
	},
	{
		id: "summer-B",
		season: "summer",
		key: "B",
		name: "晴空",
		seed: "#2e8bd6",
		neutralChroma: 0.012,
		note: "湖蓝。白字实色，最通用。",
	},
	{
		id: "summer-C",
		season: "summer",
		key: "C",
		name: "鸢尾",
		seed: "#5566d9",
		neutralChroma: 0.015,
		note: "蓝紫。白字实色，紫系里最冷。",
	},
	{
		id: "autumn-A",
		season: "autumn",
		key: "A",
		name: "桂月",
		seed: "#d9a21b",
		neutralChroma: 0.025,
		note: "桂花金。实色明亮配深色字，中性色偏暖纸感。",
	},
	{
		id: "autumn-B",
		season: "autumn",
		key: "B",
		name: "枫丹",
		seed: "#c8452c",
		neutralChroma: 0.02,
		note: "枫叶朱红。白字实色，最浓烈。",
	},
	{
		id: "autumn-C",
		season: "autumn",
		key: "C",
		name: "葡萄",
		seed: "#7e4aa0",
		neutralChroma: 0.02,
		note: "暗紫红。白字实色，紫系里最暖。",
	},
	{
		id: "winter-A",
		season: "winter",
		key: "A",
		group: "冷",
		name: "初雪",
		seed: "#7d8ea3",
		neutralChroma: 0.008,
		note: "雪后银灰，带一点蓝。白字实色，几乎不抢内容。",
	},
	{
		id: "winter-B",
		season: "winter",
		key: "B",
		group: "冷",
		name: "冰凌",
		seed: "#7cc0e4",
		neutralChroma: 0.01,
		note: "冰面浅蓝。实色明亮配深色字，与花朝、桂月同属亮色一族。",
	},
	{
		id: "winter-C",
		season: "winter",
		key: "C",
		group: "墨",
		name: "松烟",
		seed: "#3d4046",
		neutralChroma: 0,
		note: "松烟墨。品牌色接近黑，中性色纯灰，只剩墨与纸。",
	},
	{
		id: "winter-D",
		season: "winter",
		key: "D",
		group: "墨",
		name: "玄青",
		seed: "#2c3440",
		neutralChroma: 0.004,
		note: "带青的墨。比松烟多一丝冷色。",
	},
	{
		id: "winter-E",
		season: "winter",
		key: "E",
		group: "暖",
		name: "围炉",
		seed: "#cf6a2e",
		neutralChroma: 0.02,
		note: "炉火橙。白字实色，对应「围炉夜话」。",
	},
	{
		id: "winter-F",
		season: "winter",
		key: "F",
		group: "暖",
		name: "栗褐",
		seed: "#8c5634",
		neutralChroma: 0.02,
		note: "烤栗子的褐色。白字实色，比围炉沉稳。",
	},
];

export const SEASON_BY_KEY = Object.fromEntries(
	SEASONS.map((season) => [season.key, season]),
) as Record<SeasonKey, Season>;

export function directionOf(season: SeasonKey, key: DirectionKey): Direction {
	return (
		DIRECTIONS.find((direction) => direction.season === season && direction.key === key) ??
		DIRECTIONS[0]
	);
}

/** 按 Asia/Shanghai 的月份解析当前季节（3–5 春、6–8 夏、9–11 秋、12–2 冬）。 */
export function currentSeason(date = new Date()): SeasonKey {
	const month = Number(
		new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", month: "numeric" }).format(
			date,
		),
	);
	if (month >= 3 && month <= 5) return "spring";
	if (month >= 6 && month <= 8) return "summer";
	if (month >= 9 && month <= 11) return "autumn";
	return "winter";
}

/** 二十四节气的近似日期（月, 日），年际误差 ±1 天，样稿够用。 */
const SOLAR_TERMS: [number, number, string][] = [
	[1, 6, "小寒"],
	[1, 20, "大寒"],
	[2, 4, "立春"],
	[2, 19, "雨水"],
	[3, 6, "惊蛰"],
	[3, 21, "春分"],
	[4, 5, "清明"],
	[4, 20, "谷雨"],
	[5, 6, "立夏"],
	[5, 21, "小满"],
	[6, 6, "芒种"],
	[6, 21, "夏至"],
	[7, 7, "小暑"],
	[7, 23, "大暑"],
	[8, 8, "立秋"],
	[8, 23, "处暑"],
	[9, 8, "白露"],
	[9, 23, "秋分"],
	[10, 8, "寒露"],
	[10, 23, "霜降"],
	[11, 7, "立冬"],
	[11, 22, "小雪"],
	[12, 7, "大雪"],
	[12, 22, "冬至"],
];

/** 每季取一个代表节气，用于手动选季时的点缀文案。 */
export const SEASON_TERM: Record<SeasonKey, string> = {
	spring: "清明",
	summer: "小暑",
	autumn: "霜降",
	winter: "小寒",
};

export function currentSolarTerm(date = new Date()): string {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: "Asia/Shanghai",
		month: "numeric",
		day: "numeric",
	}).formatToParts(date);
	const month = Number(parts.find((part) => part.type === "month")?.value);
	const day = Number(parts.find((part) => part.type === "day")?.value);
	let term = SOLAR_TERMS[SOLAR_TERMS.length - 1][2];
	for (const [m, d, name] of SOLAR_TERMS) if (month > m || (month === m && day >= d)) term = name;
	return term;
}
