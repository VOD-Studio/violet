import { cn } from "cn";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const THUMB_CLS =
	"pointer-events-auto cursor-pointer touch-none rounded-full bg-foreground/20 hover:bg-foreground/40 absolute";
const THUMB_TRANSITION = "opacity 150ms, background-color 150ms";

/**
 * 覆盖式滚动条组件
 *
 * 隐藏原生滚动条，渲染自定义 thumb 浮于内容上方，不占据布局空间。
 * 支持垂直/水平方向自动检测、拖拽 thumb 滚动。
 * thumb 在鼠标移入内容区或滚动时显示，移出后自动隐藏。
 *
 * wrapper 与滚动宿主各自隔离 stacking context，避免固定列与轨道 z-index 泄漏。
 * data-scrollbar="none" 由组件库的非分层样式提供，不能用 Tailwind utility：
 * 宿主未分层的全局 scrollbar-width 规则会覆盖分层 utility。
 */
const OverlayScroll = forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
	({ children, className, style, ...props }, ref) => {
		const scrollRef = useRef<HTMLDivElement>(null);
		const vTrackRef = useRef<HTMLDivElement>(null);
		const hTrackRef = useRef<HTMLDivElement>(null);
		const vThumbRef = useRef<HTMLDivElement>(null);
		const hThumbRef = useRef<HTMLDivElement>(null);

		const hoveringRef = useRef(false);
		const draggingRef = useRef(false);
		// window.setTimeout 的数字句柄：不引 NodeJS 类型，保持声明产物可移植。
		const hideTimerRef = useRef<number | undefined>(undefined);

		useImperativeHandle(ref, () => scrollRef.current ?? document.createElement("div"), []);

		useEffect(() => {
			const el = scrollRef.current;
			const vTrack = vTrackRef.current;
			const hTrack = hTrackRef.current;
			const vThumb = vThumbRef.current;
			const hThumb = hThumbRef.current;
			if (!el || !vTrack || !hTrack || !vThumb || !hThumb) return;

			let raf = 0;

			// --- visibility (直接操作 DOM class，不走 React) ---
			const showThumbs = () => {
				vThumb.style.opacity = "1";
				hThumb.style.opacity = "1";
				clearTimeout(hideTimerRef.current);
			};

			const hideThumbs = () => {
				vThumb.style.opacity = "0";
				hThumb.style.opacity = "0";
			};

			const scheduleHide = (delay: number) => {
				clearTimeout(hideTimerRef.current);
				hideTimerRef.current = window.setTimeout(() => {
					if (!hoveringRef.current && !draggingRef.current) {
						hideThumbs();
					}
				}, delay);
			};

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

					// 显隐 track（display 而非条件渲染，不触发 React）
					vTrack.style.display = canV ? "" : "none";
					hTrack.style.display = canH ? "" : "none";

					if (canV) {
						const trackHeight = vTrack.clientHeight;
						const thumbH = Math.min(
							Math.max((clientHeight / scrollHeight) * trackHeight, 24),
							trackHeight,
						);
						const travel = trackHeight - thumbH;
						vThumb.style.height = `${thumbH}px`;
						vThumb.style.transform = `translate3d(0,${(scrollTop / (scrollHeight - clientHeight)) * travel}px,0)`;
					}
					if (canH) {
						const trackWidth = hTrack.clientWidth;
						const thumbW = Math.min(
							Math.max((clientWidth / scrollWidth) * trackWidth, 24),
							trackWidth,
						);
						const travel = trackWidth - thumbW;
						hThumb.style.width = `${thumbW}px`;
						hThumb.style.transform = `translate3d(${(scrollLeft / (scrollWidth - clientWidth)) * travel}px,0,0)`;
					}
				});
			};

			const onScroll = () => {
				update();
				showThumbs();
				scheduleHide(800);
			};

			// --- 鼠标进出 ---
			const onMouseEnter = () => {
				hoveringRef.current = true;
				showThumbs();
			};
			const onMouseLeave = () => {
				hoveringRef.current = false;
				scheduleHide(400);
			};

			// 挂到外层 wrapper（el 的 parentElement）
			const wrapper = el.parentElement;
			wrapper?.addEventListener("mouseenter", onMouseEnter);
			wrapper?.addEventListener("mouseleave", onMouseLeave);

			// --- 拖拽 ---
			const onVPointerDown = (e: PointerEvent) => {
				e.preventDefault();
				draggingRef.current = true;
				showThumbs();
				const startY = e.clientY;
				const startTop = el.scrollTop;
				const travel = vTrack.clientHeight - vThumb.getBoundingClientRect().height;
				const ratio = travel > 0 ? (el.scrollHeight - el.clientHeight) / travel : 0;
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

			const onHPointerDown = (e: PointerEvent) => {
				e.preventDefault();
				draggingRef.current = true;
				showThumbs();
				const startX = e.clientX;
				const startLeft = el.scrollLeft;
				const travel = hTrack.clientWidth - hThumb.getBoundingClientRect().width;
				const ratio = travel > 0 ? (el.scrollWidth - el.clientWidth) / travel : 0;
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

			vThumb.addEventListener("pointerdown", onVPointerDown);
			hThumb.addEventListener("pointerdown", onHPointerDown);

			// 初始计算
			update();
			el.addEventListener("scroll", onScroll, { passive: true });
			const ro = new ResizeObserver(update);
			ro.observe(el);
			if (el.firstElementChild) ro.observe(el.firstElementChild);

			return () => {
				cancelAnimationFrame(raf);
				el.removeEventListener("scroll", onScroll);
				wrapper?.removeEventListener("mouseenter", onMouseEnter);
				wrapper?.removeEventListener("mouseleave", onMouseLeave);
				vThumb.removeEventListener("pointerdown", onVPointerDown);
				hThumb.removeEventListener("pointerdown", onHPointerDown);
				ro.disconnect();
				clearTimeout(hideTimerRef.current);
			};
		}, []);

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
				{/* 垂直滚动条 track — 始终挂载，通过 display:none 控制 */}
				<div
					ref={vTrackRef}
					className="pointer-events-none absolute right-0.5 top-0.5 bottom-0.5 z-1 w-1.5"
					style={{ display: "none" }}
				>
					<div
						ref={vThumbRef}
						className={cn(THUMB_CLS, "left-0 w-full")}
						style={{
							willChange: "transform",
							transition: THUMB_TRANSITION,
							opacity: 0,
						}}
					/>
				</div>
				{/* 水平滚动条 track */}
				<div
					ref={hTrackRef}
					className="pointer-events-none absolute bottom-0.5 left-0.5 right-0.5 z-1 h-1.5"
					style={{ display: "none" }}
				>
					<div
						ref={hThumbRef}
						className={cn(THUMB_CLS, "top-0 h-full")}
						style={{
							willChange: "transform",
							transition: THUMB_TRANSITION,
							opacity: 0,
						}}
					/>
				</div>
			</div>
		);
	},
);

OverlayScroll.displayName = "OverlayScroll";

export { OverlayScroll };
