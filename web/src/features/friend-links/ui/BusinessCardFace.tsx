import { Link2 } from "lucide-react";
import type { FriendLinkPublicDTO } from "../model/types";
import { FriendAvatar } from "./FriendAvatar";
import { hostOf } from "./postcard-helpers";

/**
 * BusinessCardFace - 名片卡面（纯渲染，无链接语义）
 *
 * 横向名片：左头像钢印、右身份区（站名 / mono 域名 / 描述 / 站长称呼）。
 * 申请弹窗的实时预览复用此卡面。
 */
export function BusinessCardFace({
	link,
	className,
}: {
	link: Pick<FriendLinkPublicDTO, "name" | "url" | "avatar_url" | "description" | "owner_name">;
	className?: string;
}) {
	return (
		<div className={className}>
			<div className="flex items-start gap-4">
				<FriendAvatar
					name={link.name}
					avatarUrl={link.avatar_url}
					className="size-14 rounded-lg text-2xl"
				/>
				<div className="min-w-0 flex-1">
					<h3 className="truncate font-semibold text-foreground">{link.name}</h3>
					<p className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
						<Link2 className="size-3 shrink-0" />
						<span className="truncate">{hostOf(link.url)}</span>
					</p>
				</div>
			</div>
			{link.description ? (
				<p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
					{link.description}
				</p>
			) : null}
			{link.owner_name ? (
				<p className="mt-2 font-mono text-xs text-muted-foreground/70">
					@{link.owner_name}
				</p>
			) : null}
		</div>
	);
}
