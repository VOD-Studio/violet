import { cn } from "@shared/lib/utils";
import { Card, CardContent } from "@shared/ui/base/card";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, MessageSquareWarning } from "lucide-react";

/**
 * 待审评论行动卡。
 *
 * 概览页唯一强引导：count > 0 时 amber 高亮 + 直达审核页；= 0 显示「队列已清空」。
 */
export function PendingCommentsTile({ count }: { count: number }) {
	const hasPending = count > 0;
	return (
		<Card className="border-border/60 h-full">
			<CardContent className="flex h-full flex-col gap-2 p-6">
				<div className="flex items-center justify-between">
					<span className="text-muted-foreground text-sm font-medium">待审评论</span>
					{hasPending ? (
						<MessageSquareWarning className="size-4 text-amber-500" />
					) : (
						<CheckCircle2 className="size-4 text-emerald-500" />
					)}
				</div>
				{hasPending ? (
					<>
						<div className="text-3xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
							{count}
						</div>
						<Link
							to="/admin/comments"
							className={cn(
								"mt-auto inline-flex items-center gap-1 text-xs font-medium",
								"text-amber-600 hover:underline dark:text-amber-400",
							)}
						>
							去审核
							<ArrowRight className="size-3" />
						</Link>
					</>
				) : (
					<div className="text-muted-foreground mt-auto text-sm">队列已清空</div>
				)}
			</CardContent>
		</Card>
	);
}
