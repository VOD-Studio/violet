import { cn } from "cn";
import { useInView, useReducedMotion } from "motion/react";
import { type ComponentProps, useRef, useState } from "react";

export interface TextUnderlineProps extends ComponentProps<"span"> {
	/** 触发模式：hover 悬停生长（默认），reveal 视口进入生长 */
	mode?: "hover" | "reveal";
	/** 线条颜色（CSS 颜色值，默认主题 primary） */
	color?: string;
	/** 线条粗细（像素，默认 1.5） */
	thickness?: number;
}

/** 文字下划线：墨线自左向右平滑生长延伸（动效章程「链接线沿阅读方向生长」）。 */
export function TextUnderline({
	mode = "hover",
	color = "var(--primary)",
	thickness = 1.5,
	className,
	children,
	...rest
}: TextUnderlineProps) {
	const reduce = useReducedMotion();
	const ref = useRef<HTMLSpanElement>(null);
	const inView = useInView(ref, { once: true, margin: "-40px" });
	const [hovered, setHovered] = useState(false);

	const active = mode === "hover" ? hovered : inView;

	return (
		<span
			ref={ref}
			className={cn("relative inline-block cursor-pointer select-none", className)}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			{...rest}
		>
			{children}
			<span
				aria-hidden
				className="pointer-events-none absolute bottom-0 left-0 right-0 origin-left"
				style={{
					height: `${thickness}px`,
					backgroundColor: color,
					transform: active || reduce ? "scaleX(1)" : "scaleX(0)",
					// 与全站动效 token 的 out 曲线一致（ui 包不依赖 web/src/shared）
					transition: reduce ? "none" : "transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
				}}
			/>
		</span>
	);
}
