export interface BotBadgeProps {
	/** 是否展示；缺省或 false 时不渲染。 */
	show?: boolean;
}

/**
 * 自动化账号标识：Bot 发布的推文、评论与公开资料在作者名旁展示。
 *
 * @remarks 仅说明账号由程序驱动，不表示经过核验的 AI 身份。
 */
export function BotBadge({ show }: BotBadgeProps) {
	if (!show) return null;
	return (
		<span
			className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
			title="自动化 Bot 账号，内容由程序发布"
		>
			BOT
		</span>
	);
}
