import { createLucideIcon, type IconNode, type LucideProps } from "lucide-react";

/**
 * 自绘图标与 lucide 共用 24 网格、圆头圆角与 `currentColor`，默认线宽 1.75。
 * 尺寸与线宽仍由 `iconProps` 决定，这里只保证省略属性时与 lucide 图标同档。
 */
function createDrawnIcon(name: string, node: IconNode) {
	const Icon = createLucideIcon(name, node);
	return function DrawnIcon({ strokeWidth = 1.75, ...props }: LucideProps) {
		return <Icon strokeWidth={strokeWidth} {...props} />;
	};
}

/** 灵动岛：胶囊贴安全区左右边，右侧圆点是实时状态，不填实心。 */
export const IslandIcon = /* @__PURE__ */ createDrawnIcon("island", [
	["rect", { x: "2", y: "8", width: "20", height: "8", rx: "4", key: "frame" }],
	["circle", { cx: "17", cy: "12", r: "1.5", key: "dot" }],
]);

/** 时间线：节点 r 2，竖线在节点处断开 2，右侧两条长短不同的线表示条目。 */
export const TimelineIcon = /* @__PURE__ */ createDrawnIcon("timeline", [
	["path", { d: "M6 3v2M6 9v6M6 19v2", key: "stem" }],
	["circle", { cx: "6", cy: "7", r: "2", key: "top" }],
	["circle", { cx: "6", cy: "17", r: "2", key: "bottom" }],
	["path", { d: "M11 7h9M11 17h6", key: "entries" }],
]);

/** 变形：圆角 4 的外框是面板，左上的小胶囊是长成面板前的按钮。 */
export const MorphIcon = /* @__PURE__ */ createDrawnIcon("morph", [
	["rect", { x: "3", y: "3", width: "18", height: "18", rx: "4", key: "panel" }],
	["rect", { x: "6", y: "6", width: "8", height: "4", rx: "2", key: "trigger" }],
	["path", { d: "M6 14h12M6 17h8", key: "content" }],
]);
