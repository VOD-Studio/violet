import { useEffect, useRef, useState } from "react";

/**
 * CustomCursor - 全局自定义游标
 *
 * spec：靠近核心可点击元素产生磁力吸附与形变。
 * - pointer:fine 设备启用（触屏关闭）
 * - 标记了 data-cursor="magnetic" 的元素 hover 时游标放大并吸附形变
 *
 * SSR 安全：仅在 client 渲染（mounted 标记），首屏返回 null。
 * 挂载后给 <html> 加 .cursor-custom 隐藏系统游标。
 *
 * 磁性形变由元素自身位移（useMagnetic）+ 游标尺寸变化共同实现，
 * 本组件负责游标尺寸/hover 检测，不直接消费 useMagnetic。
 */
const CustomCursor = () => {
	const [mounted, setMounted] = useState(false);
	const dotRef = useRef<HTMLDivElement>(null);
	const [hovering, setHovering] = useState(false);

	useEffect(() => {
		setMounted(true);
		document.documentElement.classList.add("cursor-custom");

		const onMove = (e: MouseEvent) => {
			const dot = dotRef.current;
			if (!dot) return;
			dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
			const target = e.target as HTMLElement | null;
			const magnetic = target?.closest('[data-cursor="magnetic"]');
			setHovering(Boolean(magnetic));
		};
		window.addEventListener("mousemove", onMove);
		return () => {
			window.removeEventListener("mousemove", onMove);
			document.documentElement.classList.remove("cursor-custom");
		};
	}, []);

	if (!mounted) return null;

	return (
		<div
			ref={dotRef}
			aria-hidden
			className="pointer-events-none fixed left-0 top-0 z-[9998] -ml-2 -mt-2 transition-[width,height,background-color] duration-200"
			style={{
				width: hovering ? 32 : 12,
				height: hovering ? 32 : 12,
				borderRadius: "9999px",
				mixBlendMode: "difference",
				backgroundColor: hovering
					? "hsl(var(--neon-blue) / 0.5)"
					: "hsl(var(--foreground))",
			}}
		/>
	);
};

export { CustomCursor };
