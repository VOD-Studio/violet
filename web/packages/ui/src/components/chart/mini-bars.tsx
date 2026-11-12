import { cn } from "cn";
import { type ComponentProps, useState } from "react";

/** 迷你柱状图的一项：日期或类别，与一个数值。 */
export interface MiniBarsDatum {
	label: string;
	value: number;
}

export interface MiniBarsProps extends Omit<ComponentProps<"div">, "children"> {
	data: readonly MiniBarsDatum[];
	/** 数值格式化；默认按本地数字格式 */
	formatValue?: (value: number) => string;
	/** 悬停时数值后的单位，如「访问」 */
	unit?: string;
	/** 读屏用的一句话；省略时按数据自动生成 */
	summary?: string;
}

/**
 * 只给趋势的迷你柱状图：不放坐标轴、网格与图例，指针移到一根柱子才显示具体数。
 *
 * @remarks
 * 图形对本读屏隐藏，同样信息由根节点的 `aria-label` 提供；悬停提示仅作视觉补充。
 */
export function MiniBars({ data, formatValue, unit, summary, className, ...props }: MiniBarsProps) {
	const [active, setActive] = useState<number | null>(null);
	const max = Math.max(1, ...data.map((item) => item.value));
	const format = formatValue ?? ((value: number) => value.toLocaleString());
	const description =
		summary ?? data.map((item) => `${item.label} ${format(item.value)}`).join("，");
	return (
		<div
			data-slot="mini-bars"
			role="img"
			aria-label={description}
			className={cn("v-mini-bars", className)}
			{...props}
		>
			{data.map((item, index) => (
				<span
					key={`${index}-${item.label}`}
					className="v-mini-bars__item"
					data-active={active === index ? "" : undefined}
					onPointerEnter={() => setActive(index)}
					onPointerLeave={() =>
						setActive((current) => (current === index ? null : current))
					}
				>
					<i
						className="v-mini-bars__bar"
						style={{
							blockSize: `${Math.max(4, Math.round((item.value / max) * 60))}px`,
						}}
					/>
					<span className="v-mini-bars__label">{item.label}</span>
				</span>
			))}
			{active !== null && data[active] !== undefined ? (
				<span
					className="v-mini-bars__tip"
					aria-hidden="true"
					style={{
						left: `clamp(3rem, ${active * 54 + 22}px, calc(100% - 3rem))`,
					}}
				>
					<b>{format(data[active].value)}</b>
					<span>
						{data[active].label}
						{unit !== undefined ? ` ${unit}` : ""}
					</span>
				</span>
			) : null}
		</div>
	);
}
