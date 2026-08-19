import { Card, CardContent } from "@shared/ui/base/card";
import { FileText, Users } from "lucide-react";

/**
 * 内容存量卡：文章与用户双指标。
 *
 * 两个数字无趋势口径（后端无对应对比窗口），只做存量展示。
 */
export function ContentStockTile({ posts, users }: { posts: number; users: number }) {
	return (
		<Card className="border-border/60 h-full">
			<CardContent className="flex h-full flex-col gap-2 p-6">
				<span className="text-muted-foreground text-sm font-medium">内容存量</span>
				<div className="mt-auto flex flex-col gap-3">
					<div className="flex items-baseline gap-2">
						<FileText className="text-muted-foreground size-4 self-center" />
						<span className="text-2xl font-bold tabular-nums">{posts}</span>
						<span className="text-muted-foreground text-xs">篇文章</span>
					</div>
					<div className="flex items-baseline gap-2">
						<Users className="text-muted-foreground size-4 self-center" />
						<span className="text-2xl font-bold tabular-nums">{users}</span>
						<span className="text-muted-foreground text-xs">位用户</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
