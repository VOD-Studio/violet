import { cn } from "@shared/lib/utils";
import { Badge } from "@shared/ui/badge";

export type StatusKind = "user" | "post" | "comment" | "generic";

export interface StatusBadgeProps {
	status: string;
	kind?: StatusKind;
	className?: string;
}

/**
 * STATUS_VARIANT_MAP - 状态到视觉变体的映射
 */
const STATUS_VARIANT_MAP: Record<StatusKind, Record<string, string>> = {
	user: {
		active: "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15",
		inactive: "bg-red-500/15 text-red-600 hover:bg-red-500/15",
	},
	post: {
		draft: "bg-muted text-muted-foreground hover:bg-muted",
		published: "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15",
		archived: "bg-amber-500/15 text-amber-600 hover:bg-amber-500/15",
	},
	comment: {
		pending: "bg-amber-500/15 text-amber-600 hover:bg-amber-500/15",
		approved: "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15",
		spam: "bg-red-500/15 text-red-600 hover:bg-red-500/15",
		deleted: "bg-muted text-muted-foreground hover:bg-muted",
	},
	generic: {
		default: "bg-muted text-muted-foreground hover:bg-muted",
	},
};

/**
 * StatusBadge - 状态徽章
 *
 * 根据状态类型与值返回对应颜色。
 */
export function StatusBadge({ status, kind = "generic", className }: StatusBadgeProps) {
	const normalized = status.toLowerCase();
	const variant = STATUS_VARIANT_MAP[kind][normalized] ?? STATUS_VARIANT_MAP.generic.default;
	return (
		<Badge variant="secondary" className={cn("font-normal capitalize", variant, className)}>
			{status}
		</Badge>
	);
}
