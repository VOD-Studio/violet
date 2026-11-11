import { cn } from "cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useComposedRefs } from "radix-ui/internal";
import { type ComponentProps, useId, useRef } from "react";
import { Button } from "../button";
import { iconProps } from "../icons";
import { type ScrollEdge, type ScrollOrientation, scrollEdges } from "./scroll-metrics";
import { Scrollbar } from "./scrollbar";
import { useScrollState } from "./use-scroll-state";

/** 横向翻页每次移动视口宽度的 80%，留一截已读内容作位置参照。 */
const PAGE_RATIO = 0.8;

const FADE_EDGES: ScrollEdge[] = ["top", "bottom", "left", "right"];

type AccessibleName = { "aria-label": string } | { "aria-labelledby": string };

interface ScrollAreaOptions extends ComponentProps<"div"> {
	/** 允许滚动的方向；horizontal 与 both 另有左右翻页按钮，不必拖动也能到达。 */
	orientation?: ScrollOrientation;
	/** 调整内部滚动视口；className 只作用于外层布局。 */
	viewportClassName?: string;
}

/**
 * ScrollArea 的属性。ref、style、id、事件与其余原生属性都落在滚动视口上。
 *
 * @remarks 视口可聚焦，默认角色是 region，因此必须命名。
 */
export type ScrollAreaProps = ScrollAreaOptions & AccessibleName;

/**
 * 原生滚动视口加覆盖式滑块；滑块不占布局，内容还能继续滚动的一侧显示 24px 渐隐。
 *
 * @example
 * <ScrollArea aria-label="章节目录" style={{ blockSize: 256 }}>
 *   <ol>{items}</ol>
 * </ScrollArea>
 */
export function ScrollArea({
	ref,
	id,
	role = "region",
	tabIndex = 0,
	className,
	viewportClassName,
	orientation = "vertical",
	children,
	...props
}: ScrollAreaProps) {
	const generatedId = useId();
	const viewportId = id ?? generatedId;
	const viewportRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const composedRef = useComposedRefs(ref, viewportRef);
	const { metrics, scrolling } = useScrollState(viewportRef, contentRef);
	const edges = scrollEdges(metrics, orientation);

	const scrollPage = (direction: -1 | 1) => {
		const viewport = viewportRef.current;
		if (!viewport) return;

		const maxLeft = viewport.scrollWidth - viewport.clientWidth;
		const step = viewport.clientWidth * PAGE_RATIO * direction;
		const left = Math.min(maxLeft, Math.max(0, viewport.scrollLeft + step));
		const reducedMotion =
			matchMedia("(prefers-reduced-motion: reduce)").matches ||
			viewport.closest('[data-motion="reduce"]') !== null;

		viewport.scrollTo({ left, behavior: reducedMotion ? "auto" : "smooth" });

		// 到头后这一侧的按钮会消失；焦点先交给视口，键盘用户可以接着用方向键。
		if (left <= 0 || left >= maxLeft) viewport.focus({ preventScroll: true });
	};

	return (
		<div
			className={cn("v-scroll-area", className)}
			data-orientation={orientation}
			data-scrolling={scrolling || undefined}
		>
			<div
				{...props}
				ref={composedRef}
				id={viewportId}
				role={role}
				tabIndex={tabIndex}
				className={cn("v-scroll-area__viewport", viewportClassName)}
				data-slot="scroll-area-viewport"
				data-scrollbar="none"
			>
				<div ref={contentRef} className="v-scroll-area__content">
					{children}
				</div>
			</div>

			{FADE_EDGES.filter((edge) => edges[edge]).map((edge) => (
				<div
					key={edge}
					className="v-scroll-area__fade"
					data-edge={edge}
					aria-hidden="true"
				/>
			))}

			{orientation !== "horizontal" && (
				<Scrollbar axis="vertical" metrics={metrics} viewport={viewportRef} />
			)}
			{orientation !== "vertical" && (
				<Scrollbar axis="horizontal" metrics={metrics} viewport={viewportRef} />
			)}

			{edges.left && (
				<Button
					iconOnly
					size="sm"
					className="v-scroll-area__page"
					data-edge="left"
					aria-label="向左滚动"
					aria-controls={viewportId}
					onClick={() => scrollPage(-1)}
				>
					<ChevronLeft {...iconProps()} />
				</Button>
			)}
			{edges.right && (
				<Button
					iconOnly
					size="sm"
					className="v-scroll-area__page"
					data-edge="right"
					aria-label="向右滚动"
					aria-controls={viewportId}
					onClick={() => scrollPage(1)}
				>
					<ChevronRight {...iconProps()} />
				</Button>
			)}
		</div>
	);
}
