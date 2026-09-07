import { cn } from "@shared/lib/utils";
import { motion, useReducedMotion } from "motion/react";

export interface RuaLoadingProps {
	/** 页面级等待、浮层等待或行内等待。 */
	variant?: "page" | "overlay" | "inline";
	/** 屏幕阅读器与可见界面共同使用的状态文案。 */
	label?: string;
	/** 页面级等待时显示的补充说明。 */
	detail?: string;
	/** 追加到最外层元素的样式类。 */
	className?: string;
}

const STAR_PATH = "polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%)";

/**
 * 瑠爱主题加载状态，保留 Violet 的留白与细线视觉。
 */
const RuaLoading = ({
	variant = "page",
	label = "正在把话整理好…",
	detail = "稍等，新的一页正在展开",
	className,
}: RuaLoadingProps) => {
	const reduceMotion = useReducedMotion();
	const isInline = variant === "inline";

	return (
		<section
			role="status"
			aria-live="polite"
			aria-busy="true"
			className={cn(
				"text-foreground",
				variant === "page" && "grid min-h-[48vh] place-items-center px-6 py-20",
				variant === "overlay" &&
					"fixed inset-0 z-50 grid place-items-center bg-background/86 px-6 backdrop-blur-sm",
				variant === "inline" && "inline-flex items-center gap-2.5",
				className,
			)}
		>
			<div
				className={cn(
					"flex items-center",
					isInline ? "gap-2.5" : "flex-col gap-5 text-center",
				)}
			>
				<motion.div
					className={cn(
						"relative shrink-0 rounded-full border border-edge-hairline bg-background p-0.5 shadow-sm",
						isInline ? "size-8" : "size-18",
					)}
					animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
					transition={{
						duration: 2.4,
						ease: "easeInOut",
						repeat: Number.POSITIVE_INFINITY,
					}}
				>
					<img
						src="/persona/rua-loader.webp"
						alt=""
						width={512}
						height={512}
						decoding="async"
						fetchPriority="high"
						className="size-full rounded-full object-cover"
					/>
					<motion.span
						aria-hidden
						className={cn(
							"absolute bg-(--persona-gold) shadow-[0_0_14px_color-mix(in_oklab,var(--persona-gold)_52%,transparent)]",
							isInline ? "-top-0.5 -right-0.5 size-2" : "top-0 right-0 size-3",
						)}
						style={{ clipPath: STAR_PATH }}
						animate={
							reduceMotion
								? undefined
								: { opacity: [0.52, 1, 0.52], scale: [0.82, 1.12, 0.82] }
						}
						transition={{
							duration: 1.8,
							ease: "easeInOut",
							repeat: Number.POSITIVE_INFINITY,
						}}
					/>
				</motion.div>

				<div className={cn("min-w-0", isInline ? "flex items-center gap-2" : "space-y-2")}>
					<div
						className={cn(
							"flex items-center",
							isInline ? "gap-2" : "justify-center gap-2.5",
						)}
					>
						<span
							className={cn(
								"font-mono text-muted-foreground",
								isInline ? "text-xs" : "text-sm",
							)}
						>
							{label}
						</span>
						<span aria-hidden className="inline-flex items-center gap-1">
							{[0, 1, 2].map((index) => (
								<motion.span
									key={index}
									className="size-1 rounded-full bg-(--persona-violet)"
									animate={
										reduceMotion
											? undefined
											: { opacity: [0.24, 0.9, 0.24], y: [0, -2, 0] }
									}
									transition={{
										delay: index * 0.16,
										duration: 1.2,
										ease: "easeInOut",
										repeat: Number.POSITIVE_INFINITY,
									}}
								/>
							))}
						</span>
					</div>
					{!isInline && <p className="text-xs text-muted-foreground/70">{detail}</p>}
				</div>
			</div>
		</section>
	);
};

export default RuaLoading;
