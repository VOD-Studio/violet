import { ArrowLeft } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { DemoBody, DemoHeader } from "./DemoArticle";

/**
 * StickyBackBar - 方向①：吸顶返回条
 *
 * 哨兵夹在文章头与正文之间，滚出容器视口顶（IntersectionObserver，
 * root 为演示容器）即挂载 sticky 细条：返回 + 来源页 + 截断标题。
 * 细条在流内紧跟哨兵，标题滚出后自然到达 top-0 并钉住到正文结束；
 * 已滚过时挂载也会被直接钳制到容器顶部，滑入动画衔接。
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
		<div
			ref={scrollRef}
			className="relative h-[560px] overflow-y-auto rounded-xl border border-edge-hairline bg-background/60"
		>
			<div className="pb-10">
				<DemoHeader />
				<div ref={sentinelRef} aria-hidden className="h-px" />
				{stuck && (
					<motion.div
						initial={reduce ? false : { y: -48, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
						className="sticky top-0 z-10 flex cursor-pointer items-center gap-3 border-b border-edge-hairline bg-background/90 px-4 py-2.5 backdrop-blur md:px-6"
					>
						<ArrowLeft className="size-4 shrink-0" />
						<span className="shrink-0 text-sm font-medium">返回博客</span>
						<span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
							长文阅读的返回问题：滚动之后，退路在哪里
						</span>
					</motion.div>
				)}
				<DemoBody />
			</div>
		</div>
	);
}
