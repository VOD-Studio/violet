import { getClientThemeState } from "@shared/lib/theme-preference";
import { Link, useRouter } from "@tanstack/react-router";
import { Button, FlowerBloom, type FlowerKind, SEASON_FLOWER } from "@violet/ui";
import { cn } from "cn";
import { useEffect, useState } from "react";

export interface PageLoadingProps {
	/** 2 到 8 秒期间显示的提示文案 */
	label?: string;
	/** 强制指定花形；省略时自动取当前季节对应花形 */
	kind?: FlowerKind;
	className?: string;
}

/**
 * 整页等待：内容区画一朵随季节的当季花形。
 *
 * 时序阶梯（设计稿「加载」页）：
 * - 300ms 内完成不显示任何加载，避免界面闪烁；
 * - 0 到 2 秒：只展示当季花形；
 * - 2 到 8 秒：下方淡入提示一句话；
 * - 超过 8 秒：提供重试与返回首页，不无限等待。
 */
export function PageLoading({ label = "正在载入页面…", kind, className }: PageLoadingProps) {
	const router = useRouter();
	const [elapsed, setElapsed] = useState(0);

	useEffect(() => {
		const start = Date.now();
		const interval = window.setInterval(() => {
			setElapsed(Date.now() - start);
		}, 100);
		return () => window.clearInterval(interval);
	}, []);

	// 300ms 内不显示任何内容
	if (elapsed < 300) {
		return null;
	}

	const season = getClientThemeState().preset;
	const activeKind = kind ?? SEASON_FLOWER[season] ?? "plum";

	const showHint = elapsed >= 2000;
	const showTimeoutActions = elapsed >= 8000;

	return (
		<section
			role="status"
			aria-live="polite"
			aria-busy="true"
			className={cn(
				"flex min-h-[50vh] flex-1 flex-col items-center justify-center p-8 text-center",
				className,
			)}
		>
			<div className="flex flex-col items-center gap-4">
				<FlowerBloom
					kind={activeKind}
					size={48}
					variant="outline"
					tone="season"
					aria-hidden="true"
				/>

				{showHint && !showTimeoutActions && (
					<p className="font-serif text-13 text-muted-foreground animate-in fade-in duration-300">
						{label}
					</p>
				)}

				{showTimeoutActions && (
					<div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
						<p className="text-13 text-muted-foreground">加载时间较长，网络可能较慢</p>
						<div className="flex items-center gap-2">
							<Button size="sm" variant="outline" onClick={() => router.invalidate()}>
								重新加载
							</Button>
							<Button size="sm" asChild variant="secondary">
								<Link to="/">返回首页</Link>
							</Button>
						</div>
					</div>
				)}
			</div>
		</section>
	);
}

export default PageLoading;
