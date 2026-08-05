import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * 覆盖式滚动条组件
 *
 * 隐藏原生滚动条，渲染自定义 thumb 浮于内容上方，不占据布局空间。
 * 支持垂直/水平方向自动检测、拖拽 thumb 滚动。
 * thumb 在鼠标移入内容区或滚动时显示，移出后自动隐藏。
 */
const OverlayScroll = forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
	({ children, className, style, ...props }, ref) => {
		const scrollRef = useRef<HTMLDivElement>(null);
		const vThumbRef = useRef<HTMLDivElement>(null);
		const hThumbRef = useRef<HTMLDivElement>(null);
		const [hasV, setHasV] = useState(false);
		const [hasH, setHasH] = useState(false);
		const [visible, setVisible] = useState(false);

		const hoveringRef = useRef(false);
		const draggingRef = useRef(false);
		const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

		useImperativeHandle(ref, () => scrollRef.current ?? document.createElement("div"), []);

		const show = useCallback(() => {
			setVisible(true);
			if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
		}, []);

		const scheduleHide = useCallback((delay: number) => {
			if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
			hideTimerRef.current = setTimeout(() => {
				if (!hoveringRef.current && !draggingRef.current) {
					setVisible(false);
				}
			}, delay);
		}, []);

		useEffect(() => {
			const el = scrollRef.current;
			if (!el) return;

			let raf = 0;
			const update = () => {
				cancelAnimationFrame(raf);
				raf = requestAnimationFrame(() => {
					const {
						scrollTop,
						scrollLeft,
						scrollHeight,
						scrollWidth,
						clientHeight,
						clientWidth,
					} = el;
					const canV = scrollHeight > clientHeight + 1;
					const canH = scrollWidth > clientWidth + 1;
					setHasV(canV);
					setHasH(canH);

					// track 用 top-0.5/bottom-0.5（左右各 2px inset），thumb 位移上限要扣除这 4px，
					// 否则滚到末端 thumb 会越过 track 边界、被外层 overflow-hidden 裁掉。
					const TRACK_INSET = 4;
					if (canV && vThumbRef.current) {
						const thumbH = Math.max((clientHeight / scrollHeight) * clientHeight, 24);
						const maxTop = clientHeight - thumbH - TRACK_INSET;
						const top =
							maxTop > 0 ? (scrollTop / (scrollHeight - clientHeight)) * maxTop : 0;
						vThumbRef.current.style.height = `${thumbH}px`;
						vThumbRef.current.style.transform = `translateY(${top}px)`;
					}
					if (canH && hThumbRef.current) {
						const thumbW = Math.max((clientWidth / scrollWidth) * clientWidth, 24);
						const maxLeft = clientWidth - thumbW - TRACK_INSET;
						const left =
							maxLeft > 0 ? (scrollLeft / (scrollWidth - clientWidth)) * maxLeft : 0;
						hThumbRef.current.style.width = `${thumbW}px`;
						hThumbRef.current.style.transform = `translateX(${left}px)`;
					}
				});
			};

			const onScroll = () => {
				update();
				show();
				scheduleHide(800);
			};

			update();
			el.addEventListener("scroll", onScroll, { passive: true });
			const ro = new ResizeObserver(update);
			ro.observe(el);
			if (el.firstElementChild) ro.observe(el.firstElementChild);

			return () => {
				cancelAnimationFrame(raf);
				el.removeEventListener("scroll", onScroll);
				ro.disconnect();
				if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
			};
		}, [show, scheduleHide]);

		/** 垂直 thumb 拖拽 */
		const onVPointerDown = (e: React.PointerEvent) => {
			e.preventDefault();
			const el = scrollRef.current;
			if (!el) return;
			draggingRef.current = true;
			show();
			const startY = e.clientY;
			const startTop = el.scrollTop;
			const ratio = el.scrollHeight / el.clientHeight;

			const move = (ev: PointerEvent) => {
				el.scrollTop = startTop + (ev.clientY - startY) * ratio;
			};
			const up = () => {
				document.removeEventListener("pointermove", move);
				document.removeEventListener("pointerup", up);
				draggingRef.current = false;
				scheduleHide(800);
			};
			document.addEventListener("pointermove", move);
			document.addEventListener("pointerup", up);
		};

		/** 水平 thumb 拖拽 */
		const onHPointerDown = (e: React.PointerEvent) => {
			e.preventDefault();
			const el = scrollRef.current;
			if (!el) return;
			draggingRef.current = true;
			show();
			const startX = e.clientX;
			const startLeft = el.scrollLeft;
			const ratio = el.scrollWidth / el.clientWidth;

			const move = (ev: PointerEvent) => {
				el.scrollLeft = startLeft + (ev.clientX - startX) * ratio;
			};
			const up = () => {
				document.removeEventListener("pointermove", move);
				document.removeEventListener("pointerup", up);
				draggingRef.current = false;
				scheduleHide(800);
			};
			document.addEventListener("pointermove", move);
			document.addEventListener("pointerup", up);
		};

		const thumbClass = (extra: string) =>
			cn(
				"pointer-events-auto cursor-pointer touch-none rounded-full",
				"bg-foreground/20 hover:bg-foreground/40",
				"[transition:opacity_150ms,background-color_150ms]",
				visible ? "opacity-100" : "opacity-0",
				extra,
			);

		return (
			<div
				className="relative"
				onMouseEnter={() => {
					hoveringRef.current = true;
					show();
				}}
				onMouseLeave={() => {
					hoveringRef.current = false;
					scheduleHide(400);
				}}
			>
				<div
					ref={scrollRef}
					className={cn("os-host overflow-auto", className)}
					style={style}
					{...props}
				>
					{children}
				</div>
				{hasV && (
					<div className="pointer-events-none absolute right-0.5 top-0.5 bottom-0.5 z-50 w-1.5">
						<div
							ref={vThumbRef}
							className={thumbClass("absolute left-0 w-full")}
							style={{ willChange: "height, transform" }}
							onPointerDown={onVPointerDown}
						/>
					</div>
				)}
				{hasH && (
					<div className="pointer-events-none absolute bottom-0.5 left-0.5 right-0.5 z-50 h-1.5">
						<div
							ref={hThumbRef}
							className={thumbClass("absolute top-0 h-full")}
							style={{ willChange: "width, transform" }}
							onPointerDown={onHPointerDown}
						/>
					</div>
				)}
			</div>
		);
	},
);

OverlayScroll.displayName = "OverlayScroll";

export { OverlayScroll };
