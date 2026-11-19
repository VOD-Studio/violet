import { Card } from "@violet/ui";
import { useState } from "react";
import type { PublicProfile } from "../model/public-profile";

const dayOffsets: Record<string, number> = {
	ArrowLeft: -7,
	ArrowRight: 7,
	ArrowUp: -1,
	ArrowDown: 1,
};

/** 服务端连续日期序列的键盘可读热度格；方向键按天或周移动。 */
export function ProfileActivityCalendar({ activity }: { activity: PublicProfile["activity"] }) {
	const [active, setActive] = useState(activity.days.length - 1);
	const selected = activity.days[Math.min(active, activity.days.length - 1)];
	return (
		<Card className="p-5">
			<h2 className="text-sm text-muted-foreground">
				近半年 · <span className="font-mono text-foreground">{activity.total}</span>{" "}
				次公开活动
			</h2>
			<p className="mt-2 text-xs text-muted-foreground">
				{activity.start_date} 至 {activity.end_date} · {activity.timezone}
			</p>
			<ul
				aria-label="每天的公开活动次数，使用方向键移动"
				className="mt-4 grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto p-1"
			>
				{activity.days.map((day, index) => (
					<li key={day.date}>
						<button
							type="button"
							tabIndex={index === Math.min(active, activity.days.length - 1) ? 0 : -1}
							aria-label={`${day.date}，${day.count} 次公开活动`}
							title={`${day.date} · ${day.count} 次`}
							className={`block size-2 rounded-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring ${day.count === 0 ? "bg-muted" : day.count < 3 ? "bg-primary/25" : day.count < 6 ? "bg-primary/55" : "bg-primary"}`}
							onFocus={() => setActive(index)}
							onClick={() => setActive(index)}
							onKeyDown={(event) => {
								const delta = dayOffsets[event.key];
								const next =
									event.key === "Home"
										? 0
										: event.key === "End"
											? activity.days.length - 1
											: delta === undefined
												? undefined
												: Math.max(
														0,
														Math.min(
															activity.days.length - 1,
															index + delta,
														),
													);
								if (next === undefined) return;
								event.preventDefault();
								event.currentTarget
									.closest("ul")
									?.querySelectorAll("button")
									[next]?.focus();
							}}
						/>
					</li>
				))}
			</ul>
			{selected && (
				<p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
					{selected.date} · {selected.count} 次公开活动
				</p>
			)}
			<p className="mt-3 text-xs leading-relaxed text-muted-foreground">
				每篇公开文章、推文、已审核评论或批注计一次；不含阅读、点赞与表情回应。
			</p>
		</Card>
	);
}
