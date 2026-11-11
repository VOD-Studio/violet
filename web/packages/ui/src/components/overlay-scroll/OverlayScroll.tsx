import { cn } from "cn";
import { forwardRef, useImperativeHandle, useRef } from "react";
import Scrollbars from "./Scrollbars";

/**
 * 隐藏原生滚动条，以可拖拽的覆盖式滑块显示元素的滚动位置。
 *
 * @remarks ref、style 与原生 div 属性属于滚动视口；className 属于外层布局容器。
 */
const OverlayScroll = forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
	({ children, className, style, ...props }, ref) => {
		const scrollRef = useRef<HTMLDivElement>(null);
		useImperativeHandle(ref, () => scrollRef.current ?? document.createElement("div"), []);

		return (
			<div className={cn("relative isolate", className)}>
				<div
					ref={scrollRef}
					className="isolate h-full overflow-auto"
					style={style}
					{...props}
					data-scrollbar="none"
				>
					{children}
				</div>
				<Scrollbars viewport={scrollRef} />
			</div>
		);
	},
);

OverlayScroll.displayName = "OverlayScroll";

export { OverlayScroll };
