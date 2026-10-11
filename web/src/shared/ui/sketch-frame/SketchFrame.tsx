import { draw, gpen, hashString, rect, styles } from "@violetjs/inkline";
import { mountSvg } from "@violetjs/inkline/svg";
import { cn } from "cn";
import { type ReactNode, useEffect, useId, useRef } from "react";

const STROKE_INSET = 3;
const PALETTE = { ink: "currentColor" };

export interface SketchFrameProps {
	children: ReactNode;
	className?: string;
	/** 圆角半径，px。 @default 16 */
	radius?: number;
	/** 外框描边色取自容器 `color`，用 text-* 类控制。 */
	frameClassName?: string;
}

/**
 * 给内容画一圈随尺寸重绘的手绘外框（G 笔 + 草稿手法）。
 *
 * @remarks 外框只在客户端挂载后绘制，SSR 与无 JS 时内容照常显示、仅缺外框。
 */
export function SketchFrame({
	children,
	className,
	radius = 16,
	frameClassName = "text-primary/45",
}: SketchFrameProps) {
	const host = useRef<HTMLDivElement>(null);
	const layer = useRef<HTMLDivElement>(null);
	const seed = hashString(useId());

	useEffect(() => {
		const box = host.current;
		const target = layer.current;
		if (!box || !target) return;
		let frame = 0;
		const paint = () => {
			const { width, height } = box.getBoundingClientRect();
			if (width < 8 || height < 8) return;
			const drawing = draw(
				{
					width,
					height,
					items: [
						{
							id: "frame",
							path: rect(
								STROKE_INSET,
								STROKE_INSET,
								width - STROKE_INSET * 2,
								height - STROKE_INSET * 2,
								radius,
							),
						},
					],
				},
				{ style: { ...styles.draft, pen: gpen }, seed, width: 2 },
			);
			const svg = mountSvg(drawing, PALETTE, { background: false });
			svg.setAttribute("style", "width:100%;height:100%;display:block;overflow:visible");
			svg.setAttribute("aria-hidden", "true");
			target.replaceChildren(svg);
		};
		const schedule = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(paint);
		};
		const observer = new ResizeObserver(schedule);
		observer.observe(box);
		schedule();
		return () => {
			cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, [radius, seed]);

	return (
		<div ref={host} className={cn("relative", className)}>
			{children}
			<div
				ref={layer}
				aria-hidden="true"
				className={cn("pointer-events-none absolute inset-0", frameClassName)}
			/>
		</div>
	);
}
