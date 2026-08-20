import { cn } from "@shared/lib/utils";
import type { ChatUser } from "../model/types";

export interface ChatAvatarProps {
	/** 头像对应的聊天用户。 */
	user: ChatUser;
	/** 头像尺寸与布局类名。 */
	className?: string;
}

/** 聊天用户头像，缺少图片时显示展示名或用户名首字母。 */
export function ChatAvatar({ user, className }: ChatAvatarProps) {
	const label = user.display_name.trim() ? user.display_name : user.username;
	return user.avatar_url ? (
		<img
			alt={`${user.display_name} 的头像`}
			className={cn("rounded-full object-cover ring-1 ring-edge-hairline/60", className)}
			src={user.avatar_url}
		/>
	) : (
		<div
			className={cn(
				"flex items-center justify-center rounded-full bg-neon-purple/15 font-mono text-xs font-bold text-neon-purple ring-1 ring-neon-purple/25",
				className,
			)}
		>
			{label.slice(0, 1).toUpperCase()}
		</div>
	);
}
