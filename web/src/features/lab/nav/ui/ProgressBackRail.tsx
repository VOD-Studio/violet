import { ArrowLeft } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { DemoArticle, DemoStage } from "./DemoArticle";
import { useScrollVisibility } from "./use-scroll-visibility";

/**
 * ProgressBackRail - 方向④：进度线返回
 *
 * 复用文章页已有的顶部阅读进度线，滚过一屏后线上浮出返回箭头：
 * 进度与退路同框，不新增 chrome 语言。箭头与进度线都挂在 wrapper
 * 兄弟位，随滚动区视口常驻。
 */
export function ProgressBackRail() {
	const scrollRef = useRef<HTMLDivElement>(null);
	const { past, progress } = useScrollVisibility(scrollRef);
	const reduce = useReducedMotion();

	return (
		<DemoStage
			scrollRef={scrollRef}
			overlay={
				<>
					{/* 进度线：样式对齐 /blog/$slug 顶栏 */}
					<div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1">
						<div
							className="h-full bg-linear-to-r from-cyan-400 to-blue-500"
							style={{ width: `${Math.round(progress * 100)}%` }}
						/>
					</div>
					<AnimatePresence>
						{past && (
							<motion.button
								type="button"
								initial={reduce ? false : { opacity: 0, x: -12 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -12 }}
								transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
								aria-label="返回博客"
								className="absolute top-4 left-4 z-10 flex size-9 cursor-pointer items-center justify-center rounded-full border border-edge-hairline bg-background/90 shadow-sm backdrop-blur transition-colors hover:border-foreground/40"
							>
								<ArrowLeft className="size-4" />
							</motion.button>
						)}
					</AnimatePresence>
				</>
			}
		>
			<DemoArticle />
		</DemoStage>
	);
}
