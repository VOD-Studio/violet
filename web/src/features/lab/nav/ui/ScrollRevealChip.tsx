import { ArrowLeft } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef } from "react";
import { DemoArticle, DemoStage } from "./DemoArticle";
import { useScrollVisibility } from "./use-scroll-visibility";

/**
 * ScrollRevealChip - 方向③：上滑显现
 *
 * 向下读时隐身，向上滑时底部浮出「返回博客」胶囊——手势意图即触发，
 * 移动端原生感。可见性只看 movingUp（触发时已要求距顶 80px 以上），
 * 不再叠加 past 门槛：小滚动范围里一次上滑可能直接冲过阈值，胶囊闪没。
 */
export function ScrollRevealChip() {
	const scrollRef = useRef<HTMLDivElement>(null);
	const { movingUp } = useScrollVisibility(scrollRef);
	const reduce = useReducedMotion();

	return (
		<DemoStage
			scrollRef={scrollRef}
			overlay={
				<AnimatePresence>
					{movingUp && (
						<motion.div
							initial={reduce ? false : { opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, y: 12 }}
							transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
							className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2"
						>
							<button
								type="button"
								className="flex cursor-pointer items-center gap-2 rounded-full border border-edge-hairline bg-background/90 px-4 py-2 text-sm shadow-sm backdrop-blur transition-colors hover:border-foreground/40"
							>
								<ArrowLeft className="size-3.5" />
								返回博客
							</button>
						</motion.div>
					)}
				</AnimatePresence>
			}
		>
			<DemoArticle />
		</DemoStage>
	);
}
