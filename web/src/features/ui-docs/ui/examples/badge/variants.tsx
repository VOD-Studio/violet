import { Link } from "@tanstack/react-router";
import { Badge } from "@violet/ui";

/** Badge 标签颜色变体一览。 */
export function BadgeVariantsDemo() {
	return (
		<div className="flex flex-wrap items-center justify-center gap-3">
			<Badge>默认</Badge>
			<Badge variant="secondary">次要</Badge>
			<Badge variant="destructive">警示</Badge>
			<Badge variant="outline">描边</Badge>
			<Badge variant="ghost">无底色</Badge>
			<Link
				to="/ui/components"
				className="rounded-full focus-visible:outline-2 focus-visible:outline-ring"
			>
				<Badge variant="link">查看决策表</Badge>
			</Link>
		</div>
	);
}
