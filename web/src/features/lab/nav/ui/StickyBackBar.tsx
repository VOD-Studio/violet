import { ArrowLeft } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { DemoBody, DemoHeader, DemoStage } from "./DemoArticle";

/**
 * StickyBackBar - 方向①：吸顶返回条
 *
 * 哨兵夹在文章头与正文之间，滚出容器视口顶（IntersectionObserver，
 * root 为演示容器）即浮出细条：返回 + 来源页 + 截断标题。
 * 细条挂在 wrapper overlay 位而非内容流里——in-flow mount/unmount 会
 * 让内容高度瞬变 ±45px，阈值附近来回滚就抖；overlay 与其他三方向
 * 同构，视觉上等同于 sticky 钉顶（内容从条下滚过）。
 */
export function StickyBackBar() {
	const scrollRef = useRef<HTMLDivElement>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);
	const [stuck, setStuck] = useState(false);
	const reduce = useReducedMotion();

	useEffect(() => {
		const el = scrollRef.current;
		const sentinel = sentinelRef.current;
		if (!el || !sentinel) return;
		const io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
			root: el,
			rootMargin: "-1px 0px 0px 0px",
		});
		io.observe(sentinel);
		return () => io.disconnect();
	}, []);

	return (
		<DemoStage
			scrollRef={scrollRef}
			overlay={
				<AnimatePresence>
					{stuck && (
						<motion.div
							initial={reduce ? false : { y: -48, opacity: 0 }}
							animate={{ y: 0, opacity: 1 }}
							exit={{ y: -48, opacity: 0 }}
							transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
							className="absolute inset-x-0 top-0 z-10 flex cursor-pointer items-center gap-3 border-b border-edge-hairline bg-background/90 px-4 py-2.5 backdrop-blur md:px-6"
						>
							<ArrowLeft className="size-4 shrink-0" />
							<span className="shrink-0 text-sm font-medium">返回博客</span>
							<span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
								长文阅读的返回问题
							</span>
						</motion.div>
					)}
				</AnimatePresence>
			}
		>
			<div className="pb-16">
				<DemoHeader />
				<div ref={sentinelRef} aria-hidden className="h-px" />
				<DemoBody />
			</div>
		</DemoStage>
	);
}
