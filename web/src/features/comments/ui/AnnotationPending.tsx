import { getClientThemeState } from "@shared/lib/theme-preference";
import { FlowerBloom, SEASON_FLOWER } from "@violet/ui";
import { cn } from "cn";
import { useEffect, useState } from "react";

/** 等待超过这个时长才画出花形，更快完成的不显示任何加载。 */
const SHOW_DELAY_MS = 300;

export interface AnnotationPendingProps {
	/** 读屏播报的等待说明；画面上只有花形。 */
	label: string;
	/** 等待区的高度由调用方给定，与随后到位的内容相当，面板不因此改变大小。 */
	className?: string;
}

/**
 * 批注浮层的块加载：等待区中央描出一朵当季的花，与整页等待同款。
 *
 * @remarks 等待区从一开始就占位，花形延后出现；浮层不会先以空壳出现再撑开。
 */
export function AnnotationPending({ label, className }: AnnotationPendingProps) {
	const [visible, setVisible] = useState(false);
	useEffect(() => {
		const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
		return () => window.clearTimeout(timer);
	}, []);
	return (
		<div
			role="status"
			aria-busy="true"
			className={cn("flex items-center justify-center", className)}
		>
			{visible && (
				<FlowerBloom
					kind={SEASON_FLOWER[getClientThemeState().preset]}
					size={24}
					variant="outline"
					tone="season"
					aria-hidden="true"
				/>
			)}
			<span className="sr-only">{label}</span>
		</div>
	);
}
