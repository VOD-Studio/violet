import { useViewportPreparation } from "@shared/hooks/use-viewport-preparation";
import { createAsyncLoader } from "@shared/lib/create-async-loader";
import { scheduleEnhancement } from "@shared/lib/schedule-enhancement";
import { cn } from "cn";
import { type ReactNode, useCallback, useEffect, useId, useRef } from "react";

const STROKE_INSET = 3;
const PALETTE = { ink: "currentColor" };
const loadInkline = createAsyncLoader(() =>
	Promise.all([import("@violetjs/inkline"), import("@violetjs/inkline/svg")]),
);

/**
 * 按内容几何绘制外框的参数。
 *
 * @remarks children 不等待装饰；frameClassName 只控制 currentColor，不参与几何缓存键。
 */
export interface SketchFrameProps {
	children: ReactNode;
	className?: string;
	/**
	 * 以 CSS 像素计的几何圆角，变化时重新绘制。
	 *
	 * @default 16
	 */
	radius?: number;
	/** 外框描边色取自容器 `color`，用 text-* 类控制。 */
	frameClassName?: string;
}

/**
 * 随所属内容接近视口准备手绘外框，SSR 与无 JS 时内容照常显示。
 *
 * @remarks 模块 Promise 在实例间共享；尺寸、圆角与稳定种子不变时复用原 SVG。
 * 尺寸变化取消尚未执行的旧绘制，卸载后停止观察；资源或绘制失败不移除正文和已有外框。
 */
export function SketchFrame({
	children,
	className,
	radius = 16,
	frameClassName = "text-primary/45",
}: SketchFrameProps) {
	const host = useRef<HTMLDivElement>(null);
	const layer = useRef<HTMLDivElement>(null);
	const id = useId();
	const geometry = useRef<{ width: number; height: number; radius: number; id: string } | null>(
		null,
	);
	const { ref, ready } = useViewportPreparation<HTMLDivElement>();
	const hostRef = useCallback(
		(node: HTMLDivElement | null) => {
			host.current = node;
			ref(node);
		},
		[ref],
	);

	useEffect(() => {
		const box = host.current;
		const target = layer.current;
		if (!ready || !box || !target) return;
		const controller = new AbortController();
		let cancelPaint: AbortController | undefined;
		let observer: ResizeObserver | undefined;
		void loadInkline()
			.then(([{ draw, gpen, hashString, rect, styles }, { mountSvg }]) => {
				if (controller.signal.aborted) return;
				const seed = hashString(id);
				const schedule = () => {
					cancelPaint?.abort();
					cancelPaint = new AbortController();
					void scheduleEnhancement(
						() => {
							const { width, height } = box.getBoundingClientRect();
							if (width < 8 || height < 8) return;
							const previous = geometry.current;
							if (
								previous?.width === width &&
								previous.height === height &&
								previous.radius === radius &&
								previous.id === id
							)
								return;
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
							svg.setAttribute(
								"style",
								"width:100%;height:100%;display:block;overflow:visible",
							);
							svg.setAttribute("aria-hidden", "true");
							target.replaceChildren(svg);
							geometry.current = { width, height, radius, id };
						},
						{ element: box, signal: cancelPaint.signal },
					).catch(() => {
						// 绘制失败时保留正文与上一张外框，不让装饰错误阻断阅读。
					});
				};
				observer = new ResizeObserver(schedule);
				observer.observe(box);
				schedule();
			})
			.catch(() => {
				// 装饰模块加载失败不阻断正文阅读。
			});
		return () => {
			controller.abort();
			cancelPaint?.abort();
			observer?.disconnect();
		};
	}, [ready, radius, id]);

	return (
		<div ref={hostRef} className={cn("relative", className)}>
			{children}
			<div
				ref={layer}
				aria-hidden="true"
				className={cn("pointer-events-none absolute inset-0", frameClassName)}
			/>
		</div>
	);
}
