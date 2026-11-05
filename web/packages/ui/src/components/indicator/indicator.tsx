import { cn } from "cn";
import type { ComponentProps, CSSProperties } from "react";
import { FLOWER_VIEWBOX, FLOWERS, type FlowerKind } from "./flower-paths";

/** 五档尺寸：16、20、24、32、48；梅枝宽度为三倍。 */
export type IndicatorSize = 16 | 20 | 24 | 32 | 48;

const DEFAULT_SIZE: IndicatorSize = 24;

export interface FlowerBloomProps extends Omit<ComponentProps<"span">, "children"> {
	/** 花形；省略时由站点季节决定 */
	kind?: FlowerKind;
	/** 尺寸档；默认 24 */
	size?: IndicatorSize;
}

interface NodeProps {
	kind: "draw" | "pop";
	index: number;
	props: Record<string, string | number>;
	children?: NodeProps[];
}

function FlowerNodeView({ node }: { node: NodeProps }) {
	if (node.children) {
		return (
			<g
				className="v-flower__pop"
				style={{ "--v-flower-index": node.index } as CSSProperties}
			>
				{node.children.map((child, i) => (
					<FlowerNodeView key={i} node={child} />
				))}
			</g>
		);
	}
	const { className, ...rest } = node.props;
	const cls = cn(
		node.kind === "draw" ? "v-flower__draw" : "v-flower__pop",
		className as string | undefined,
	);
	const style = { "--v-flower-index": node.index } as CSSProperties;
	// circle 与 path 都是合法 SVG 图形节点，props 直接透传
	return "d" in rest ? (
		<path {...rest} className={cls} pathLength={1} style={style} />
	) : (
		<circle {...rest} className={cls} pathLength={1} style={style} />
	);
}

/**
 * 块状等待花形：逐瓣描线、停留、淡去，循环；颜色取 currentColor。
 *
 * @remarks 装饰性用法由调用方标 `aria-hidden`；承载语义时容器挂 `role="status"` 与
 * `aria-live="polite"`，配合 `useDelayedBusy` 做 200ms 延迟显示与 400ms 最短停留。
 * 减弱动态时 CSS 停在花完全开放的一帧。
 */
export function FlowerBloom({
	kind = "plum",
	size = DEFAULT_SIZE,
	className,
	...props
}: FlowerBloomProps) {
	const viewBox = FLOWER_VIEWBOX[kind];
	return (
		<span
			{...props}
			className={cn("v-flower", `v-flower--${kind}`, className)}
			style={{ "--v-flower-size": `${size}px`, ...props.style } as CSSProperties}
		>
			<svg viewBox={viewBox} aria-hidden="true" focusable="false">
				{FLOWERS[kind].map((node, i) => (
					<FlowerNodeView key={i} node={node as NodeProps} />
				))}
			</svg>
		</span>
	);
}

export interface SpinnerProps extends Omit<ComponentProps<"span">, "children"> {
	/** 尺寸档；默认 16（控件内） */
	size?: IndicatorSize;
}

/**
 * 控件内加载细圆弧：旋转 + 虚线伸缩，颜色取 currentColor，不带底色与轨道。
 *
 * @remarks 装饰性用法由调用方标 `aria-hidden`；`aria-busy` 由承载控件立即生效。
 */
export function Spinner({ size = 16, className, ...props }: SpinnerProps) {
	return (
		<span
			{...props}
			className={cn("v-spinner", className)}
			style={{ "--v-spinner-size": `${size}px`, ...props.style } as CSSProperties}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
				<circle
					className="v-spinner__arc"
					cx="8"
					cy="8"
					r="6.97"
					pathLength={100}
					transform="rotate(-90 8 8)"
				/>
			</svg>
		</span>
	);
}
