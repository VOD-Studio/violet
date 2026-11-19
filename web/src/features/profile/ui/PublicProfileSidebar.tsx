import { getDisplayName } from "@entities/user/model/display-name";
import type { UserDTO } from "@entities/user/model/types";
import { useCreateChatConversation } from "@features/chat/api/queries";
import { avatarUrl } from "@shared/lib/image-url";
import { Link, useNavigate } from "@tanstack/react-router";
import {
	Avatar,
	Badge,
	Button,
	Card,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@violet/ui";
import {
	CalendarDays,
	Ellipsis,
	Gauge,
	LinkIcon,
	MapPin,
	MessageCircle,
	Settings,
	Share2,
} from "lucide-react";
import { toast } from "sonner";
import type { PublicProfile } from "../model/public-profile";
import { ProfileActivityCalendar } from "./ProfileActivityCalendar";
import { PublicPreferencesDialog } from "./PublicPreferencesDialog";

/** 公开资料与所有者操作；私信仍经过现有登录和会话授权流程。 */
export function PublicProfileSidebar({
	profile,
	currentUser,
}: {
	profile: PublicProfile;
	currentUser?: UserDTO | null;
}) {
	const navigate = useNavigate();
	const chat = useCreateChatConversation();
	const isSelf = currentUser?.id === profile.id;
	const name = getDisplayName(profile);
	return (
		<aside className="relative z-1 flex min-w-0 flex-col gap-4 lg:-mt-30">
			<Card className="p-6 pt-0">
				<Avatar
					src={avatarUrl(profile.avatar_url, profile.username)}
					name={name}
					size={96}
					className="-mt-12 ring-4 ring-card"
				/>
				<h1 className="mt-4 flex items-center gap-2 text-2xl font-bold wrap-break-word">
					{name}
					{profile.is_bot && <Badge>Bot</Badge>}
				</h1>
				<p className="mt-1 font-mono text-sm text-muted-foreground">@{profile.username}</p>
				<p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
					{profile.bio.trim() || "还没有留下简介。"}
				</p>
				<div className="mt-4 space-y-2 text-sm text-muted-foreground">
					{profile.location && (
						<p className="flex items-center gap-2">
							<MapPin className="size-4 shrink-0" />
							{profile.location}
						</p>
					)}
					{profile.website && (
						<a
							href={profile.website}
							target="_blank"
							rel="noopener noreferrer me"
							className="flex items-center gap-2 text-primary hover:underline"
						>
							<LinkIcon className="size-4 shrink-0" />
							<span className="truncate">
								{profile.website.replace(/^https?:\/\//, "")}
							</span>
						</a>
					)}
					<p className="flex items-center gap-2">
						<CalendarDays className="size-4 shrink-0" />
						<time dateTime={profile.created_at}>{profile.created_at.slice(0, 7)}</time>{" "}
						加入
					</p>
				</div>
				<div className="mt-5 flex gap-2">
					{isSelf ? (
						<Button asChild className="flex-1" variant="outline">
							<Link to="/settings">
								<Settings className="size-4" />
								编辑资料
							</Link>
						</Button>
					) : (
						<Button
							className="flex-1"
							loading={chat.isPending}
							onClick={async () => {
								if (!currentUser) {
									navigate({
										to: "/login",
										search: {
											redirect: `${window.location.pathname}${window.location.search}${window.location.hash}`,
										},
									});
									return;
								}
								try {
									const conversation = await chat.mutateAsync({
										kind: "direct",
										participant_ids: [profile.id],
									});
									navigate({ to: "/chat", search: { c: conversation.id } });
								} catch {
									toast.error("无法发起私聊，请稍后重试");
								}
							}}
						>
							<MessageCircle className="size-4" />
							私信
						</Button>
					)}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button iconOnly variant="ghost" aria-label="更多主页操作">
								<Ellipsis className="size-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem
								onSelect={async () => {
									try {
										await navigator.clipboard.writeText(
											`${window.location.origin}/users/${encodeURIComponent(profile.username)}`,
										);
										toast.success("主页链接已复制");
									} catch {
										toast.error("复制失败，请从地址栏复制链接");
									}
								}}
							>
								<Share2 className="size-4" />
								复制主页链接
							</DropdownMenuItem>
							{isSelf && (
								<DropdownMenuItem asChild>
									<Link
										to="/users/$username/usage"
										params={{ username: profile.username }}
									>
										<Gauge className="size-4" />
										我的用量
									</Link>
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</Card>
			<ProfileActivityCalendar activity={profile.activity} />
			<Card className="p-5">
				<h2 className="text-sm text-muted-foreground">常读</h2>
				{profile.public_reading_preferences.length > 0 ? (
					<div className="mt-3 flex flex-wrap gap-2">
						{profile.public_reading_preferences.map((topic) => (
							<Badge key={topic}>{topic}</Badge>
						))}
					</div>
				) : (
					<p className="mt-3 text-sm text-muted-foreground">尚未公开常读主题</p>
				)}
				{isSelf && (
					<div className="mt-3">
						<PublicPreferencesDialog profile={profile} />
					</div>
				)}
			</Card>
		</aside>
	);
}
