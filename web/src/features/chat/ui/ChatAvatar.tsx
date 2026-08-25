import { cn } from "@shared/lib/utils";
import { Link } from "@tanstack/react-router";
import type { ChatUser } from "../model/types";

export interface ChatAvatarProps {
	/** 头像对应的聊天用户。 */
	user: ChatUser;
	/** 头像尺寸与布局类名。 */
	className?: string;
}

/**
 * 无头像时的背景色盘：按用户名哈希取色，同一用户每次渲染结果稳定。
 * 低饱和度中明度，白字对比度全部达标。
 */
const FALLBACK_COLORS = [
	"bg-[#e17076]", // 红
	"bg-[#7bc862]", // 绿
	"bg-[#e5ca77]", // 黄
	"bg-[#65aadd]", // 蓝
	"bg-[#a695e7]", // 紫
	"bg-[#ee7aae]", // 粉
	"bg-[#6ec9cb]", // 青
	"bg-[#faa774]", // 橙
] as const;

function fallbackColorClass(name: string): string {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
	}
	return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

/** 聊天用户头像：有图片时渲染图片；无图片时渲染纯色圆盘 + 白色首字母。 */
export function ChatAvatar({ user, className }: ChatAvatarProps) {
	const label = user.display_name.trim() ? user.display_name : user.username;
	const initial = label.slice(0, 1).toUpperCase();
	const avatar = user.avatar_url ? (
		<img
			alt={`${label} 的头像`}
			className={cn("rounded-full object-cover", className)}
			src={user.avatar_url}
		/>
	) : (
		<div
			aria-hidden="true"
			className={cn(
				"flex items-center justify-center rounded-full font-semibold text-white select-none",
				fallbackColorClass(user.username || user.id),
				className,
			)}
		>
			{initial}
		</div>
	);
	return (
		<Link
			aria-label={`${label} 的个人主页`}
			className="block shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
			params={{ username: user.username }}
			to="/users/$username"
		>
			{avatar}
		</Link>
	);
}
