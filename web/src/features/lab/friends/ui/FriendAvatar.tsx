import { cn } from "@shared/lib/utils";

/**
 * FriendAvatar - 友链头像
 *
 * avatar_url 存在时渲染 <img>（data URI / 外链均可）；
 * 为 null 时回退为站名首字符的 mono 占位 tile（bg-muted）。
 * 三个候选方向与申请弹窗的实时预览共用。
 */
export function FriendAvatar({
	name,
	avatarUrl,
	className,
}: {
	name: string;
	/** 可空：null/空串都走首字符占位 */
	avatarUrl: string | null;
	className?: string;
}) {
	if (avatarUrl) {
		return (
			<img
				src={avatarUrl}
				alt={`${name} 头像`}
				loading="lazy"
				className={cn("shrink-0 bg-muted object-cover", className)}
			/>
		);
	}
	return (
		<span
			aria-hidden
			className={cn(
				"flex shrink-0 select-none items-center justify-center bg-muted font-mono font-bold text-muted-foreground",
				className,
			)}
		>
			{name.trim().charAt(0) || "?"}
		</span>
	);
}
