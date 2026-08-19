/** admin-stats 展示层纯函数：环比与里程碑刻度计算 */

export type DeltaDirection = "up" | "down" | "flat";

export interface Delta {
	direction: DeltaDirection;
	/** 相对变化百分比绝对值；基数为 0 时为 null（环比无意义） */
	percent: number | null;
}

/**
 * computeDelta - 计算环比。
 *
 * 基数（previous）为 0 时返回 null：首日浏览、上周无评论等场景显示「无对比」而非 +∞。
 *
 * @param current 本期值
 * @param previous 基期值
 * @returns 方向 + 百分比；基数为 0 或两期均为 0 时为 null
 */
export function computeDelta(current: number, previous: number): Delta | null {
	if (previous <= 0) return null;
	if (current === previous) return { direction: "flat", percent: 0 };
	const ratio = (current - previous) / previous;
	return {
		direction: ratio > 0 ? "up" : "down",
		percent: Math.round(Math.abs(ratio) * 1000) / 10,
	};
}

export interface Milestone {
	/** 下一刻度值 */
	target: number;
	/** 距刻度差值 */
	remaining: number;
	/** 0-1 区间进度 */
	progress: number;
}

/**
 * nextMilestone - 浏览量里程碑刻度。
 *
 * 刻度序列为 1×10^k 与 5×10^k 交替（1k → 5k → 10k → 50k → …，k≥3），
 * total 恰好落在刻度上时跳到下一档（「距下一个」语义）。
 *
 * @param total 累计浏览量
 */
export function nextMilestone(total: number): Milestone {
	const t = Math.max(0, total);
	// 刻度序列 1k → 5k → 10k → 50k → …：交替乘 5 与乘 2 推进
	let target = 1000;
	let mul = 5;
	while (t >= target) {
		target *= mul;
		mul = mul === 5 ? 2 : 5;
	}
	return {
		target,
		remaining: target - t,
		progress: t / target,
	};
}

/**
 * formatCompact - 大数字紧凑格式（1024 → 1k，15000 → 15k）。
 *
 * @param value 数值
 * @param locale 千分位格式化 locale，默认 zh-CN
 */
export function formatCompact(value: number, locale = "zh-CN"): string {
	return new Intl.NumberFormat(locale, { notation: "compact" }).format(value);
}
