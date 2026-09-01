import { HistoryBack } from "@shared/ui/history-back";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * FloatingBack - 浮动返回钮(nav-lab 方向②落生产)
 *
 * 滚过一屏后左下浮出圆钮,回顶自动隐去;与内容区顶部的幽灵态 BackLink
 * 同义——长页面滚离顶部后返回入口不断线。window 级滚动监听,SSR 首帧
 * 不渲染。跳转目标与各页顶部 BackLink 保持一致。
 */
export function FloatingBack({
	to,
	label,
	className,
	history = false,
}: {
	to: string;
	label: string;
	className?: string;
	history?: boolean;
}) {
	const [past, setPast] = useState(false);
	const reduce = useReducedMotion();

	useEffect(() => {
		const onScroll = () => setPast(window.scrollY > window.innerHeight);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	return (
		<AnimatePresence>
			{past && (
				<motion.div
					initial={reduce ? false : { opacity: 0, scale: 0.8, y: 8 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					// reduce 时不做出场动画,AnimatePresence 直隐
					exit={reduce ? undefined : { opacity: 0, scale: 0.8, y: 8 }}
					transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
					className="fixed bottom-8 left-8 z-40"
				>
					{history ? (
						<HistoryBack
							fallbackTo={to}
							className={cn(
								"flex size-11 items-center justify-center rounded-full border border-edge-hairline bg-background/90 p-0 text-foreground shadow-sm backdrop-blur transition-colors hover:border-foreground/40",
								className,
							)}
						>
							<span className="sr-only">{label}</span>
						</HistoryBack>
					) : (
						<Link
							to={to}
							aria-label={label}
							className={cn(
								"flex size-11 items-center justify-center rounded-full border border-edge-hairline bg-background/90 text-foreground shadow-sm backdrop-blur transition-colors hover:border-foreground/40",
								className,
							)}
						>
							<ArrowLeft className="size-4" />
						</Link>
					)}
				</motion.div>
			)}
		</AnimatePresence>
	);
}
