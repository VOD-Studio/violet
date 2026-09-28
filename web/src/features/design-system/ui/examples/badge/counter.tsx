import { Badge, BadgeAnchor, Button } from "@violet/ui";
import { Bell } from "lucide-react";
import { useState } from "react";

/** 数量角标：按钮调整未读数，超过 99 显示 99+、为零时隐藏。 */
export function BadgeCounterDemo() {
	const [count, setCount] = useState(3);

	return (
		<div className="flex flex-wrap items-center justify-center gap-4">
			<BadgeAnchor
				badge={
					count > 0 ? (
						<Badge size="count" variant="destructive">
							{count > 99 ? "99+" : count}
						</Badge>
					) : null
				}
			>
				<Button
					type="button"
					size="icon-sm"
					variant="outline"
					className="rounded-full"
					aria-label={count > 0 ? `通知，${count} 条未读` : "通知，无未读消息"}
				>
					<Bell aria-hidden="true" />
				</Button>
			</BadgeAnchor>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={() => setCount((n) => Math.max(0, n - 1))}
			>
				-1
			</Button>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={() => setCount((n) => n + 1)}
			>
				+1
			</Button>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onClick={() => setCount((n) => n + 100)}
			>
				+100
			</Button>
			<Button type="button" variant="ghost" size="sm" onClick={() => setCount(0)}>
				清零
			</Button>
		</div>
	);
}
