import { cn } from "@shared/lib/utils";
import { SpriteSheet } from "@shared/ui/sprite-sheet";
import styles from "./RuaLoading.module.css";

export interface RuaLoadingProps {
	/** 页面级等待、浮层等待或行内等待。 */
	variant?: "page" | "overlay" | "inline";
	/** 屏幕阅读器与可见界面共同使用的状态文案。 */
	label?: string;
	/** 页面级等待时显示的补充说明。 */
	detail?: string;
	/**
	 * 总帧数；更换新雪碧图时只需修改此数值。
	 *
	 * @default 15
	 */
	frames?: number;
	/**
	 * 单次完整动画循环周期秒数。
	 *
	 * @default 3
	 */
	duration?: number;
	/** 追加到最外层元素的样式类。 */
	className?: string;
}

/**
 * 瑠爱主题的叙事式加载状态：专注书写、停笔托腮思考，与困倦伏案小憩。
 */
const RuaLoading = ({
	variant = "page",
	label = "瑠爱还在措辞…",
	detail = "写好这一页，就来见你",
	frames = 15,
	duration = 5,
	className,
}: RuaLoadingProps) => {
	const isInline = variant === "inline";
	const fps = frames / duration;

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
				style={{ "--duration": `${duration}s` } as React.CSSProperties}
				className={cn(
					"flex items-center",
					isInline ? "gap-2.5" : "flex-col gap-1 text-center",
				)}
			>
				<SpriteSheet
					src="/persona/rua-writing-sprite.webp"
					cols={frames}
					fps={fps}
					className={isInline ? "w-12" : "w-[min(14rem,48vw)]"}
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
