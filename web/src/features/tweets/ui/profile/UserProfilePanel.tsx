import { getDisplayName } from "@entities/user/model/display-name";
import type { UserProfile } from "@entities/user/model/types";
import { useMe } from "@features/auth/api/queries";
import { useCreateChatConversation } from "@features/chat/api/queries";
import { formatDate } from "@shared/lib/date";
import { avatarUrl } from "@shared/lib/image-url";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@violet/ui";
import { differenceInDays } from "date-fns";
import {
	CalendarDays,
	Check,
	Copy,
	Image as ImageIcon,
	MessageCircle,
	MessageSquareText,
	PenSquare,
	Share2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export interface UserProfilePanelProps {
	profile: UserProfile;
	/** 已加载的推文数；还有下一页时带「+」。 */
	tweetCount: string;
	/** 已加载推文中带图的条数。 */
	mediaCount: number;
}

/** 注册至今的时长，用于资料行的补充说明。 */
function tenureOf(createdAt: string): string {
	const days = differenceInDays(new Date(), new Date(createdAt));
	if (days <= 0) return "今天加入";
	if (days < 30) return `${days} 天`;
	if (days < 365) return `${Math.floor(days / 30)} 个月`;
	return `${(days / 365).toFixed(1).replace(/\.0$/, "")} 年`;
}

/** 复制文本并给出反馈；返回是否成功。 */
async function copyText(text: string, message: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		toast.success(message);
		return true;
	} catch {
		toast.error("复制失败");
		return false;
	}
}

/**
 * 公开用户页左侧的资料栏：头像、名称、简介、操作与资料行。
 *
 * 本人显示「编辑资料」，访客显示「发起私聊」；未登录访客点击私聊会先去登录。
 */
export function UserProfilePanel({ profile, tweetCount, mediaCount }: UserProfilePanelProps) {
	const navigate = useNavigate();
	const { data: currentUser } = useMe();
	const createChat = useCreateChatConversation();
	const [copied, setCopied] = useState<"handle" | "link" | null>(null);
	const [starting, setStarting] = useState(false);

	const displayName = getDisplayName(profile);
	const isSelf = currentUser?.id === profile.id;
	const bio = profile.bio?.trim();

	const flashCopied = (kind: "handle" | "link") => {
		setCopied(kind);
		setTimeout(() => setCopied(null), 2000);
	};

	const startChat = async () => {
		if (!currentUser) {
			navigate({ to: "/login", search: { redirect: window.location.href } });
			return;
		}
		setStarting(true);
		try {
			const conversation = await createChat.mutateAsync({
				kind: "direct",
				participant_ids: [profile.id],
			});
			navigate({ to: "/chat", search: { c: conversation.id } });
		} catch {
			toast.error("无法发起私聊，请稍后重试");
		} finally {
			setStarting(false);
		}
	};

	return (
		<section aria-label="用户资料" className="flex flex-col">
			<img
				src={avatarUrl(profile.avatar_url, profile.username)}
				alt={`${displayName} 的头像`}
				className="size-28 shrink-0 rounded-full border border-border bg-muted object-cover ring-4 ring-background"
			/>

			<h1 className="mt-4 truncate text-2xl font-bold tracking-tight">{displayName}</h1>
			<div className="mt-1 flex items-center gap-1">
				<span className="font-mono text-sm text-muted-foreground">@{profile.username}</span>
				<Button
					variant="ghost"
					size="icon-xs"
					aria-label="复制用户名"
					onClick={async () => {
						if (await copyText(`@${profile.username}`, `已复制 @${profile.username}`))
							flashCopied("handle");
					}}
				>
					{copied === "handle" ? (
						<Check className="size-3.5" />
					) : (
						<Copy className="size-3.5 text-muted-foreground" />
					)}
				</Button>
			</div>

			<p className="mt-4 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap text-muted-foreground">
				{bio || "还没有留下简介。"}
			</p>

			<div className="mt-5 flex items-center gap-2">
				{isSelf ? (
					<Button variant="outline" className="flex-1" asChild>
						<Link to="/profile">
							<PenSquare className="size-4" />
							编辑资料
						</Link>
					</Button>
				) : (
					<Button className="flex-1" onClick={startChat} loading={starting}>
						<MessageCircle className="size-4" />
						发起私聊
					</Button>
				)}
				<Button
					variant="outline"
					size="icon"
					aria-label="复制主页链接"
					onClick={async () => {
						if (await copyText(window.location.href, "主页链接已复制"))
							flashCopied("link");
					}}
				>
					{copied === "link" ? (
						<Check className="size-4" />
					) : (
						<Share2 className="size-4 text-muted-foreground" />
					)}
				</Button>
			</div>

			<ul className="mt-6 flex flex-col gap-2.5 border-t border-border pt-5 text-sm text-muted-foreground">
				<li className="flex items-center gap-2.5">
					<MessageSquareText className="size-4 shrink-0" />
					<span>
						<span className="font-semibold text-foreground tabular-nums">
							{tweetCount}
						</span>{" "}
						条推文
					</span>
				</li>
				<li className="flex items-center gap-2.5">
					<ImageIcon className="size-4 shrink-0" />
					<span>
						<span className="font-semibold text-foreground tabular-nums">
							{mediaCount}
						</span>{" "}
						条含图
					</span>
				</li>
				{profile.created_at && (
					<li className="flex items-center gap-2.5">
						<CalendarDays className="size-4 shrink-0" />
						<span>
							{formatDate(profile.created_at, "year-month")}加入 ·{" "}
							{tenureOf(profile.created_at)}
						</span>
					</li>
				)}
			</ul>
		</section>
	);
}
