import type { FriendLinkAdminDTO } from "../model/types";

/** 取站点 host（去 www. 前缀），用于 mono 域名行 */
function hostOf(url: string): string {
	try {
		return new URL(url).host.replace(/^www\./, "");
	} catch {
		return url;
	}
}

interface FriendLinkCellProps {
	row: FriendLinkAdminDTO;
}

/**
 * 友链管理列表 — 站点单元格
 *
 * 头像 + 站名 + mono 域名行。头像为外链 URL（不走后端图片处理参数，
 * 故不复用 shared 的 avatarUrl/imageUrl）；空串时回退站名首字符占位
 * （与 PRD「空则前端首字母占位」一致，样式对齐 friends-lab FriendAvatar）。
 */
export function FriendLinkCell({ row }: FriendLinkCellProps) {
	return (
		<div className="flex items-center gap-2.5">
			{row.avatar_url ? (
				<img
					src={row.avatar_url}
					alt={`${row.name} 头像`}
					loading="lazy"
					className="size-8 shrink-0 rounded-md bg-muted object-cover"
				/>
			) : (
				<span
					aria-hidden
					className="flex size-8 shrink-0 select-none items-center justify-center rounded-md bg-muted font-mono text-sm font-bold text-muted-foreground"
				>
					{row.name.trim().charAt(0) || "?"}
				</span>
			)}
			<div className="min-w-0">
				<div className="truncate font-medium">{row.name}</div>
				<div className="truncate font-mono text-xs text-muted-foreground">
					{hostOf(row.url)}
				</div>
			</div>
		</div>
	);
}
