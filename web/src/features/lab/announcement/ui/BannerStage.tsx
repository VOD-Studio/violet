import type { Announcement } from "@features/settings/model/types";
import { cn } from "@shared/lib/utils";
import { getAnnouncementSev } from "@shared/ui/announcement-severity";
import type { ReactNode, Ref } from "react";
import { useState } from "react";

/**
 * banner severity → neon 色（生产 AnnouncementBar 的横幅配色约定，
 * 与卡片系的 shadcn 色阶刻意双轨：深底上 neon 更亮）
 */
export const BANNER_NEON: Record<string, string> = {
	info: "text-neon-cyan",
	warning: "text-neon-purple",
	success: "text-neon-green",
	error: "text-neon-pink",
};

/**
 * 横幅方向的统一舞台：深色横条容器 + 演示用「关闭即已读」。
 * 关闭后压成一条可点击恢复的细占位，演示「新 id 出现才重现」约束。
 * children 由各方向渲染（棱柱 / 渐隐 / 滑轨的动画层）。
 */
export function BannerStage({
	items,
	index,
	children,
	footer,
	className,
	stageRef,
	...rest
}: {
	items: Announcement[];
	index: number;
	children: ReactNode;
	/** 条内额外层（滑轨方向的驻留进度线），贴在条底部 */
	footer?: ReactNode;
	className?: string;
	/** 滚轮接管容器 ref（useBannerTicker().wheelRef），原生非被动监听 */
	stageRef?: Ref<HTMLDivElement>;
} & React.HTMLAttributes<HTMLDivElement>) {
	const [dismissed, setDismissed] = useState(false);
	const current = items[index];
	if (!current) return null;

	if (dismissed) {
		return (
			<div
				ref={stageRef}
				className="border-b border-edge-hairline bg-primary/95 font-mono text-[10px] dark:bg-zinc-900"
			>
				<button
					type="button"
					onClick={() => setDismissed(false)}
					className="mx-auto flex h-6 w-full items-center justify-center gap-2 text-primary-foreground/60 transition-colors hover:text-primary-foreground dark:text-foreground/60 dark:hover:text-foreground"
				>
					已读 · 演示（新 id 出现前不再重现，点击恢复）
				</button>
			</div>
		);
	}

	return (
		<div
			ref={stageRef}
			{...rest}
			className={cn(
				"relative border-b border-edge-hairline bg-primary/95 font-mono text-xs dark:bg-zinc-900",
				className,
			)}
		>
			{children}
			<span className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-[10px] text-primary-foreground/50 dark:text-foreground/50">
				{index + 1}/{items.length}
			</span>
			<button
				type="button"
				aria-label="关闭公告"
				onClick={() => setDismissed(true)}
				className="absolute top-1/2 right-3 z-10 -translate-y-1/2 text-primary-foreground/70 transition-colors hover:text-primary-foreground dark:text-foreground/70 dark:hover:text-foreground"
			>
				✕
			</button>
			{footer}
		</div>
	);
}

/** 横幅单面内容（所有方向共用）：severity neon 图标 + 单行文本。
 * 面板底色比横幅槽底亮一档并带细轮廓——静止时是嵌在槽里的翻牌
 * 面板，棱柱旋转时转的是有边界的实体板，不是透明文字 */
export function BannerFace({ a }: { a: Announcement }) {
	const cfg = getAnnouncementSev(a.severity);
	return (
		<span
			className={cn(
				"flex h-7 items-center justify-center gap-2 bg-primary px-12 ring-1 ring-inset ring-primary-foreground/15 dark:bg-zinc-800 dark:ring-white/10",
				BANNER_NEON[a.severity] ?? BANNER_NEON.info,
			)}
		>
			<cfg.Icon className="size-3.5 shrink-0" />
			<span className="truncate text-primary-foreground dark:text-foreground">
				{a.content}
			</span>
		</span>
	);
}
