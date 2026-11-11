/**
 * AnnotationPending - 批注浮层的等待指示
 *
 * 批注卡与段评面板是小浮层、内容条数不定，形状不可预知——按设计稿「加载」页
 * 用花形指示器而非骨架（梅花为通用款）；300ms 内完成的等待不显示，避免闪现。
 * 减弱动态下的静止由指示器自身的动画规则处理。
 */
import { FlowerBloom } from "@violet/ui";
import { cn } from "cn";
import { useEffect, useState } from "react";

export interface AnnotationPendingProps {
	/** 可见的一句等待说明；省略时只有花形，读屏仍可感知 */
	label?: string;
	className?: string;
}

/** 300ms 后才显示的等待指示：花形 + 说明，居中一行。 */
export function AnnotationPending({ label, className }: AnnotationPendingProps) {
	const [visible, setVisible] = useState(false);
	useEffect(() => {
		const timer = window.setTimeout(() => setVisible(true), 300);
		return () => window.clearTimeout(timer);
	}, []);
	if (!visible) return null;
	return (
		<div
			role="status"
			aria-busy="true"
			className={cn(
				"flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground",
				className,
			)}
		>
			<FlowerBloom kind="plum" size={24} tone="season" aria-hidden="true" />
			{label && <span>{label}</span>}
			{!label && <span className="sr-only">加载中</span>}
		</div>
	);
}
