import { cn } from "@shared/lib/utils";
import styles from "./RuaLoading.module.css";

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

/**
 * 瑠爱主题的叙事式加载状态：写字、眨眼，再举起刚整理好的纸页。
 */
const RuaLoading = ({
	variant = "page",
	label = "瑠爱还在措辞…",
	detail = "写好这一页，就来见你",
	className,
}: RuaLoadingProps) => {
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
				variant === "inline" && "inline-flex items-center",
				className,
			)}
		>
			<div
				className={cn(
					"flex items-center",
					isInline ? "gap-2.5" : "flex-col gap-1 text-center",
				)}
			>
				<span
					aria-hidden="true"
					className={cn(
						styles.sprite,
						"block shrink-0",
						isInline ? "size-12" : "size-[min(14rem,48vw)]",
					)}
				/>

				<div className={cn("min-w-0", isInline ? "w-34" : "w-52 -translate-y-1")}>
					<p
						className={cn(
							"truncate font-mono text-muted-foreground",
							isInline ? "text-xs" : "text-sm",
						)}
					>
						{label}
					</p>
					<div aria-hidden className={cn(styles.inkTrack, "mt-2")}>
						<span className={styles.inkStroke} />
						<span className={styles.inkGlint} />
					</div>
					{!isInline && <p className="mt-2 text-xs text-muted-foreground/65">{detail}</p>}
				</div>
			</div>
		</section>
	);
};

export default RuaLoading;
