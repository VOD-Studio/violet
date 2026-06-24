import { cn } from "@shared/lib/utils";

export interface LoaderProps {
	/** 文案，省略则只显示三点 */
	label?: string;
	/** 尺寸 */
	size?: "sm" | "md" | "lg";
	className?: string;
}

const DOT = {
	sm: "size-1.5",
	md: "size-2",
	lg: "size-2.5",
};

/**
 * Loader - 三点跳动加载（柔和阅读风）
 *
 * 三个圆点依次淡入淡出，克制不抢戏。纯 opacity 动画（无 reflow）。
 * 通用用法：<Loader label="加载中" /> 或 <Loader size="sm" />
 */
const Loader = ({ label, size = "md", className }: LoaderProps) => {
	return (
		<div
			className={cn("flex flex-col items-center justify-center gap-3", className)}
			role="status"
			aria-live="polite"
			aria-label={label ?? "加载中"}
		>
			<div className="flex items-center gap-1.5">
				{[0, 1, 2].map((i) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: 静态三点
						key={i}
						className={cn("rounded-full bg-muted-foreground", DOT[size])}
						style={{
							animation: "nexus-bounce 1.2s ease-in-out infinite",
							animationDelay: `${i * 0.16}s`,
						}}
					/>
				))}
			</div>
			{label ? <p className="text-xs text-muted-foreground">{label}</p> : null}
		</div>
	);
};

export default Loader;
