import { Card, CardContent } from "@shared/ui/base/card";
import { TrendingDown, TrendingUp } from "lucide-react";
import { computeDelta } from "../lib/metrics";

/**
 * 本周新评论环比卡。
 *
 * 上周为 0（无基数）时只显示本周数，不显示环比——首周场景环比无意义。
 */
export function WeekCommentsTile({ week, lastWeek }: { week: number; lastWeek: number }) {
	const delta = computeDelta(week, lastWeek);
	return (
		<Card className="border-border/60 h-full">
			<CardContent className="flex h-full flex-col gap-2 p-6">
				<span className="text-muted-foreground text-sm font-medium">本周新评论</span>
				<div className="text-3xl font-bold tabular-nums">{week}</div>
				{delta ? (
					<div
						className={`mt-auto flex items-center gap-1 text-xs ${
							delta.direction === "down" ? "text-red-500" : "text-emerald-500"
						}`}
					>
						{delta.direction === "up" ? (
							<TrendingUp className="size-3" />
						) : (
							<TrendingDown className="size-3" />
						)}
						<span className="tabular-nums">
							{delta.direction === "flat" ? "持平" : `${delta.percent}%`}
						</span>
						<span className="text-muted-foreground">较上周</span>
					</div>
				) : (
					<span className="text-muted-foreground mt-auto text-xs">上周无评论</span>
				)}
			</CardContent>
		</Card>
	);
}
