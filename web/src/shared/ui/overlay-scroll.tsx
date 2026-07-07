import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * 覆盖式滚动条组件
 *
 * 隐藏原生滚动条，渲染自定义 thumb 浮于内容上方，不占据布局空间。
 * 支持垂直/水平方向自动检测、拖拽 thumb 滚动。
 */
const OverlayScroll = forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
    ({ children, className, style, ...props }, ref) => {
        const scrollRef = useRef<HTMLDivElement>(null);
        const vThumbRef = useRef<HTMLDivElement>(null);
        const hThumbRef = useRef<HTMLDivElement>(null);
        const [hasV, setHasV] = useState(false);
        const [hasH, setHasH] = useState(false);

        useImperativeHandle(ref, () => scrollRef.current ?? document.createElement("div"), []);

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

                    if (canV && vThumbRef.current) {
                        const thumbH = Math.max((clientHeight / scrollHeight) * clientHeight, 24);
                        const maxTop = clientHeight - thumbH;
                        const top =
                            maxTop > 0 ? (scrollTop / (scrollHeight - clientHeight)) * maxTop : 0;
                        vThumbRef.current.style.height = `${thumbH}px`;
                        vThumbRef.current.style.transform = `translateY(${top}px)`;
                    }
                    if (canH && hThumbRef.current) {
                        const thumbW = Math.max((clientWidth / scrollWidth) * clientWidth, 24);
                        const maxLeft = clientWidth - thumbW;
                        const left =
                            maxLeft > 0 ? (scrollLeft / (scrollWidth - clientWidth)) * maxLeft : 0;
                        hThumbRef.current.style.width = `${thumbW}px`;
                        hThumbRef.current.style.transform = `translateX(${left}px)`;
                    }
                });
            };

            update();
            el.addEventListener("scroll", update, { passive: true });
            const ro = new ResizeObserver(update);
            ro.observe(el);
            if (el.firstElementChild) ro.observe(el.firstElementChild);

            return () => {
                cancelAnimationFrame(raf);
                el.removeEventListener("scroll", update);
                ro.disconnect();
            };
        }, []);

        /** 垂直 thumb 拖拽 */
        const onVPointerDown = (e: React.PointerEvent) => {
            e.preventDefault();
            const el = scrollRef.current;
            if (!el) return;
            const startY = e.clientY;
            const startTop = el.scrollTop;
            const ratio = el.scrollHeight / el.clientHeight;

            const move = (ev: PointerEvent) => {
                el.scrollTop = startTop + (ev.clientY - startY) * ratio;
            };
            const up = () => {
                document.removeEventListener("pointermove", move);
                document.removeEventListener("pointerup", up);
            };
            document.addEventListener("pointermove", move);
            document.addEventListener("pointerup", up);
        };

        /** 水平 thumb 拖拽 */
        const onHPointerDown = (e: React.PointerEvent) => {
            e.preventDefault();
            const el = scrollRef.current;
            if (!el) return;
            const startX = e.clientX;
            const startLeft = el.scrollLeft;
            const ratio = el.scrollWidth / el.clientWidth;

            const move = (ev: PointerEvent) => {
                el.scrollLeft = startLeft + (ev.clientX - startX) * ratio;
            };
            const up = () => {
                document.removeEventListener("pointermove", move);
                document.removeEventListener("pointerup", up);
            };
            document.addEventListener("pointermove", move);
            document.addEventListener("pointerup", up);
        };

        return (
            <div className="relative">
                <div
                    ref={scrollRef}
                    className={cn("os-host overflow-auto", className)}
                    style={style}
                    {...props}
                >
                    {children}
                </div>
                {hasV && (
                    <div className="pointer-events-none absolute right-0.5 top-0.5 bottom-0.5 w-1.5">
                        <div
                            ref={vThumbRef}
                            className="pointer-events-auto absolute left-0 w-full cursor-pointer touch-none rounded-full bg-foreground/20 transition-colors hover:bg-foreground/40"
                            style={{ willChange: "height, transform" }}
                            onPointerDown={onVPointerDown}
                        />
                    </div>
                )}
                {hasH && (
                    <div className="pointer-events-none absolute bottom-0.5 left-0.5 right-0.5 h-1.5">
                        <div
                            ref={hThumbRef}
                            className="pointer-events-auto absolute top-0 h-full cursor-pointer touch-none rounded-full bg-foreground/20 transition-colors hover:bg-foreground/40"
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
