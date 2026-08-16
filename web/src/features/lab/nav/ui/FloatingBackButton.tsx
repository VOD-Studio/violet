import { ArrowLeft } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { DemoArticle } from "./DemoArticle";
import { useScrollVisibility } from "./use-scroll-visibility";

/**
 * FloatingBackButton - 方向②：浮动返回钮
 *
 * 滚过一屏阈值后左下浮出圆钮，回到顶部自动隐去。chrome 最少；
 * 生产可并入文章页右下已有的浮动操作区（目录 / 返回顶部同列竖排）。
 */
export function FloatingBackButton() {
	const scrollRef = useRef<HTMLDivElement>(null);
	const { past } = useScrollVisibility(scrollRef);
	const reduce = useReducedMotion();

	return (
		<div
			ref={scrollRef}
			className="relative h-[560px] overflow-y-auto rounded-xl border border-edge-hairline bg-background/60"
		>
			<DemoArticle />
			<AnimatePresence>
				{past && (
					<motion.button
						type="button"
						initial={reduce ? false : { opacity: 0, scale: 0.8, y: 8 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.8, y: 8 }}
						transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
						aria-label="返回博客"
						className="absolute bottom-6 left-6 z-10 flex size-11 cursor-pointer items-center justify-center rounded-full border border-edge-hairline bg-background/90 shadow-sm backdrop-blur transition-colors hover:border-foreground/40"
					>
						<ArrowLeft className="size-4" />
					</motion.button>
				)}
			</AnimatePresence>
		</div>
	);
}
