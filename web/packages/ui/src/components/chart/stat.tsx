import { cn } from "cn";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { ComponentProps } from "react";

/** 变化量：箭头表示方向，颜色只做辅助，文字说明与上一期的比较。 */
export interface StatChange {
	direction: "up" | "down";
	/** 变化量文本，如「18%」 */
	value: string;
	/** 比较对象；默认「比上周」 */
	note?: string;
}

export interface StatProps extends Omit<ComponentProps<"div">, "children"> {
	/** 统计项名称，如「近 7 天访问」 */
	label: string;
	/** 已格式化的数值，如「12,480」 */
	value: string;
	/** 与上一期相比的变化 */
	change?: StatChange;
	/** 趋势数据；只画形态，不放坐标轴与网格 */
	trend?: readonly number[];
}

/** 把数值折成一条 120 × 32 的折线，超出两端的点留 2px 边距。 */
function sparklinePath(values: readonly number[]) {
	if (values.length < 2) return "";
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min || 1;
	return values
		.map((value, index) => {
			const x = (index / (values.length - 1)) * 120;
			const y = 30 - ((value - min) / span) * 28;
			return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
		})
		.join(" ");
}

/**
 * 统计数字：标签在上、等宽大号数值、带箭头的同比变化，可选一条迷你趋势线。
 *
 * @remarks
 * 整项以一句完整的话作为读屏名称（含比较方向），趋势线本身对读屏隐藏。
 */
export function Stat({ label, value, change, trend, className, ...props }: StatProps) {
	const summary = change
		? `${label} ${value}，${change.note ?? "比上周"}${change.direction === "up" ? "多" : "少"} ${change.value}`
		: `${label} ${value}`;
	const TrendIcon = change?.direction === "down" ? TrendingDown : TrendingUp;
	return (
		<div
			data-slot="stat"
			role="group"
			aria-label={summary}
			className={cn("v-stat", className)}
			{...props}
		>
			<span className="v-stat__label">{label}</span>
			<span className="v-stat__value">{value}</span>
			{change !== undefined ? (
				<span className="v-stat__change" data-direction={change.direction}>
					<TrendIcon aria-hidden="true" />
					<span className="v-stat__delta">{change.value}</span>
					<span className="v-stat__note">{change.note ?? "比上周"}</span>
				</span>
			) : null}
			{trend !== undefined && trend.length > 1 ? (
				<svg className="v-stat__spark" viewBox="0 0 120 32" aria-hidden="true">
					<path d={sparklinePath(trend)} />
				</svg>
			) : null}
		</div>
	);
}
