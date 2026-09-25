import { BADGE_BY_ID } from "@entities/chat-badge";
import { cn } from "cn";

export interface AppearanceBadgeStripProps {
	/** 佩戴的徽章 ID,按展示顺序;未知 ID 由目录查表兜底跳过。 */
	badgeIDs: readonly string[];
	className?: string;
}

/** 佩戴徽章的行内图条;图片自带文字,附可读名称供悬停与读屏。 */
export function AppearanceBadgeStrip({ badgeIDs, className }: AppearanceBadgeStripProps) {
	if (badgeIDs.length === 0) return null;
	const items = badgeIDs.flatMap((id) => {
		const badge = BADGE_BY_ID.get(id);
		return badge ? [badge] : [];
	});
	if (items.length === 0) return null;
	return (
		<span className={cn("inline-flex items-center gap-1 align-middle", className)}>
			{items.map((badge) => (
				<img
					key={badge.id}
					src={badge.image}
					alt={badge.name}
					title={badge.name}
					className="h-3.5 w-auto max-w-25 select-none"
					draggable={false}
					loading="lazy"
					decoding="async"
				/>
			))}
		</span>
	);
}
