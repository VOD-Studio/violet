import type { CSSProperties } from "react";

/**
 * PROTOTYPE — 可丢弃。设计稿「基础」的色值公式，来自
 * docs/design/ued/project/Controls.dc.html 的 renderVals。
 * 只作用于原型根节点的内联样式，不碰全局 token。
 */
export type Season = "春" | "夏" | "秋" | "冬";
export type Mode = "light" | "dark";

export const SEASONS: Record<Season, { seed: string; hue: number; name: string }> = {
	春: { seed: "#f47983", hue: 16.6, name: "花朝" },
	夏: { seed: "#2f9e7a", hue: 162, name: "荷风" },
	秋: { seed: "#d9a21b", hue: 82.95, name: "桂月" },
	冬: { seed: "#7d8ea3", hue: 252, name: "初雪" },
};

export function seasonVars(season: Season, mode: Mode): CSSProperties {
	const { seed, hue: h } = SEASONS[season];
	const light = {
		"--bg": `oklch(0.968 0.006 ${h})`,
		"--sheet": `oklch(0.994 0.003 ${h})`,
		"--sunk": `oklch(0.945 0.007 ${h})`,
		"--fg": `oklch(0.3331 0.0175 ${h})`,
		"--muted": `oklch(0.4717 0.0225 ${h})`,
		"--rule": `oklch(0.3331 0.0175 ${h} / .11)`,
		"--rule2": `oklch(0.3331 0.0175 ${h} / .3)`,
		"--deco": seed,
		"--accent": `oklch(0.4739 0.0974 ${h})`,
		"--danger": "oklch(0.52 0.16 27)",
		"--ok": "oklch(0.52 0.13 155)",
		"--ol": "transparent",
	};
	const dark = {
		"--bg": `oklch(0.17 0.0087 ${h})`,
		"--sheet": `oklch(0.235 0.011 ${h})`,
		"--sunk": `oklch(0.29 0.012 ${h})`,
		"--fg": `oklch(0.9373 0.015 ${h})`,
		"--muted": `oklch(0.8573 0.0225 ${h})`,
		"--rule": `oklch(0.9373 0.015 ${h} / .12)`,
		"--rule2": `oklch(0.9373 0.015 ${h} / .3)`,
		"--deco": seed,
		"--accent": `oklch(0.8589 0.1031 ${h})`,
		"--danger": "oklch(0.74 0.14 25)",
		"--ok": "oklch(0.74 0.15 155)",
		"--ol": "rgb(255 255 255 / .08)",
	};
	return (mode === "dark" ? dark : light) as CSSProperties;
}

export const SOFT_SHADOW = "0 4px 24px rgb(0 0 0 / .05)";
