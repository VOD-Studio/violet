/**
 * BackToTop - 返回顶部按钮（带动画）
 *
 * 滚动超过阈值（默认 400px）时从右下方滑入显现，点击平滑滚动回顶部。
 * 常驻悬浮件保持安静中性磨砂胶囊（同 Header/音乐胶囊浮层语言），
 * 不沾品牌强调色——强调色只留给内容区的低占比强调。
 */
import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/shared/lib/utils";

export interface BackToTopProps {
	/** 显示阈值（滚动距离 px），默认 400 */
	threshold?: number;
	/**
	 * 自定义定位/外层类。默认 `fixed bottom-8 right-8`；
	 * 传入时会替换默认定位（用于嵌入共享 fixed 容器，如与目录浮动按钮竖列排列）。
	 */
	className?: string;
}

export function BackToTop({ threshold = 400, className }: BackToTopProps) {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const onScroll = () => setVisible(window.scrollY > threshold);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, [threshold]);

	const scrollToTop = () => {
		window.scrollTo({ top: 0, behavior: "smooth" });
	};

	return (
		<button
			type="button"
			onClick={scrollToTop}
			aria-label="返回顶部"
			className={cn(
				"group flex size-11 items-center justify-center rounded-full border border-edge-hairline bg-background/80 text-muted-foreground shadow-lg backdrop-blur-md transition-all duration-300",
				"hover:bg-background/95 hover:text-foreground active:scale-90",
				className ?? "fixed bottom-8 right-8 z-40",
				visible
					? "translate-y-0 scale-100 opacity-100"
					: "pointer-events-none translate-y-4 scale-75 opacity-0",
			)}
		>
			<ArrowUp className="size-5 transition-transform duration-300 group-hover:-translate-y-0.5" />
		</button>
	);
}
